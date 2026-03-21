/**
 * analyticsController.js — HTTP layer for Analytics endpoints
 *
 * ─────────────────────────────────────────────────────────────────
 * WHY ARE CONTROLLERS "THIN"?
 * ─────────────────────────────────────────────────────────────────
 * A controller's ONLY job is to:
 *   1. Extract data from the HTTP request (req.body, req.query, req.params)
 *   2. Call the appropriate service method with that data
 *   3. Send the HTTP response back to the client
 *
 * Controllers do NOT contain business logic. They don't know how MongoDB
 * aggregation pipelines work, how events are stored, or what "fire-and-forget"
 * means. All of that lives in analyticsService.js.
 *
 * WHY THIS SEPARATION?
 *   - Testability: You can test analyticsService.getPopular() without an HTTP server.
 *   - Flexibility: If you swap Express for another framework, you only rewrite
 *     the controllers — the services stay exactly the same.
 *   - Readability: Each file has one clear responsibility.
 *
 * ─────────────────────────────────────────────────────────────────
 * ERROR HANDLING PATTERN
 * ─────────────────────────────────────────────────────────────────
 * Every function wraps its logic in try/catch. If anything throws,
 * we call next(err). Express routes the error to the global errorHandler
 * middleware (src/middlewares/errorHandler.js), which sends the correct
 * HTTP status code and error body to the client.
 *
 * ─────────────────────────────────────────────────────────────────
 * EXPORTS
 * ─────────────────────────────────────────────────────────────────
 *   trackClick(req, res, next)        — handles POST /api/analytics/click
 *   getPopularQueries(req, res, next) — handles GET  /api/analytics/popular
 *   getSearchHistory(req, res, next)  — handles GET  /api/analytics/history
 */

'use strict';

// The service layer — contains all the real analytics business logic
const analyticsService = require('../services/analyticsService');

// ─────────────────────────────────────────────────────────────────────────────
// trackClick
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Handle POST /api/analytics/click
 *
 * Records that a user clicked on a specific search result. By the time this
 * function runs, the validateTrackClick middleware has already verified that
 * queryId and documentId are present in req.body.
 *
 * On success: responds with HTTP 201 (Created) and the saved click event
 * On failure: passes the error to next() → errorHandler sends the right status
 *
 * @param {object}   req  - Express request (req.body = { queryId, documentId, userId? })
 * @param {object}   res  - Express response
 * @param {Function} next - Express next function (used to forward errors)
 */
async function trackClick(req, res, next) {
  try {
    // Extract the three fields from the request body.
    // queryId and documentId are required (validated by middleware).
    // userId is optional — if not provided, the ClickEvent model defaults to 'anonymous'.
    const { queryId, documentId, userId } = req.body;

    // Call the service to save the click event to MongoDB.
    // We AWAIT this because we want to confirm the event was saved before
    // responding with 201 — the client is waiting for this confirmation.
    const event = await analyticsService.recordClick(queryId, documentId, userId);

    // HTTP 201 Created — the standard status code for a successfully created resource
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    // Forward any error (MongoDB failure, unexpected exception, etc.) to errorHandler
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getPopularQueries
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Handle GET /api/analytics/popular
 *
 * Returns the top 10 most-searched query strings, ordered by frequency
 * (most searched first). Uses a MongoDB aggregation pipeline under the hood.
 *
 * No request parameters needed — this is a global aggregate across all users.
 *
 * On success: responds with HTTP 200 and an array of { query, count } objects
 * On failure: passes the error to next()
 *
 * @param {object}   req  - Express request (no params needed)
 * @param {object}   res  - Express response
 * @param {Function} next - Express next function
 */
async function getPopularQueries(req, res, next) {
  try {
    // Call the service — it runs a MongoDB aggregation pipeline and returns
    // an array like: [{ query: 'javascript', count: 42 }, ...]
    const queries = await analyticsService.getPopular();

    // HTTP 200 OK — the standard status code for a successful read operation
    res.status(200).json({ success: true, data: queries });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getSearchHistory
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Handle GET /api/analytics/history
 *
 * Returns the 20 most recent search events for a specific user, ordered
 * by most recent first. The userId is passed as a query parameter:
 *   GET /api/analytics/history?userId=user123
 *
 * We validate userId here in the controller (rather than in a middleware)
 * because it's a simple required-field check that doesn't need a full
 * Joi schema — keeping the code concise.
 *
 * On success: responds with HTTP 200 and an array of search event objects
 * On failure: responds with HTTP 400 if userId is missing, or passes other
 *             errors to next()
 *
 * @param {object}   req  - Express request (req.query.userId = the user ID)
 * @param {object}   res  - Express response
 * @param {Function} next - Express next function
 */
async function getSearchHistory(req, res, next) {
  try {
    // Extract userId from the query string: ?userId=user123
    const userId = req.query.userId;

    // userId is required — without it we don't know whose history to fetch.
    // We return 400 (Bad Request) with a structured error body that matches
    // the API's standard error format: { success: false, error: { code, message } }
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'userId query parameter is required',
        },
      });
    }

    // Call the service — it queries MongoDB for the user's recent searches
    // and returns an array of SearchEvent documents (plain objects via .lean())
    const history = await analyticsService.getHistory(userId);

    // HTTP 200 OK — successful read
    res.status(200).json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
}

// Export all three controller functions so they can be imported in the route file:
//   const { trackClick, getPopularQueries, getSearchHistory }
//     = require('../controllers/analyticsController');
module.exports = { trackClick, getPopularQueries, getSearchHistory };
