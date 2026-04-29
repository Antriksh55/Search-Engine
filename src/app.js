'use strict';

/**
 * app.js — Express Application Setup
 *
 * This file is responsible for WIRING TOGETHER all the pieces of the Express app:
 * middleware (security, logging, rate limiting) and routes (documents, search, analytics).
 *
 * Think of this file as the "blueprint" of the app. It does NOT start the server —
 * that's server.js's job. This separation makes it easy to test the app without
 * actually binding to a port.
 *
 * MIDDLEWARE ORDER MATTERS:
 * Express runs middleware top-to-bottom in the order you call app.use().
 * Security headers should come first (before any response is sent).
 * The error handler MUST come last — it only catches errors passed via next(err).
 */

const express = require('express');
const path = require('path');

/**
 * helmet — Security Headers Middleware
 *
 * Helmet automatically sets ~14 HTTP response headers that protect against
 * common web vulnerabilities:
 *   - X-Content-Type-Options: prevents MIME-type sniffing attacks
 *   - X-Frame-Options: prevents clickjacking (embedding your site in an iframe)
 *   - Content-Security-Policy: restricts which scripts/styles can run
 *   - Strict-Transport-Security: forces HTTPS connections
 *   - ...and more
 *
 * Without helmet, browsers may be tricked into executing malicious content.
 * It's a one-liner that gives you a lot of security for free.
 */
const helmet = require('helmet');

/**
 * cors — Cross-Origin Resource Sharing Middleware
 *
 * By default, browsers block JavaScript from making requests to a different
 * domain than the page it's on (the "same-origin policy"). For example, a
 * frontend at https://myapp.com cannot call https://api.myapp.com without CORS.
 *
 * cors() adds the necessary response headers (e.g., Access-Control-Allow-Origin)
 * to tell browsers: "Yes, this API allows requests from other origins."
 *
 * This is essential when your frontend and backend are on different domains/ports.
 */
const cors = require('cors');

// Middleware imports — each handles a specific cross-cutting concern
const { requestLogger } = require('./middlewares/logger');
const { globalLimiter } = require('./middlewares/rateLimiter');
const { errorHandler } = require('./middlewares/errorHandler');

// NotFoundError is used in the 404 catch-all below
const { NotFoundError } = require('./utils/errors');

// Route handlers — each file groups related endpoints together
const documentRoutes = require('./routes/documentRoutes');
const searchRoutes = require('./routes/searchRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

// Create the Express application instance
const app = express();

// ─── GLOBAL MIDDLEWARE ────────────────────────────────────────────────────────
// These run for EVERY request, in the order they are registered.

// 1. Security headers — should be first so every response gets them
app.use(helmet({
  contentSecurityPolicy: false, // disabled so frontend inline scripts work
}));

// 2. CORS — allow cross-origin requests from frontend apps on different domains
app.use(cors({
  exposedHeaders: ['X-Cache']
}));

// 3. Serve static frontend files from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// 3. JSON body parser — parses incoming request bodies with Content-Type: application/json
//    Without this, req.body would be undefined for POST/PUT requests.
app.use(express.json());

// 4. Request logger — logs method, URL, status code, response time, and IP as JSON
app.use(requestLogger);

// 5. Global rate limiter — 100 requests per 15 minutes per IP address
//    Applied here so ALL routes are protected, not just specific ones.
app.use(globalLimiter);

// ─── ROUTES ──────────────────────────────────────────────────────────────────
// Mount each router at its base path. Express will forward any request whose
// URL starts with the given path to the corresponding router file.

app.use('/api/documents', documentRoutes);   // POST /, GET /, GET /:id, DELETE /:id
app.use('/api/search', searchRoutes);         // GET /, GET /autocomplete
app.use('/api/analytics', analyticsRoutes);   // POST /click, GET /popular, GET /history

// ─── 404 CATCH-ALL ───────────────────────────────────────────────────────────
// If a request reaches this point, none of the routes above matched it.
// We create a NotFoundError and pass it to the error handler via next().
//
// WHY use next(err) instead of res.json() directly?
// Because the error handler below formats ALL errors consistently.
// Calling next(err) ensures the same { success: false, error: {...} } shape
// is used for 404s just like for 500s or validation errors.
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────────────────
// WHY must this be LAST?
//
// Express identifies error-handling middleware by its 4-parameter signature:
//   (err, req, res, next)
// It only invokes this middleware when next(err) is called somewhere upstream.
// If you register it before the routes, it won't catch route errors because
// those errors haven't been thrown yet when the middleware is registered.
//
// Rule: error handler always goes AFTER all routes and other middleware.
app.use(errorHandler);

module.exports = app;
