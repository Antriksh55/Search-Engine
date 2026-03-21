/**
 * Validation Middleware
 * ─────────────────────
 * WHAT IS INPUT VALIDATION?
 * Before your code does anything with data from a client (title, content,
 * search query, etc.), you need to check that it's safe and correct.
 * Without validation, a client could send:
 *   - An empty title → your database stores garbage
 *   - A 10MB content field → your server runs out of memory
 *   - HTML tags like <script>alert('xss')</script> → security vulnerability
 *   - Extra fields like { isAdmin: true } → privilege escalation attack
 *
 * WHY JOI?
 * Joi is a schema validation library. You describe the shape of valid data
 * using a JavaScript object (the "schema"), and Joi checks incoming data
 * against that schema. It gives you clear error messages and handles
 * type coercion (e.g., converting the string "1" to the number 1).
 *
 * HOW MIDDLEWARE FACTORIES WORK:
 * Instead of one big validation function, we export "factory functions" —
 * functions that RETURN a middleware function. This lets each route have
 * its own tailored validation logic while sharing the same pattern.
 *
 * Example:
 *   router.post('/', validateCreateDocument, createDocument);
 *   // validateCreateDocument is called, returns a middleware, Express runs it
 */

'use strict';

// Joi is the validation library
const Joi = require('joi');

// We import ValidationError so we can pass it to next() when validation fails.
// Express will route it to the global errorHandler middleware.
const { ValidationError } = require('../utils/errors');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: strip HTML tags from a string
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Removes all HTML tags from a string.
 *
 * The regex /<[^>]*>/g matches:
 *   <        → opening angle bracket
 *   [^>]*    → any characters that are NOT a closing angle bracket (the tag content)
 *   >        → closing angle bracket
 *   /g       → global flag: replace ALL occurrences, not just the first
 *
 * Examples:
 *   stripHtml('<b>Hello</b>')          → 'Hello'
 *   stripHtml('<script>alert(1)</script>') → 'alert(1)'
 *   stripHtml('No tags here')          → 'No tags here'
 *
 * @param {string} str - The input string (may contain HTML)
 * @returns {string} The string with all HTML tags removed
 */
function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: convert Joi validation errors to our { field, message } format
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Joi returns an error object with a `details` array. Each item in that array
 * describes one validation failure. We convert it to our standard format:
 *   [{ field: 'title', message: '"title" is not allowed to be empty' }]
 *
 * @param {object} joiError - The error object returned by Joi's validate()
 * @returns {Array<{ field: string, message: string }>}
 */
