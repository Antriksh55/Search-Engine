/**
 * searchController.js — HTTP layer for search and autocomplete endpoints
 *
 * ─────────────────────────────────────────────────────────────────
 * WHY ARE CONTROLLERS "THIN"?
 * ─────────────────────────────────────────────────────────────────
 * A controller's ONLY job is to:
 *   1. Extract data from the HTTP request (req.query, req.params, req.body)
 *   2. Call the appropriate service method with that data
 *   3. Send the HTTP response back to the client
 *
 * Controllers do NOT contain business logic. They don't know how
 * Elasticsearch queries are built, how Redis caching works, or how
 * analytics events are recorded. All of that lives in searchService.js.
 *
 * WHY THIS SEPARATION?
 *   - Testability: You can test searchService.search() without an HTTP server.
 *   - Flexibility: If you swap Express for another framework, you only
 *     rewrite the controllers — the services stay exactly the same.
 *   - Readability: Each file has one clear responsibility.
 *
 * ─────────────────────────────────────────────────────────────────
 * THE X-Cache HEADER
 * ─────────────────────────────────────────────────────────────────
 * We set a custom response header "X-Cache" to tell the client (and
 * any intermediate proxies) whether the result came from Redis cache
 * or from a fresh Elasticsearch query:
 *
 *   X-Cache: HIT  → result was served from Redis (fast, ~1ms)
 *   X-Cache: MISS → result was fetched from Elasticsearch (~10-50ms)
 *                   and is now cached for the next 300 seconds
 *
 * This is a common pattern used by CDNs (like Cloudflare, Varnish) and
 * is useful for debugging cache behavior in production.
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
 *   search(req, res, next)       — handles GET /api/search
 *   autocomplete(req, res, next) — handles GET /api/search/autocomplete
 */

'use strict';

// The service layer — contains all the real search and autocomplete logic
const searchService = require('../services/searchService');

// ─────────────────────────────────────────────────────────────────────────────
// search
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Handle GET /api/search
 *
 * By the time this function runs, the validateSearch middleware has already:
 *   - Verified that `q` is present
 *   - Coerced page/limit to integers with defaults applied
 *   - Validated date_from/date_to as ISO 8601 strings
 *   - Stripped unknown query parameters
 *
 * So req.query is guaranteed to be clean and valid.
 *
 * On success: responds with HTTP 200 and the search results
 * On failure: passes the error to next() → errorHandler sends the right status
 *
 * @param {object}   req  - Express request (req.query contains search params)
 * @param {object}   res  - Express response
 * @param {Function} next - Express next function (used to forward errors)
 */
async function search(req, res, next) {
  try {
    // Extract all search parameters from the query string.
    // These have already been validated and coerced by the validateSearch middleware.
    const { q, page, limit, highlight, sort, category, date_from, date_to } = req.query;

    // userId is optional — it may come from the query string if the client
    // sends it (e.g., for analytics tracking). It's not validated by the
    // search schema, so we read it directly from req.query.
    const { userId } = req.query;

    // Call the service with all parameters.
    // The service handles: cache check → ES query → analytics → cache write
    const result = await searchService.search({
      q,
      page,
      limit,
      highlight,
      sort,
      category,
      date_from,
      date_to,
      userId,
    });

    // Set the X-Cache header so the client knows whether this was a cache hit or miss.
    // result.cacheHit is true if the result came from Redis, false if from Elasticsearch.
    res.set('X-Cache', result.cacheHit ? 'HIT' : 'MISS');

    // Respond with HTTP 200 and the search results.
    // We explicitly pick the fields we want to expose — we don't spread `result`
    // directly because it contains `cacheHit` which is an internal flag, not
    // something the client needs to see in the response body.
    res.status(200).json({
      success: true,
      page: result.page,
      limit: result.limit,
      total: result.total,
      data: result.data,
    });
  } catch (err) {
    // Forward any error (Elasticsearch failure, unexpected exception, etc.)
    // to the global errorHandler middleware
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// autocomplete
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Handle GET /api/search/autocomplete
 *
 * By the time this function runs, the validateAutocomplete middleware has
 * already verified that `q` is present and non-empty.
 *
 * On success: responds with HTTP 200 and an array of up to 10 suggestions
 * On failure: passes the error to next() → errorHandler sends the right status
 *
 * @param {object}   req  - Express request (req.query.q = the prefix string)
 * @param {object}   res  - Express response
 * @param {Function} next - Express next function
 */
async function autocomplete(req, res, next) {
  try {
    // Extract the prefix the user has typed so far.
    // This has already been validated by the validateAutocomplete middleware.
    const { q } = req.query;

    // Call the service — it queries the Elasticsearch completion suggester
    // and returns an array of { text, score } objects (max 10 items)
    const suggestions = await searchService.autocomplete(q);

    // Respond with HTTP 200 and the suggestions array
    res.status(200).json({
      success: true,
      data: suggestions,
    });
  } catch (err) {
    // Forward any error to the global errorHandler middleware
    next(err);
  }
}

// Export both controller functions so they can be imported in the route file:
//   const { search, autocomplete } = require('../controllers/searchController');
module.exports = { search, autocomplete };
