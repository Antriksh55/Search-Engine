/**
 * analyticsService.js — Business logic for recording and querying analytics data
 *
 * ─────────────────────────────────────────────────────────────────
 * WHAT IS ANALYTICS?
 * ─────────────────────────────────────────────────────────────────
 * Analytics means collecting data about how users interact with your app
 * so you can answer questions like:
 *   - "What are the 10 most popular search terms this week?"
 *   - "What did user X search for recently?"
 *   - "Which search results do users actually click on?"
 *
 * We track two types of events:
 *   1. ClickEvent  — when a user clicks on a search result
 *   2. SearchEvent — when a user performs a search
 *
 * ─────────────────────────────────────────────────────────────────
 * WHAT IS FIRE-AND-FORGET?
 * ─────────────────────────────────────────────────────────────────
 * "Fire-and-forget" means we START an async operation but do NOT wait
 * for it to finish before continuing. We "fire" the task and "forget"
 * about it — we don't await the result.
 *
 * WHY do we use this for recordSearch?
 * When a user searches, they are waiting for their results. Recording
 * the search event to MongoDB is important for analytics, but it should
 * NEVER slow down the user's experience. So we kick off the database
 * write in the background and immediately return the search results.
 *
 * The trade-off: if the MongoDB write fails, we won't know about it
 * unless we add error logging inside the function. That's acceptable
 * for analytics data — losing one event is not critical.
 *
 * Compare to recordClick: clicks ARE awaited because the client expects
 * a 201 confirmation that the event was saved.
 *
 * ─────────────────────────────────────────────────────────────────
 * WHAT IS A MONGODB AGGREGATION PIPELINE?
 * ─────────────────────────────────────────────────────────────────
 * A MongoDB aggregation pipeline is a series of "stages" that transform
 * your data step by step — like an assembly line for data processing.
 *
 * Each stage takes the output of the previous stage as its input.
 * The stages we use in getPopular():
 *
 *   Stage 1 — $group:
 *     Groups all SearchEvent documents by their `query` field.
 *     For each unique query, it counts how many times it appeared.
 *     Think of it like: SELECT query, COUNT(*) FROM search_events GROUP BY query
 *
 *   Stage 2 — $sort:
 *     Sorts the grouped results by count, highest first (descending = -1).
 *     Think of it like: ORDER BY count DESC
 *
 *   Stage 3 — $limit:
 *     Keeps only the top 10 results.
 *     Think of it like: LIMIT 10
 *
 *   Stage 4 — $project:
 *     Reshapes the output documents. By default, $group produces
 *     { _id: 'javascript', count: 42 }. We rename _id to query so the
 *     output is { query: 'javascript', count: 42 } — cleaner for the client.
 *
 * ─────────────────────────────────────────────────────────────────
 * EXPORTS
 * ─────────────────────────────────────────────────────────────────
 *   recordClick(queryId, documentId, userId)           — save a ClickEvent
 *   recordSearch(query, filters, resultCount, userId)  — save a SearchEvent (fire-and-forget)
 *   getPopular()                                       — top 10 queries by frequency
 *   getHistory(userId)                                 — last 20 searches for a user
 */

'use strict';

// ClickEvent model — the Mongoose model for click tracking records
const ClickEvent = require('../models/ClickEvent');

// SearchEvent model — the Mongoose model for search tracking records
const SearchEvent = require('../models/SearchEvent');

// ─────────────────────────────────────────────────────────────────────────────
// recordClick
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Save a click event to MongoDB.
 *
 * Called when a user clicks on a search result. We AWAIT this operation
 * because the analytics controller responds with HTTP 201 to confirm the
 * event was persisted — the client is waiting for this confirmation.
 *
 * @param {string} queryId    - The ID of the search query that produced the result
 * @param {string} documentId - The ID of the document the user clicked on
 * @param {string} [userId]   - The user who clicked (defaults to 'anonymous' in the model)
 * @returns {Promise<object>} The saved ClickEvent document from MongoDB
 */
async function recordClick(queryId, documentId, userId) {
  // Create a new ClickEvent document and save it to MongoDB.
  // ClickEvent.create() is shorthand for: new ClickEvent({...}).save()
  // It returns the saved document including the auto-generated _id and clickedAt.
  const event = await ClickEvent.create({ queryId, documentId, userId });
  return event;
}