function formatJoiErrors(joiError) {
  return joiError.details.map((detail) => ({
    // `detail.path` is an array like ['title'] or ['date_from']
    // We join with '.' to handle nested paths like ['address', 'city'] → 'address.city'
    field: detail.path.join('.') || 'unknown',
    // `detail.message` is Joi's human-readable error description
    message: detail.message,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. validateCreateDocument
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Validates the request body for POST /api/documents.
 *
 * Rules:
 *   - title:   required, string, 1–500 characters, HTML stripped
 *   - content: required, string, 1–100,000 characters, HTML stripped
 *   - Unknown fields (e.g., isAdmin, __proto__) are silently removed
 *
 * On success: req.body is replaced with the validated + sanitized values
 * On failure: next(new ValidationError(...)) is called → errorHandler sends 400
 *
 * @returns {Function} Express middleware function
 */
function validateCreateDocument(req, res, next) {
  // Define the Joi schema for document creation
  const schema = Joi.object({
    // title must be a non-empty string, max 500 characters
    title: Joi.string()
      .min(1)
      .max(500)
      .required()
      .messages({
        'string.empty': 'title is required',
        'string.min': 'title must be at least 1 character',
        'string.max': 'title must not exceed 500 characters',
        'any.required': 'title is required',
      }),

    // content must be a non-empty string, max 100,000 characters
    content: Joi.string()
      .min(1)
      .max(100000)
      .required()
      .messages({
        'string.empty': 'content is required',
        'string.min': 'content must be at least 1 character',
        'string.max': 'content must not exceed 100000 characters',
        'any.required': 'content is required',
      }),

    // category is optional — if not provided, the model defaults to 'general'
    category: Joi.string().optional(),
  });

  // Validate req.body against the schema.
  // `stripUnknown: true` removes any fields not defined in the schema
  // (e.g., if the client sends { title, content, isAdmin: true }, isAdmin is removed)
  // `abortEarly: false` collects ALL errors instead of stopping at the first one
  const { error, value } = schema.validate(req.body, {
    stripUnknown: true,
    abortEarly: false,
  });

  // If Joi found validation errors, pass them to the error handler
  if (error) {
    const details = formatJoiErrors(error);
    return next(new ValidationError('Validation failed', details));
  }

  // Strip HTML tags from title and content AFTER Joi validation passes.
  // We do this after validation so Joi's length checks run on the original
  // string (before stripping), which is the safer approach.
  if (value.title) {
    value.title = stripHtml(value.title);
  }
  if (value.content) {
    value.content = stripHtml(value.content);
  }

  // Replace req.body with the validated + sanitized values.
  // The controller will read from req.body, so it gets clean data.
  req.body = value;

  // Pass control to the next middleware (the controller)
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. validateSearch
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Validates query parameters for GET /api/search.
 *
 * Rules:
 *   - q:         required, string, min 1 character
 *   - page:      optional integer, min 1, defaults to 1
 *   - limit:     optional integer, min 1, max 100, defaults to 10
 *   - highlight: optional boolean
 *   - sort:      optional, must be '_score', 'date_asc', or 'date_desc'
 *   - category:  optional string
 *   - date_from: optional ISO 8601 date string
 *   - date_to:   optional ISO 8601 date string
 *
 * On success: req.query is replaced with validated + coerced values
 * On failure: next(new ValidationError(...)) is called
 *
 * @returns {Function} Express middleware function
 */
function validateSearch(req, res, next) {
  // Define the Joi schema for search query parameters
  const schema = Joi.object({
    // q is the search keyword — required
    q: Joi.string()
      .min(1)
      .required()
      .messages({
        'string.empty': 'q (search query) is required',
        'string.min': 'q must be at least 1 character',
        'any.required': 'q (search query) is required',
      }),

    // page: coerce string "2" → number 2, default to 1 if not provided
    page: Joi.number()
      .integer()
      .min(1)
      .default(1)
      .messages({
        'number.base': 'page must be a number',
        'number.integer': 'page must be an integer',
        'number.min': 'page must be at least 1',
      }),

    // limit: coerce string "20" → number 20, default to 10, max 100
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10)
      .messages({
        'number.base': 'limit must be a number',
        'number.integer': 'limit must be an integer',
        'number.min': 'limit must be at least 1',
        'number.max': 'limit must not exceed 100',
      }),

    // highlight: coerce string "true" → boolean true
    highlight: Joi.boolean().optional(),

    // sort: must be one of these exact values
    sort: Joi.string()
      .valid('_score', 'date_asc', 'date_desc')
      .optional()
      .messages({
        'any.only': 'sort must be one of: _score, date_asc, date_desc',
      }),

    // category: any string, used for filtering
    category: Joi.string().optional(),

    // date_from: must be a valid ISO 8601 date string (e.g., "2024-01-15T10:00:00Z")
    // Joi.string().isoDate() validates the format without converting to a Date object,
    // which is what we want — we'll pass the string directly to Elasticsearch.
    date_from: Joi.string()
      .isoDate()
      .optional()
      .messages({
        'string.isoDate': 'date_from must be a valid ISO 8601 date string (e.g., 2024-01-15T10:00:00Z)',
      }),

    // date_to: same as date_from
    date_to: Joi.string()
      .isoDate()
      .optional()
      .messages({
        'string.isoDate': 'date_to must be a valid ISO 8601 date string (e.g., 2024-01-15T10:00:00Z)',
      }),
  });

  // Query parameters from URLs are always strings (e.g., page="2", highlight="true").
  // `convert: true` (the default) tells Joi to coerce types automatically.
  // `abortEarly: false` collects all errors at once.
  const { error, value } = schema.validate(req.query, {
    abortEarly: false,
    convert: true,       // coerce "2" → 2, "true" → true, etc.
    stripUnknown: true,  // remove any unrecognized query params
  });

  if (error) {
    const details = formatJoiErrors(error);
    return next(new ValidationError('Validation failed', details));
  }

  // Replace req.query with the validated + coerced values
  req.query = value;
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. validateAutocomplete
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Validates query parameters for GET /api/search/autocomplete.
 *
 * Rules:
 *   - q: required, string, min 1 character (the prefix to autocomplete)
 *
 * On success: req.query is replaced with validated values
 * On failure: next(new ValidationError(...)) is called
 *
 * @returns {Function} Express middleware function
 */
function validateAutocomplete(req, res, next) {
  const schema = Joi.object({
    // q is the prefix the user has typed so far — required
    q: Joi.string()
      .min(1)
      .required()
      .messages({
        'string.empty': 'q (search prefix) is required',
        'string.min': 'q must be at least 1 character',
        'any.required': 'q (search prefix) is required',
      }),
  });

  const { error, value } = schema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = formatJoiErrors(error);
    return next(new ValidationError('Validation failed', details));
  }

  req.query = value;
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. validateTrackClick
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Validates the request body for POST /api/analytics/click.
 *
 * Rules:
 *   - queryId:    required string (identifies which search query was active)
 *   - documentId: required string (identifies which result was clicked)
 *   - userId:     optional string (identifies the user; anonymous if omitted)
 *
 * On success: req.body is replaced with validated values
 * On failure: next(new ValidationError(...)) is called
 *
 * @returns {Function} Express middleware function
 */
function validateTrackClick(req, res, next) {
  const schema = Joi.object({
    // queryId identifies the search session (e.g., a UUID generated client-side)
    queryId: Joi.string()
      .required()
      .messages({
        'string.empty': 'queryId is required',
        'any.required': 'queryId is required',
      }),

    // documentId identifies which search result the user clicked
    documentId: Joi.string()
      .required()
      .messages({
        'string.empty': 'documentId is required',
        'any.required': 'documentId is required',
      }),

    // userId is optional — if not provided, the model defaults to 'anonymous'
    userId: Joi.string().optional(),
  });

  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = formatJoiErrors(error);
    return next(new ValidationError('Validation failed', details));
  }

  req.body = value;
  next();
}

// Export all four middleware functions so they can be imported in route files:
//   const { validateCreateDocument, validateSearch } = require('./middlewares/validator');
module.exports = {
  validateCreateDocument,
  validateSearch,
  validateAutocomplete,
  validateTrackClick,
};
