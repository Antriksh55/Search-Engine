/**
 * documentController.js — HTTP layer for Document operations
 *
 * ─────────────────────────────────────────────────────────────────
 * WHY ARE CONTROLLERS "THIN"?
 * ─────────────────────────────────────────────────────────────────
 * A controller's ONLY job is to:
 *   1. Extract data from the HTTP request (req.body, req.params, req.query)
 *   2. Call the appropriate service method with that data
 *   3. Send the HTTP response back to the client
 *
 * Controllers do NOT contain business logic. They don't know how MongoDB
 * works, how Elasticsearch is queried, or how Redis is invalidated.
 * All of that lives in the service layer (documentService.js).
 *
 * WHY THIS SEPARATION?
 *   - Testability: You can test documentService.create() without an HTTP server.
 *   - Flexibility: If you swap Express for another framework, you only rewrite
 *     the controllers — the services stay exactly the same.
 *   - Readability: Each file has one clear responsibility. A new developer
 *     reading this file immediately understands: "this is just HTTP glue."
 *
 * ─────────────────────────────────────────────────────────────────
 * ERROR HANDLING PATTERN
 * ─────────────────────────────────────────────────────────────────
 * Every function wraps its logic in try/catch. If anything throws
 * (a NotFoundError, InternalError, or unexpected exception), we call
 * next(err). Express then routes the error to the global errorHandler
 * middleware (src/middlewares/errorHandler.js), which sends the correct
 * HTTP status code and error body to the client.
 *
 * This means controllers NEVER call res.status(500) directly — they
 * always delegate error responses to the errorHandler.
 */

'use strict';

// The service layer — contains all the real business logic
const documentService = require('../services/documentService');

// ─────────────────────────────────────────────────────────────────────────────
// createDocument
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Handle POST /api/documents
 *
 * The request body has already been validated and sanitized by the
 * validateCreateDocument middleware before this function runs.
 * So req.body is guaranteed to have valid title, content, and optional category.
 *
 * On success: responds with HTTP 201 (Created) and the new document
 * On failure: passes the error to next() → errorHandler sends the right status
 *
 * @param {object} req  - Express request (req.body = { title, content, category? })
 * @param {object} res  - Express response
 * @param {Function} next - Express next function (used to forward errors)
 */
async function createDocument(req, res, next) {
  try {
    // Call the service with the validated request body.
    // The service handles MongoDB + Elasticsearch + cache invalidation.
    const doc = await documentService.create(req.body);

    // HTTP 201 Created — the standard status code for a successful resource creation
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    // Forward any error (InternalError, unexpected exception, etc.) to errorHandler
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// listDocuments
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Handle GET /api/documents
 *
 * Supports optional pagination via query parameters:
 *   ?page=2&limit=20
 *
 * Defaults: page=1, limit=10 (if not provided or not a valid number)
 *
 * On success: responds with HTTP 200 and { success, page, limit, total, data }
 * On failure: passes the error to next()
 *
 * @param {object} req  - Express request (req.query = { page?, limit? })
 * @param {object} res  - Express response
 * @param {Function} next - Express next function
 */
async function listDocuments(req, res, next) {
  try {
    // parseInt() converts the query string "2" to the number 2.
    // The || fallback handles missing or non-numeric values (parseInt returns NaN).
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // The service returns { page, limit, total, data }
    const result = await documentService.list(page, limit);

    // Spread the result so the response shape is:
    // { success: true, page: 1, limit: 10, total: 42, data: [...] }
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getDocument
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Handle GET /api/documents/:id
 *
 * Fetches a single document by its MongoDB _id from the URL parameter.
 *
 * On success: responds with HTTP 200 and the document
 * On failure: if the document doesn't exist, the service throws NotFoundError
 *             → errorHandler sends HTTP 404
 *
 * @param {object} req  - Express request (req.params.id = the document ID)
 * @param {object} res  - Express response
 * @param {Function} next - Express next function
 */
async function getDocument(req, res, next) {
  try {
    // req.params.id is the :id segment from the URL, e.g. /api/documents/abc123
    const doc = await documentService.getById(req.params.id);

    res.status(200).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteDocument
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Handle DELETE /api/documents/:id
 *
 * Deletes a document from MongoDB and Elasticsearch, then clears the cache.
 *
 * On success: responds with HTTP 200 and a confirmation message
 * On failure: if the document doesn't exist, the service throws NotFoundError
 *             → errorHandler sends HTTP 404
 *             If Elasticsearch deletion fails, the service throws InternalError
 *             → errorHandler sends HTTP 500
 *
 * @param {object} req  - Express request (req.params.id = the document ID)
 * @param {object} res  - Express response
 * @param {Function} next - Express next function
 */
async function deleteDocument(req, res, next) {
  try {
    // The service returns { message: 'Document deleted successfully' }
    const result = await documentService.delete(req.params.id);

    // Spread the result so the response shape is:
    // { success: true, message: 'Document deleted successfully' }
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// Export all four controller functions so they can be imported in the route file:
//   const { createDocument, listDocuments, getDocument, deleteDocument }
//     = require('../controllers/documentController');
module.exports = { createDocument, listDocuments, getDocument, deleteDocument };
