/**
 * searchRoutes.js — URL-to-controller mapping for Search endpoints
 *
 * ─────────────────────────────────────────────────────────────────
 * WHAT IS A ROUTER?
 * ─────────────────────────────────────────────────────────────────
 * Express.Router() creates a mini-application that handles a subset of
 * routes. Think of it as a "sub-app" that only knows about /api/search.
 *
 * In app.js we mount this router like:
 *   app.use('/api/search', searchRoutes);
 *
 * So when a request comes in for GET /api/search?q=nodejs, Express strips
 * the "/api/search" prefix and hands the remaining path "/" to this router.
 * The router then matches it to the GET / handler below.
 *
 * ─────────────────────────────────────────────────────────────────
 * ⚠️  CRITICAL: WHY autocomplete MUST BE REGISTERED BEFORE GET /
 * ─────────────────────────────────────────────────────────────────
 * Express matches routes in the ORDER they are registered. It stops at
 * the FIRST match and runs that handler.
 *
 * If we registered GET / BEFORE GET /autocomplete, then a request for
 * GET /api/search/autocomplete?q=nod would be matched by GET / first
 * (because Express sees "/autocomplete" as a path that starts with "/").
 *
 * Wait — actually Express uses exact path matching for Router, so "/" only
 * matches exactly "/". BUT the real danger is with wildcard or param routes
 * like GET /:something — if we had that, it would swallow /autocomplete.
 *
 * The SAFE and CONVENTIONAL practice is: always register more specific
 * routes (like /autocomplete) BEFORE less specific ones (like /).
 * This prevents any future addition of a param route (e.g., /:id) from
 * accidentally capturing /autocomplete requests.
 *
 * Rule of thumb: specific routes first, generic routes last.
 *
 * ─────────────────────────────────────────────────────────────────
 * MIDDLEWARE CHAIN (left to right)
 * ─────────────────────────────────────────────────────────────────
 * Each route has middleware functions that run before the controller.
 * They run in order, left to right. If any middleware calls next(err),
 * the chain stops and the error goes to the global errorHandler.
 *
 * GET /autocomplete → validateAutocomplete → autocomplete
 *                     (require q param)      (query ES suggester)
 *
 * GET /             → validateSearch        → search
 *                     (require q, validate   (check cache → ES → respond)
 *                      dates, coerce types)
 *
 * ─────────────────────────────────────────────────────────────────
 * ROUTES DEFINED HERE
 * ─────────────────────────────────────────────────────────────────
 *   GET /autocomplete → return up to 10 title suggestions for a prefix
 *   GET /             → full-text search with pagination, filters, highlights
 */

'use strict';

// Express Router — creates a modular, mountable route handler
const { Router } = require('express');

// Validation middleware:
//   validateSearch       — requires q, validates dates, coerces page/limit
//   validateAutocomplete — requires q (the prefix to complete)
const { validateSearch, validateAutocomplete } = require('../middlewares/validator');

// Controller functions — each handles one HTTP operation
const { search, autocomplete } = require('../controllers/searchController');

// Create the router instance
const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/search/autocomplete
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Return autocomplete suggestions for a given prefix.
 *
 * ⚠️  REGISTERED FIRST — must come before GET / to avoid route conflicts.
 * If a param route like GET /:something were added later, it would match
 * /autocomplete before this handler if this were registered after it.
 * Always register specific paths before generic ones.
 *
 * Middleware chain:
 *   1. validateAutocomplete — ensures `q` is present and non-empty
 *   2. autocomplete         — queries the Elasticsearch completion suggester
 *
 * Query params: ?q=<prefix> (required)
 * Success: HTTP 200 with { success: true, data: [{ text, score }, ...] }
 * Errors:  HTTP 400 if `q` is missing
 */
router.get('/autocomplete', validateAutocomplete, autocomplete);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/search
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Execute a full-text search with optional filters, pagination, and highlights.
 *
 * Registered AFTER /autocomplete — this is the generic catch-all for the
 * search namespace. More specific routes (like /autocomplete) must come first.
 *
 * Middleware chain:
 *   1. validateSearch — requires `q`, validates date params, coerces page/limit
 *   2. search         — checks Redis cache → queries Elasticsearch → caches result
 *
 * Query params:
 *   q         (required) — search keyword
 *   page      (optional, default 1)    — page number
 *   limit     (optional, default 10)   — results per page
 *   highlight (optional, default false) — include highlighted snippets
 *   sort      (optional, default _score) — '_score', 'date_asc', 'date_desc'
 *   category  (optional) — filter by exact category value
 *   date_from (optional) — ISO 8601 date, filter results after this date
 *   date_to   (optional) — ISO 8601 date, filter results before this date
 *
 * Success: HTTP 200 with { success: true, page, limit, total, data: [...] }
 *          Response header: X-Cache: HIT or X-Cache: MISS
 * Errors:  HTTP 400 if `q` is missing or dates are invalid
 */
router.get('/', validateSearch, search);

// Export the router so app.js can mount it:
//   const searchRoutes = require('./routes/searchRoutes');
//   app.use('/api/search', searchRoutes);
module.exports = router;
