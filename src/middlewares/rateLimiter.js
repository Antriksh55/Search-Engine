/**
 * Rate Limiter Middleware
 * ──────────────────────
 * WHAT IS RATE LIMITING?
 * Rate limiting controls how many requests a single IP address can make
 * within a given time window. Without it, a single bad actor could flood
 * your API with thousands of requests per second, crashing the server for
 * everyone else (a "denial of service" attack).
 *
 * HOW IT WORKS HERE:
 * We use the `express-rate-limit` package. It keeps a counter per IP address
 * in memory. Every time a request comes in, it increments that counter.
 * If the counter exceeds the limit before the window resets, it blocks the
 * request and returns HTTP 429 ("Too Many Requests").
 *
 * WE EXPORT TWO LIMITERS:
 *   - globalLimiter  → applied to ALL routes (100 req / 15 min)
 *   - strictLimiter  → applied only to POST /api/documents (30 req / 15 min)
 *
 * WHY A STRICTER LIMIT ON DOCUMENT CREATION?
 * Writing to MongoDB + Elasticsearch is much more expensive than a read.
 * We protect it with a tighter limit to prevent write-heavy abuse.
 */

'use strict';

// `rateLimit` is the factory function from express-rate-limit.
// We call it with a config object and it returns an Express middleware function.
const rateLimit = require('express-rate-limit');

// ─────────────────────────────────────────────────────────────────────────────
// Shared handler — called whenever a client exceeds the limit
// ─────────────────────────────────────────────────────────────────────────────
/**
 * This function runs when a client has sent too many requests.
 *
 * @param {object} req  - Express request object
 * @param {object} res  - Express response object
 * @param {Function} next - Express next function (not used here, but required by signature)
 * @param {object} options - The rate limiter options (contains the limit config)
 */
function rateLimitExceededHandler(req, res, next, options) {
  // Calculate how many seconds remain until the rate limit window resets.
  // `req.rateLimit.resetTime` is a Date object set by express-rate-limit.
  // We subtract the current time and convert milliseconds → seconds.
  const resetTime = req.rateLimit && req.rateLimit.resetTime
    ? Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000)
    : 900; // fallback: 15 minutes in seconds

  // The Retry-After header tells the client exactly how long to wait before
  // trying again. This is part of the HTTP standard for 429 responses.
  res.setHeader('Retry-After', resetTime);

  // HTTP 429 = Too Many Requests
  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Too many requests from this IP. Please try again in ${resetTime} seconds.`,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// globalLimiter — 100 requests per 15 minutes per IP
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Applied to ALL routes in app.js.
 *
 * windowMs: 15 * 60 * 1000 = 900,000 milliseconds = 15 minutes
 * max: 100 requests allowed per window per IP
 */
const globalLimiter = rateLimit({
  // The time window in milliseconds (15 minutes)
  windowMs: 15 * 60 * 1000,

  // Maximum number of requests allowed per IP within the window
  max: 100,

  // Use the standard `RateLimit-*` headers (RFC 6585 compliant)
  // These headers tell the client how many requests they have left
  standardHeaders: true,

  // Disable the older `X-RateLimit-*` headers to avoid sending duplicate info
  legacyHeaders: false,

  // Our custom handler that sends the 429 response with Retry-After header
  handler: rateLimitExceededHandler,
});

// ─────────────────────────────────────────────────────────────────────────────
// strictLimiter — 30 requests per 15 minutes per IP
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Applied only to POST /api/documents (document creation).
 * Writing to MongoDB + Elasticsearch is expensive, so we protect it more.
 *
 * windowMs: 15 * 60 * 1000 = 900,000 milliseconds = 15 minutes
 * max: 30 requests allowed per window per IP
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  // Only 30 document creation requests per 15 minutes per IP
  max: 30,

  standardHeaders: true,
  legacyHeaders: false,

  // Same custom handler — sends 429 with Retry-After header
  handler: rateLimitExceededHandler,
});

// Export both limiters so they can be imported in route files and app.js:
//   const { globalLimiter, strictLimiter } = require('./middlewares/rateLimiter');
module.exports = { globalLimiter, strictLimiter };
