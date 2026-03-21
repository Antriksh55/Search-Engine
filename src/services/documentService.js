/**
 * documentService.js — Business logic for Document CRUD operations
 *
 * ─────────────────────────────────────────────────────────────────
 * WHERE DOES THIS FIT IN MVC?
 * ─────────────────────────────────────────────────────────────────
 * MVC stands for Model-View-Controller. In a REST API there is no HTML
 * "view" — the JSON response IS the view. So the three layers are:
 *
 *   Model      → src/models/Document.js
 *                Defines the shape of data in MongoDB (fields, types, rules).
 *
 *   Controller → src/controllers/documentController.js
 *                Reads from req, calls a service, writes to res.
 *                It knows about HTTP but NOT about databases.
 *
 *   Service    → THIS FILE
 *                Contains all the real work: saving to MongoDB, indexing in
 *                Elasticsearch, invalidating the Redis cache.
 *                It knows about databases but NOT about HTTP.
 *
 * WHY SEPARATE SERVICES FROM CONTROLLERS?
 * If you ever want to test the "create a document" logic, you can call
 * documentService.create() directly — no HTTP server needed. You can also
 * swap Express for another framework without rewriting any business logic.
 *
 * ─────────────────────────────────────────────────────────────────
 * WHAT THIS FILE EXPORTS
 * ─────────────────────────────────────────────────────────────────
 *   create(data)          — save to MongoDB + index in Elasticsearch
 *   list(page, limit)     — paginated list from MongoDB
 *   getById(id)           — fetch one document by its MongoDB _id
 *   delete(id)            — remove from MongoDB + Elasticsearch + cache
 */

'use strict';

// The Mongoose model — our interface to the MongoDB "documents" collection
const Document = require('../models/Document');

// The Elasticsearch client — our interface to the search engine
const { esClient } = require('../config/elasticsearch');

// Cache invalidation helper — clears stale search results from Redis
const { invalidatePattern } = require('../utils/cacheManager');

// Custom error classes — thrown when something goes wrong so the
// global errorHandler middleware can send the right HTTP status code
const { NotFoundError, InternalError } = require('../utils/errors');

// The Elasticsearch index name — must match the one created in elasticsearch.js
const INDEX_NAME = 'documents';

// ─────────────────────────────────────────────────────────────────────────────
// create(data)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Save a new document to MongoDB and index it in Elasticsearch.
 *
 * STEP-BY-STEP FLOW:
 *   1. Save to MongoDB → get back the document with its generated _id
 *   2. Index in Elasticsearch using the same _id so both stores stay in sync
 *   3. If Elasticsearch fails → roll back the MongoDB write (delete the doc)
 *      and throw an InternalError so the client gets HTTP 500
 *   4. Store the Elasticsearch ID on the document (esId field) and save
 *   5. Invalidate all cached search results (they may now be stale)
 *   6. Return the saved document
 *
 * WHY ROLL BACK ON ES FAILURE?
 * If MongoDB succeeds but Elasticsearch fails, the document would be stored
 * but not searchable — an inconsistent state. Rolling back the MongoDB write
 * keeps both stores in sync and lets the client retry cleanly.
 *
 * @param {{ title: string, content: string, category?: string }} data
 * @returns {Promise<Document>} The saved Mongoose document
 * @throws {InternalError} If Elasticsearch indexing fails
 */
