/**
 * SearchEvent.js — Mongoose Model for logging every search a user performs
 *
 * Why do we log searches?
 * Recording every search lets us answer questions like:
 *   - "What are the 10 most popular search terms this week?" (analytics)
 *   - "What did user X search for recently?" (search history)
 *   - "How many results did a query return on average?" (quality monitoring)
 *
 * These events are written asynchronously (fire-and-forget) so they never
 * slow down the actual search response the user is waiting for.
 */

const mongoose = require('mongoose');

/**
 * SearchEventSchema — the blueprint for a single search event record.
 */
const SearchEventSchema = new mongoose.Schema({
  /**
   * query — the exact search term the user typed in.
   * Example: "javascript async await tutorial"
   * - required: true → a search event without a query string is meaningless
   */
  query: {
    type: String,
    required: true,
  },

  /**
   * filters — any extra parameters the user applied to narrow the search.
   * Examples: { category: 'programming', date_from: '2024-01-01', sort: 'date_desc' }
   * - type: Object → a flexible key-value store; the shape can vary per search
   * - default: {} → if no filters were applied, store an empty object rather
   *   than null so downstream code can always safely read filter properties
   */
  filters: {
    type: Object,
    default: {},
  },

  /**
   * resultCount — how many documents Elasticsearch returned for this query.
   * Storing this lets us spot queries that return zero results — a signal
   * that we might need more documents or better search tuning.
   * - default: 0 → safe fallback if the count isn't provided
   */
  resultCount: {
    type: Number,
    default: 0,
  },

  /**
   * userId — identifies who performed the search.
   * - default: 'anonymous' → unauthenticated users are still tracked so we
   *   can see overall search trends, just without a personal identifier.
   */
  userId: {
    type: String,
    default: 'anonymous',
  },

  /**
   * searchedAt — the timestamp when the search was executed.
   * - default: Date.now → automatically set at insert time.
   *   Used to sort search history (most recent first) and to filter events
   *   by time range in analytics queries.
   */
  searchedAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Export the Model.
 *
 * Creates (or reuses) the 'searchevents' collection in MongoDB.
 *
 * Usage in other files:
 *   const SearchEvent = require('./models/SearchEvent');
 *   await SearchEvent.create({ query, filters, resultCount, userId });
 */
module.exports = mongoose.model('SearchEvent', SearchEventSchema);
