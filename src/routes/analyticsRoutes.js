/**
 * analyticsRoutes.js — URL-to-controller mapping for Analytics endpoints
 *
 * ─────────────────────────────────────────────────────────────────
 * WHAT IS A ROUTER?
 * ─────────────────────────────────────────────────────────────────
 * Express.Router() creates a mini-application that handles a subset of
 * routes. Think of it as a "sub-app" that only knows about /api/analytics.
 *
 * In app.js we mount this router like:
 *   app.use('/api/analytics', analyticsRoutes);
 *
 * So when a request comes in for POST /api/analytics/click, Express strips
 * the "/api/analytics" prefix and hands the remaining path "/click" to this
 * router. The router then matches it to the POST /click handler below.
 *
 * ─────────────────────────────────────────────────────────────────
 * MIDDLEWARE CHAIN (left to right)
 * ─────────────────────────────────────────────────────────────────
 * Each route can have middleware functions that run before the controller.
 * They run in order, left to right. If any middleware calls next(err),
 * the chain stops and the error goes to the global errorHandler.
 *
 * POST /click   → validateTrackClick → trackClick
 *                 (require queryId,    (save ClickEvent → respond 201)
 *                  documentId)
 *
 * GET /popular  → getPopularQueries
 *                 (run aggregation → respond 200)
 *
 * GET /history  → getSearchHistory
 *                 (require userId → query history → respond 200)
 *
 * ─────────────────────────────────────────────────────────────────
 * ROUTES DEFINED HERE
 * ─────────────────────────────────────────────────────────────────
 *   POST /click   → record a user clicking on a search result
 *   GET  /popular → return the top 10 most-searched queries
 *   GET  /history → return the last 20 searches for a specific user
 */

'use strict';

// Express Router — creates a modular, mountable route handler
const { Router } = require('express');

// validateTrackClick: Joi-based middleware that checks queryId and documentId
// are present in the request body before the controller runs
const { validateTrackClick } = require('../middlewares/validator');

// The three controller functions — each handles one HTTP operation
const {
  trackClick,
  getPopularQueries,
  getSearchHistory,
} = require('../controllers/analyticsController');

// Create the router instance
const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analytics/click
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Record a click event — a user clicked on a search result.
 *
 * Middleware chain:
 *   1. validateTrackClick — ensures queryId and documentId are present
 *   2. trackClick         — saves the ClickEvent to MongoDB, responds 201
 *
 * Request body: { queryId: string, documentId: string, userId?: string }
 * Success: HTTP 201 with { success: true, data: { _id, queryId, documentId, userId, clickedAt } }
 * Errors:  HTTP 400 if queryId or documentId is missing
 */
router.post('/click', validateTrackClick, trackClick);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/popular
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Return the top 10 most-searched query strings.
 *
 * No middleware needed — this is a read-only operation with no input to validate.
 * The service runs a MongoDB aggregation pipeline to count and rank queries.
 *
 * Success: HTTP 200 with { success: true, data: [{ query: string, count: number }, ...] }
 * Errors:  HTTP 500 if the MongoDB aggregation fails
 */
router.get('/popular', getPopularQueries);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/history
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Return the 20 most recent search events for a specific user.
 *
 * The userId is passed as a query parameter: ?userId=user123
 * The controller validates that userId is present (returns 400 if missing).
 *
 * Query params: ?userId=<id> (required)
 * Success: HTTP 200 with { success: true, data: [...SearchEvent objects...] }
 * Errors:  HTTP 400 if userId query parameter is missing
 */
router.get('/history', getSearchHistory);

// Export the router so app.js can mount it:
//   const analyticsRoutes = require('./routes/analyticsRoutes');
//   app.use('/api/analytics', analyticsRoutes);
module.exports = router;