async function create(data) {
  const { title, content, category } = data;

  // ── Step 1: Save to MongoDB ──────────────────────────────────────────────
  // Document.create() inserts a new record and returns the saved document
  // with its auto-generated _id, createdAt, and any defaults applied.
  const doc = await Document.create(data);

  // ── Step 2: Index in Elasticsearch ──────────────────────────────────────
  // We use the MongoDB _id (converted to a string) as the Elasticsearch
  // document ID. This keeps both stores in sync — one ID for both.
  try {
    await esClient.index({
      index: INDEX_NAME,
      id: doc._id.toString(),
      document: {
        title,
        content,
        category: category || doc.category, // use the model default if not provided
        createdAt: doc.createdAt,
      },
    });
  } catch (esError) {
    // ── Step 3: Roll back MongoDB on ES failure ────────────────────────────
    // Elasticsearch indexing failed — delete the MongoDB document so we don't
    // end up with a document that exists in the database but can't be searched.
    console.error('[DocumentService] Elasticsearch indexing failed, rolling back MongoDB write:', esError.message);

    await Document.findByIdAndDelete(doc._id);

    // Throw an InternalError so the global errorHandler sends HTTP 500
    throw new InternalError('Elasticsearch indexing failed');
  }

  // ── Step 4: Store the ES ID on the document ──────────────────────────────
  // By convention esId === _id.toString(), but storing it explicitly makes it
  // easy to reference the Elasticsearch entry without recalculating.
  doc.esId = doc._id.toString();
  await doc.save();

  // ── Step 5: Invalidate cached search results ─────────────────────────────
  // Any cached search results may no longer be accurate now that a new
  // document exists. Wipe all keys that start with "search:" so the next
  // search re-queries Elasticsearch and gets fresh results.
  await invalidatePattern('search:*');

  // ── Step 6: Return the saved document ────────────────────────────────────
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// list(page, limit)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Return a paginated list of documents from MongoDB.
 *
 * PAGINATION EXPLAINED:
 *   If you have 100 documents and want page 3 with 10 per page:
 *     skip = (3 - 1) * 10 = 20   → skip the first 20 documents
 *     limit = 10                  → return the next 10
 *
 * We run two queries in parallel using Promise.all() for efficiency:
 *   - Document.find()          → the actual page of documents
 *   - Document.countDocuments() → the total count (for the client to know
 *                                  how many pages exist)
 *
 * .lean() converts Mongoose documents to plain JavaScript objects.
 * This is faster because Mongoose doesn't need to attach all its helper
 * methods to each object — we just need the raw data.
 *
 * @param {number} [page=1]   - Page number (1-based)
 * @param {number} [limit=10] - Number of documents per page
 * @returns {Promise<{ page: number, limit: number, total: number, data: object[] }>}
 */
async function list(page = 1, limit = 10) {
  // Calculate how many documents to skip to reach the requested page
  const skip = (page - 1) * limit;

  // Run both queries at the same time — no need to wait for one before starting the other
  const [data, total] = await Promise.all([
    Document.find().skip(skip).limit(limit).lean(),
    Document.countDocuments(),
  ]);

  return { page, limit, total, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// getById(id)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Fetch a single document from MongoDB by its _id.
 *
 * If the document doesn't exist, we throw a NotFoundError.
 * The global errorHandler will catch this and send HTTP 404 to the client.
 *
 * .lean() returns a plain object instead of a full Mongoose document —
 * faster and sufficient since we're just reading data.
 *
 * @param {string} id - The MongoDB document _id
 * @returns {Promise<object>} The document as a plain object
 * @throws {NotFoundError} If no document with that id exists
 */
async function getById(id) {
  const doc = await Document.findById(id).lean();

  // findById() returns null if no document matches — check for that
  if (!doc) {
    throw new NotFoundError('Document not found');
  }

  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// delete(id)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Delete a document from both MongoDB and Elasticsearch, then clear the cache.
 *
 * STEP-BY-STEP FLOW:
 *   1. Find the document in MongoDB (throw 404 if it doesn't exist)
 *   2. Delete from MongoDB
 *   3. Delete from Elasticsearch
 *   4. If Elasticsearch deletion fails → log the inconsistency and throw
 *      InternalError (the MongoDB record is already gone — this is a data
 *      inconsistency that needs attention, but we can't undo the MongoDB delete)
 *   5. Invalidate all cached search results
 *   6. Return a success message
 *
 * WHY CHECK EXISTENCE BEFORE DELETING?
 * findByIdAndDelete() returns null if the document doesn't exist, but it
 * doesn't throw. By checking first with findById(), we can throw a proper
 * NotFoundError (HTTP 404) before attempting any deletion.
 *
 * @param {string} id - The MongoDB document _id
 * @returns {Promise<{ message: string }>}
 * @throws {NotFoundError} If no document with that id exists
 * @throws {InternalError} If Elasticsearch deletion fails
 */
async function deleteDoc(id) {
  // ── Step 1: Verify the document exists ───────────────────────────────────
  const doc = await Document.findById(id);

  if (!doc) {
    throw new NotFoundError('Document not found');
  }

  // ── Step 2: Delete from MongoDB ──────────────────────────────────────────
  await Document.findByIdAndDelete(id);

  // ── Step 3 & 4: Delete from Elasticsearch ────────────────────────────────
  try {
    await esClient.delete({
      index: INDEX_NAME,
      id: id.toString(),
    });
  } catch (esError) {
    // The MongoDB record is already deleted. Log the inconsistency so an
    // operator can investigate and manually clean up Elasticsearch if needed.
    console.error(
      '[DocumentService] Elasticsearch deletion failed after MongoDB deletion. ' +
      `Document ID: ${id}. Manual ES cleanup may be required. Error: ${esError.message}`
    );

    // Throw InternalError so the client gets HTTP 500
    throw new InternalError('Elasticsearch deletion failed');
  }

  // ── Step 5: Invalidate cached search results ─────────────────────────────
  // The deleted document should no longer appear in search results.
  // Clear all cached search responses so the next query re-fetches from ES.
  await invalidatePattern('search:*');

  // ── Step 6: Return success ───────────────────────────────────────────────
  return { message: 'Document deleted successfully' };
}

// Export all service functions.
// Note: we export `delete` as `deleteDoc` internally but expose it as `delete`
// because `delete` is a reserved keyword in JavaScript — we can't use it as
// a variable name, but we CAN use it as an object property key.
module.exports = {
  create,
  list,
  getById,
  delete: deleteDoc,
};
