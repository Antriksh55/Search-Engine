/**
 * Document.js — Mongoose Model for stored documents
 *
 * What is Mongoose?
 * Mongoose is a library that lets you define the "shape" of data you store in
 * MongoDB. Think of a Schema as a blueprint: it says what fields a document
 * must have, what type each field is, and any rules (like "this field is
 * required" or "this field can't be longer than 500 characters").
 *
 * Once you define a Schema you wrap it in a Model. The Model is the object
 * you actually use in your code to create, read, update, and delete records.
 */

const mongoose = require('mongoose');

/**
 * DocumentSchema — describes the shape of a single document in the database.
 *
 * Each key below is a field name. The value is an object that tells Mongoose
 * the rules for that field.
 */
const DocumentSchema = new mongoose.Schema({
  /**
   * title — the headline or name of the document.
   * - type: String  → must be text, not a number or object
   * - required: true → MongoDB will reject the record if this is missing
   * - maxlength: 500 → can't be longer than 500 characters (Requirement 9.2)
   */
  title: {
    type: String,
    required: true,
    maxlength: 500,
  },

  /**
   * content — the full body text of the document.
   * - required: true  → must be provided
   * - maxlength: 100000 → up to 100,000 characters (~50 pages of text)
   */
  content: {
    type: String,
    required: true,
    maxlength: 100000,
  },

  /**
   * category — a label used to group documents (e.g. "programming", "news").
   * - default: 'general' → if the caller doesn't provide a category, MongoDB
   *   automatically sets it to 'general' so the field is never empty.
   */
  category: {
    type: String,
    default: 'general',
  },

  /**
   * esId — the Elasticsearch document ID for this record.
   * By convention we use the same value as MongoDB's _id so the two stores
   * stay in sync. Storing it here makes it easy to look up or reference the
   * Elasticsearch entry without an extra query.
   */
  esId: {
    type: String,
  },

  /**
   * createdAt — the timestamp when this document was saved.
   * - default: Date.now → Mongoose calls Date.now() automatically at insert
   *   time, so you never have to set this field manually.
   */
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Export the Model.
 *
 * mongoose.model('Document', DocumentSchema) does two things:
 *   1. Registers the schema under the name 'Document'.
 *   2. Returns a Model class you can use to query the 'documents' collection
 *      (Mongoose automatically lowercases and pluralises the name).
 *
 * Other files import this with:
 *   const Document = require('./models/Document');
 */
module.exports = mongoose.model('Document', DocumentSchema);
