/**
 * ClickEvent.js — Mongoose Model for tracking which search results users click
 *
 * Why do we track clicks?
 * Every time a user clicks on a search result we record it. Over time this
 * data tells us which documents are most useful for which queries, helping us
 * improve search relevance and understand user behaviour.
 *
 * Each ClickEvent ties together:
 *   - the search query that produced the result (queryId)
 *   - the document the user chose to open (documentId)
 *   - who clicked it (userId)
 *   - when they clicked it (clickedAt)
 */

const mongoose = require('mongoose');

/**
 * ClickEventSchema — the blueprint for a single click event record.
 */
const ClickEventSchema = new mongoose.Schema({
  /**
   * queryId — the ID of the search query that led to this click.
   * When a user searches, we generate a unique ID for that search session.
   * Storing it here lets us later ask "which documents were clicked after
   * search query X?" — useful for analytics and relevance tuning.
   * - required: true → every click must be linked to a query
   */
  queryId: {
    type: String,
    required: true,
  },

  /**
   * documentId — the ID of the document the user clicked on.
   * This is the MongoDB _id (or Elasticsearch _id) of the Document record.
   * - required: true → we must know which document was clicked
   */
  documentId: {
    type: String,
    required: true,
  },

  /**
   * userId — identifies who performed the click.
   * - default: 'anonymous' → if the user is not logged in (or the client
   *   doesn't send a userId), we still record the event but label it
   *   'anonymous' so we don't lose the data.
   */
  userId: {
    type: String,
    default: 'anonymous',
  },

  /**
   * clickedAt — the exact moment the click happened.
   * - default: Date.now → automatically set to the current time when the
   *   record is created. No manual timestamp needed.
   */
  clickedAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Export the Model.
 *
 * This creates (or reuses) the 'clickevents' collection in MongoDB and gives
 * us a Model class to save and query click events.
 *
 * Usage in other files:
 *   const ClickEvent = require('./models/ClickEvent');
 *   await ClickEvent.create({ queryId, documentId, userId });
 */
module.exports = mongoose.model('ClickEvent', ClickEventSchema);
