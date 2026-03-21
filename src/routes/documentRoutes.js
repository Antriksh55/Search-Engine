/**
 * documentRoutes.js — URL-to-controller mapping for Document endpoints
 *
 * ─────────────────────────────────────────────────────────────────
 * WHAT IS A ROUTER?
 * ─────────────────────────────────────────────────────────────────
 * Express.Router() creates a mini-application that handles a subset of
 * routes. Think of it as a "sub-app" that only knows about /api/documents.
 *
 * In app.js we mount this router like:
 *   app.use('/api/documents', documentRoutes);
 *
 * So when a request comes in for POST /api/documents, Express strips the
 * "/api/documents" prefix and hands the remaining path "/" to this router.
 * The router then matches it to the POST / handler below.
 *
 * ─────────────────────────────────────────────────────────────────
 * MIDDLEWARE CHAIN (left to right)
 * ─────────────────────────────────────────────────────────────────
 * Each route can have multiple middleware functions before the controller.
 * They run in order, left to right. If any middleware calls next(err),
 * the chain stops and the error goes to the global errorHandler.
 *
 * POST /  →  strictLimiter  →  validateCreateDocument  →  createDocument
 *            (rate limit)      (validate + sanitize)      (save + respond)
 *
 * ─────────────────────────────────────────────────────────────────
 * ROUTES DEFINED HERE
 * ─────────────────────────────────────────────────────────────────
 *   POST   /   → create a new document
 *   GET    /   → list all documents (paginated)
 *   GET    /:id → get a single document by ID
 *   DELETE /:id → delete a document by ID
 */

'use strict';

// Express Router — creates a modular, mountable route handler
const { Router } = require('express');

// strictLimiter: 30 requests per 15 minutes per IP — applied only to POST
// (document creation is expensive: writes to MongoDB + Elasticsearch)
const { strictLimiter } = require('../middlewares/rateLimiter');

// validateCreateDocument: Joi-based middleware that checks title/content,
// strips HTML tags, and removes unknown fields before the controller runs
const { validateCreateDocument } = require('../middlewares/validator');

// The four controller functions — each handles one HTTP operation
const {
  createDocument,
  listDocuments,
  getDocument,
  deleteDocument,
} = require('../controllers/documentController');

// Create the router instance
const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/documents
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Create a new document.
 *
 * Middleware chain:
 *   1. strictLimiter       — enforce 30 req/15min per IP (protects write operations)
 *   2. validateCreateDocument — validate body, strip HTML, strip unknown fields
 *   3. createDocument      — save to MongoDB + index in Elasticsearch + respond 201
 *
 * Request body: { title: string, content: string, category?: string }
 * Success: HTTP 201 with { success: true, data: { _id, title, content, category, createdAt, esId } }
 * Errors:  HTTP 400 (validation), HTTP 429 (rate limit), HTTP 500 (ES failure)
 */
router.post('/', strictLimiter, validateCreateDocument, createDocument);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/documents
// ─────────────────────────────────────────────────────────────────────────────
/**
 * List all documents with pagination.
 *
 * No middleware needed — this is a read-only operation with no body to validate.
 * The controller handles the optional ?page and ?limit query parameters.
 *
 * Query params: ?page=1&limit=10 (both optional, defaults applied in controller)
 * Success: HTTP 200 with { success: true, page, limit, total, data: [...] }
 */
router.get('/', listDocuments);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/documents/:id
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Get a single document by its MongoDB _id.
 *
 * :id is a URL parameter — Express captures it as req.params.id.
 * Example: GET /api/documents/64a1b2c3d4e5f6a7b8c9d0e1
 *
 * Success: HTTP 200 with { success: true, data: { _id, title, content, ... } }
 * Errors:  HTTP 404 if the document doesn't exist
 */
router.get('/:id', getDocument);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/documents/:id
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Delete a document by its MongoDB _id.
 *
 * Removes the document from both MongoDB and Elasticsearch, then clears
 * all cached search results so stale data isn't served.
 *
 * Success: HTTP 200 with { success: true, message: 'Document deleted successfully' }
 * Errors:  HTTP 404 if the document doesn't exist, HTTP 500 if ES deletion fails
 */
router.delete('/:id', deleteDocument);

// Export the router so app.js can mount it:
//   const documentRoutes = require('./routes/documentRoutes');
//   app.use('/api/documents', documentRoutes);
module.exports = router;
