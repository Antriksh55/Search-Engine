/**
 * Request Logger Middleware
 * ─────────────────────────
 * WHAT IS STRUCTURED LOGGING?
 * Instead of writing plain text like "GET /api/search 200 45ms", we write
 * JSON objects like { "method": "GET", "url": "/api/search", "statusCode": 200,
 * "responseTime": 45, "ip": "127.0.0.1" }. JSON logs are machine-readable,
 * which means monitoring tools (Datadog, Splunk, CloudWatch) can parse them
 * automatically and let you filter/search/alert on specific fields.
 *
 * WHY WINSTON?
 * Winston is the most popular Node.js logging library. It supports:
 *   - Multiple "transports" (where logs go: console, file, HTTP endpoint, etc.)
 *   - Log levels (error, warn, info, debug) so you can filter noise
 *   - Formatters (JSON, colorized, timestamps, etc.)
 *
 * HOW THIS MIDDLEWARE WORKS:
 * 1. When a request arrives, we record the current time (start time).
 * 2. We attach a listener to the `res.on('finish')` event.
 *    The 'finish' event fires AFTER Express has sent the response headers
 *    and body to the client — so we know the final status code and can
 *    calculate how long the request took.
 * 3. Inside the 'finish' listener, we build a log entry and write it.
 * 4. For HTTP 500 errors, we also include the stack trace so developers
 *    can debug what went wrong.
 */

'use strict';

// Winston is the logging library. We destructure `createLogger`, `format`,
// and `transports` from it — these are the three things we need.
const { createLogger, format, transports } = require('winston');

// ─────────────────────────────────────────────────────────────────────────────
// Create the Winston logger instance
// ─────────────────────────────────────────────────────────────────────────────
/**
 * `createLogger` sets up a logger with:
 *   - level: 'info' → log everything at "info" level and above
 *     (info, warn, error — but NOT debug, which is too verbose for production)
 *   - format: JSON → each log entry is a JSON string on one line
 *   - transports: Console → write to stdout (process.stdout)
 *
 * WHY STDOUT ONLY?
 * In containerized environments (Docker, Kubernetes), the standard practice
 * is to write logs to stdout and let the container orchestrator collect them.
 * This keeps the app stateless — it doesn't need to manage log files.
 */
const logger = createLogger({
  // Minimum log level to record. 'info' means we capture info, warn, and error.
  level: 'info',

  // format.json() serializes the log entry as a JSON string.
  // This is what makes logs machine-readable.
  format: format.json(),

  // Transports define WHERE logs are written.
  // new transports.Console() writes to stdout (your terminal / container logs).
  transports: [
    new transports.Console(),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// requestLogger — the Express middleware function
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Express middleware that logs every HTTP request as a JSON entry.
 *
 * Log entry shape (always):
 *   { method, url, statusCode, responseTime, ip }
 *
 * Log entry shape (on HTTP 500):
 *   { method, url, statusCode, responseTime, ip, stack }
 *
 * @param {object}   req  - Express request object
 * @param {object}   res  - Express response object
 * @param {Function} next - Call this to pass control to the next middleware
 */
function requestLogger(req, res, next) {
  // Record the exact time this request arrived.
  // Date.now() returns milliseconds since the Unix epoch (Jan 1, 1970).
  // We'll subtract this from the finish time to get response duration.
  const startTime = Date.now();

  // ── Listen for the response to finish ──────────────────────────────────────
  // `res.on('finish', callback)` registers a listener that fires once Express
  // has finished writing the response to the network socket.
  // At this point, `res.statusCode` is set to the final HTTP status code.
  res.on('finish', () => {
    // Calculate how many milliseconds elapsed from request arrival to response sent
    const responseTime = Date.now() - startTime;

    // Build the base log entry with the five required fields
    const logEntry = {
      method: req.method,                    // e.g. "GET", "POST", "DELETE"
      url: req.originalUrl || req.url,       // e.g. "/api/search?q=nodejs"
      statusCode: res.statusCode,            // e.g. 200, 400, 404, 500
      responseTime,                          // milliseconds, e.g. 42
      ip: req.ip || req.socket.remoteAddress, // client IP address
    };

    // ── Special handling for HTTP 500 errors ──────────────────────────────────
    // When the server crashes or throws an unhandled error, we want the full
    // stack trace in the logs so developers can debug it.
    // We store the error on `res.locals.error` in the errorHandler middleware
    // (see errorHandler.js) so we can access it here.
    if (res.statusCode >= 500 && res.locals.error) {
      // Add the stack trace to the log entry (but NEVER to the HTTP response body)
      logEntry.stack = res.locals.error.stack || 'No stack trace available';
    }

    // Write the log entry using Winston.
    // We use 'info' level for all requests — the statusCode field tells us
    // whether it was a success or error without needing different log levels.
    logger.info(logEntry);
  });

  // ── Pass control to the next middleware ────────────────────────────────────
  // IMPORTANT: We must call next() so the request continues through the
  // middleware pipeline. If we forget this, the request hangs forever.
  next();
}

// Export the middleware function so it can be used in app.js:
//   const { requestLogger } = require('./middlewares/logger');
//   app.use(requestLogger);
//
// We also export the raw `logger` instance in case other parts of the app
// want to write their own log entries (e.g., services logging errors).
module.exports = { requestLogger, logger };