// ─────────────────────────────────────────────────────────────────────────────
// recordSearch
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Save a search event to MongoDB.
 *
 * ⚠️  FIRE-AND-FORGET: This function is called WITHOUT await by the caller
 * (searchService.js). That means the caller does NOT wait for this to finish.
 * The search results are returned to the user immediately, and this database
 * write happens in the background.
 *
 * WHY? Recording analytics should never slow down the user's search response.
 * If this write takes 50ms, the user shouldn't have to wait for it.
 *
 * The function is still async and still returns a Promise — it's just that
 * the caller chooses not to await it. If an error occurs here, it won't
 * crash the server (unhandled promise rejections are caught by Node.js),
 * but we lose that analytics event silently.
 *
 * @param {string} query       - The search term the user typed
 * @param {object} filters     - Any filters applied (category, date_from, etc.)
 * @param {number} resultCount - How many results Elasticsearch returned
 * @param {string} [userId]    - The user who searched (defaults to 'anonymous')
 * @returns {Promise<object>} The saved SearchEvent document (not awaited by caller)
 */
async function recordSearch(query, filters, resultCount, userId) {
  // Save the search event to MongoDB.
  // Even though the caller doesn't await this, the function still runs to
  // completion in the background — Node.js's event loop handles it.
  const event = await SearchEvent.create({ query, filters, resultCount, userId });
  return event;
}

// ─────────────────────────────────────────────────────────────────────────────
// getPopular
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Return the top 10 most-searched query strings.
 *
 * Uses a MongoDB aggregation pipeline to group all SearchEvents by their
 * `query` field, count occurrences, sort by count descending, and return
 * the top 10 as { query, count } objects.
 *
 * Example output:
 *   [
 *     { query: 'javascript tutorial', count: 142 },
 *     { query: 'node.js express',     count: 98  },
 *     ...
 *   ]
 *
 * @returns {Promise<Array<{ query: string, count: number }>>}
 */
async function getPopular() {
  // MongoDB aggregation pipeline — each object in the array is one "stage"
  const results = await SearchEvent.aggregate([
    // ── Stage 1: $group ──────────────────────────────────────────────────────
    // Group all documents by the `query` field.
    // _id: '$query' means "use the value of the query field as the group key".
    // For each group, count how many documents belong to it using $sum: 1
    // (add 1 for each document in the group).
    {
      $group: {
        _id: '$query',          // group key: the search term
        count: { $sum: 1 },     // count: increment by 1 for each document in the group
      },
    },

    // ── Stage 2: $sort ───────────────────────────────────────────────────────
    // Sort the groups by count, highest first.
    // -1 means descending (highest count first).
    // 1 would mean ascending (lowest count first).
    {
      $sort: { count: -1 },
    },

    // ── Stage 3: $limit ──────────────────────────────────────────────────────
    // Keep only the top 10 results.
    // Without this, we'd return ALL unique queries — potentially thousands.
    {
      $limit: 10,
    },

    // ── Stage 4: $project ────────────────────────────────────────────────────
    // Reshape the output documents.
    // After $group, each document looks like: { _id: 'javascript', count: 42 }
    // We want:                                { query: 'javascript', count: 42 }
    //
    // _id: 0       → exclude the _id field from the output
    // query: '$_id' → create a new field called 'query' with the value of _id
    // count: 1     → include the count field as-is
    {
      $project: {
        _id: 0,           // hide the _id field (we're renaming it to 'query')
        query: '$_id',    // rename _id → query for a cleaner API response
        count: 1,         // include the count field unchanged
      },
    },
  ]);

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// getHistory
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Return the 20 most recent search events for a specific user.
 *
 * Used to power a "search history" feature — showing the user what they
 * searched for recently, most recent first.
 *
 * .lean() is a Mongoose optimization: it returns plain JavaScript objects
 * instead of full Mongoose documents. Plain objects are faster to work with
 * and use less memory because they don't have Mongoose's extra methods
 * (like .save(), .toObject(), etc.) attached to them.
 *
 * @param {string} userId - The user whose search history to retrieve
 * @returns {Promise<Array<object>>} Array of SearchEvent documents (plain objects)
 */
async function getHistory(userId) {
  // Find all SearchEvents for this user, sorted by most recent first, limited to 20.
  //
  // .find({ userId })     → filter: only events where userId matches
  // .sort({ searchedAt: -1 }) → sort by searchedAt descending (newest first)
  // .limit(20)            → return at most 20 results
  // .lean()               → return plain JS objects instead of Mongoose documents
  //                         (faster and uses less memory)
  const history = await SearchEvent.find({ userId })
    .sort({ searchedAt: -1 })
    .limit(20)
    .lean();

  return history;
}

// Export all four functions so they can be imported in the controller:
//   const analyticsService = require('../services/analyticsService');
//   await analyticsService.recordClick(queryId, documentId, userId);
module.exports = { recordClick, recordSearch, getPopular, getHistory };
