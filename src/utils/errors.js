/**
 * Custom Error Classes for the Search Engine Backend
 *
 * WHY CUSTOM ERROR CLASSES?
 * ─────────────────────────
 * JavaScript's built-in `Error` only gives you a message and a stack trace.
 * That's fine for debugging, but HTTP APIs need more structure:
 *   - What HTTP status code should the client receive? (404? 400? 500?)
 *   - What machine-readable error code should the client parse? ("NOT_FOUND"?)
 *   - What field caused the problem? (for validation errors)
 *
 * By extending Error we keep all the good stuff (message, stack trace) and
 * add the extra properties our API needs.
 *
 * HOW THE errorHandler MIDDLEWARE USES THESE
 * ───────────────────────────────────────────
 * When any service or controller calls `next(err)`, Express routes the error
 * to the global errorHandler middleware (src/middlewares/errorHandler.js).
 * That middleware reads:
 *   - `err.statusCode` → sets the HTTP response status (e.g. res.status(404))
 *   - `err.code`       → puts the machine-readable code in the response body
 *   - `err.message`    → puts the human-readable message in the response body
 *   - `err.details`    → (ValidationError only) includes per-field error info
 *
 * The client always receives:
 *   { success: false, error: { code: "...", message: "..." } }
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// NotFoundError — HTTP 404
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Thrown when a requested resource does not exist.
 *
 * Use this when:
 *   - A document ID is not found in MongoDB (GET /api/documents/:id)
 *   - A DELETE targets an ID that doesn't exist
 *   - A client hits a URL that doesn't match any route (404 catch-all)
 *
 * Example:
 *   throw new NotFoundError('Document not found');
 *   // → HTTP 404, { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }
 */
class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    // Call the parent Error constructor so `this.message` is set correctly
    super(message);

    // Set the name to the class name so logs show "NotFoundError" instead of "Error"
    this.name = 'NotFoundError';

    // The HTTP status code the errorHandler will use for res.status()
    this.statusCode = 404;

    // Machine-readable code the client can switch on
    this.code = 'NOT_FOUND';

    // Capture a clean stack trace that starts at the call site, not inside this constructor
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NotFoundError);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ValidationError — HTTP 400
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Thrown when the client sends a request with invalid or missing data.
 *
 * Use this when:
 *   - A required field (title, content, q) is missing or empty
 *   - A field exceeds its maximum length
 *   - A date string is not valid ISO 8601
 *   - The validator middleware detects any schema violation
 *
 * The optional `details` array lets you report multiple field-level errors
 * at once, so the client knows exactly which fields to fix.
 *
 * @param {string} message   - Human-readable summary (e.g. "title is required")
 * @param {Array}  details   - Optional array of { field, message } objects
 *
 * Example:
 *   throw new ValidationError('Validation failed', [
 *     { field: 'title', message: 'title is required' },
 *     { field: 'content', message: 'content must not exceed 100000 characters' }
 *   ]);
 *   // → HTTP 400, { success: false, error: { code: 'VALIDATION_ERROR', message: '...' } }
 */
class ValidationError extends Error {
  constructor(message = 'Validation failed', details = []) {
    super(message);

    this.name = 'ValidationError';

    // HTTP 400 Bad Request — the client sent something wrong
    this.statusCode = 400;

    this.code = 'VALIDATION_ERROR';

    /**
     * Per-field error details.
     * Shape: Array<{ field: string, message: string }>
     *
     * Example:
     *   [
     *     { field: 'title', message: 'title is required' },
     *     { field: 'content', message: 'content exceeds maximum length' }
     *   ]
     *
     * The errorHandler can include this in the response so the client
     * knows exactly which fields to fix without guessing.
     */
    this.details = Array.isArray(details) ? details : [];

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// InternalError — HTTP 500
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Thrown when something unexpected goes wrong on the server side.
 *
 * Use this when:
 *   - Elasticsearch indexing fails after a MongoDB write (and the rollback ran)
 *   - Elasticsearch deletion fails after a MongoDB deletion (data inconsistency)
 *   - Any unrecoverable infrastructure failure that is NOT the client's fault
 *
 * IMPORTANT: The errorHandler will NEVER include the stack trace in the HTTP
 * response body — that would leak implementation details to attackers.
 * Stack traces are only written to the server logs (via Winston).
 *
 * Example:
 *   throw new InternalError('Elasticsearch indexing failed');
 *   // → HTTP 500, { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: '...' } }
 */
class InternalError extends Error {
  constructor(message = 'An internal server error occurred') {
    super(message);

    this.name = 'InternalError';

    // HTTP 500 Internal Server Error
    this.statusCode = 500;

    this.code = 'INTERNAL_SERVER_ERROR';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InternalError);
    }
  }
}

// Export all three classes so they can be imported anywhere in the codebase:
//   const { NotFoundError, ValidationError, InternalError } = require('../utils/errors');
module.exports = { NotFoundError, ValidationError, InternalError };
