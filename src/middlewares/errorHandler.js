/**
 * Global Error Handler Middleware
 * ────────────────────────────────
 * WHAT IS A GLOBAL ERROR HANDLER?
 * In Express, when any middleware or controller calls `next(err)` with an
 * error object, Express skips all remaining regular middleware and jumps
 * directly to the error-handling middleware. An error-handling middleware
 * is identified by having EXACTLY 4 parameters: (err, req, res, next).
 *
 * WHY DO WE NEED THIS?
 * Without a global error handler, unhandled errors would either:
 *   1. Crash the Node.js process entirely (bad!)
 *   2. Leave the HTTP request hanging with no response (also bad!)
 *   3. Expose raw stack traces to clients (security risk!)
 *
 * This middleware catches ALL errors from the entire application and
 * converts them into a consistent, safe JSON response.
 *
 * CONSISTENT ERROR FORMAT:
 * Every error response — no matter what went wrong — looks like this:
 *   {
 *     "success": false,
 *     "error": {
 *       "code": "NOT_FOUND",
 *       "message": "Document not found"
 *     }
 *   }
 *
 * This predictability is important for API clients: they can always check
 * `response.error.code` to understand what went wrong, without parsing
 * different error formats for different endpoints.
 *
 * SECURITY NOTE:
 * Stack traces reveal your internal file structure, library versions, and
 * code logic — information attackers can use to find vulnerabilities.
 * We NEVER include stack traces in HTTP responses. They go to the server
 * logs only (where only developers can see them).
 */

'use strict';

// Import our custom error classes so we can check which type of error occurred.
// Each class has a `statusCode` and `code` property we use to build the response.
const { NotFoundError, ValidationError, InternalError } = require('../utils/errors');

// ─────────────────────────────────────────────────────────────────────────────
// errorHandler — the global Express error middleware
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Catches all errors passed via next(err) and sends a structured JSON response.
 *
 * Express identifies this as an error handler because it has 4 parameters.
 * Regular middleware has 3 (req, res, next). The extra `err` parameter at
 * the start is what makes Express treat this as an error handler.
 *
 * @param {Error}    err  - The error object (may be our custom class or a generic Error)
 * @param {object}   req  - Express request object
 * @param {object}   res  - Express response object
 * @param {Function} next - Express next function (required in signature, rarely called here)
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // ── Determine the HTTP status code ─────────────────────────────────────────
  // If the error is one of our custom classes, it has a `statusCode` property.
  // If it's an unknown/generic Error, we default to 500 (Internal Server Error).
  let statusCode = err.statusCode || 500;

  // ── Determine the error code ────────────────────────────────────────────────
  // Our custom error classes set a machine-readable `code` string.
  // For unknown errors, we use 'INTERNAL_SERVER_ERROR'.
  let code = err.code || 'INTERNAL_SERVER_ERROR';

  // ── Determine the error message ─────────────────────────────────────────────
  // Use the error's message if available, otherwise a generic fallback.
  let message = err.message || 'An unexpected error occurred';

  // ── Build the response body ─────────────────────────────────────────────────
  // Start with the base structure that ALL error responses share
  const responseBody = {
    success: false,
    error: {
      code,
      message,
    },
  };

  // ── Special handling for ValidationError ────────────────────────────────────
  // ValidationError may carry a `details` array with per-field error info.
  // We include it in the response so clients know exactly which fields to fix.
  //
  // Example response with details:
  //   {
  //     "success": false,
  //     "error": {
  //       "code": "VALIDATION_ERROR",
  //       "message": "Validation failed",
  //       "details": [
  //         { "field": "title", "message": "title is required" },
  //         { "field": "content", "message": "content must not exceed 100000 characters" }
  //       ]
  //     }
  //   }
  if (err instanceof ValidationError && Array.isArray(err.details) && err.details.length > 0) {
    responseBody.error.details = err.details;
  }

  // ── Handle unknown/unexpected errors ────────────────────────────────────────
  // If the error is NOT one of our known custom classes, it's an unexpected
  // error (e.g., a bug in our code, a library throwing an unexpected exception).
  // We normalize it to a 500 response and log it for debugging.
  const isKnownError = err instanceof NotFoundError
    || err instanceof ValidationError
    || err instanceof InternalError;

  if (!isKnownError) {
    // Override to ensure unknown errors always return 500
    statusCode = 500;
    code = 'INTERNAL_SERVER_ERROR';
    // Use a generic message — don't expose the raw error message from unknown errors
    // as it might contain sensitive implementation details
    message = 'An internal server error occurred';
    responseBody.error.code = code;
    responseBody.error.message = message;
  }

  // ── Log 500 errors to the console ───────────────────────────────────────────
  // For server errors (500), we log the full stack trace to the console.
  // This is the ONLY place the stack trace appears — never in the HTTP response.
  //
  // We also store the error on res.locals so the logger middleware (logger.js)
  // can include the stack trace in the structured log entry.
  if (statusCode >= 500) {
    // Store on res.locals so requestLogger can pick it up in the 'finish' event
    res.locals.error = err;

    // Also log directly here as a safety net (in case logger middleware isn't used)
    console.error('[ErrorHandler] 500 Error:', err.stack || err.message);
  }

  // ── Send the response ───────────────────────────────────────────────────────
  // Set the HTTP status code and send the JSON body.
  // Note: we NEVER include err.stack in the response body — that would be a
  // security vulnerability (information disclosure).
  res.status(statusCode).json(responseBody);
}

// Export the error handler so it can be mounted in app.js as the LAST middleware:
//   const { errorHandler } = require('./middlewares/errorHandler');
//   app.use(errorHandler); // Must be after all routes and other middleware
module.exports = { errorHandler };
