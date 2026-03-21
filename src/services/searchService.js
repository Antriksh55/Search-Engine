/**
 * searchService.js — Business logic for full-text search and autocomplete
 *
 * ─────────────────────────────────────────────────────────────────
 * WHERE DOES THIS FIT IN MVC?
 * ─────────────────────────────────────────────────────────────────
 * This is the SERVICE layer. It contains all the real search logic:
 *   - Building Elasticsearch queries
 *   - Checking and writing the Redis cache
 *   - Firing analytics events asynchronously
 *
 * The controller (searchController.js) calls these functions and
 * handles the HTTP request/response. The service never touches req or res.
 *
 * ─────────────────────────────────────────────────────────────────
 * WHAT IS A multi_match QUERY?
 * ─────────────────────────────────────────────────────────────────
 * A multi_match query searches across multiple fields at once.
 * Instead of saying "find 'nodejs' in title" OR "find 'nodejs' in content",
 * it says "find 'nodejs' in EITHER title OR content, and combine the scores."
 *
 * Example:
 *   { multi_match: { query: "nodejs", fields: ["title^3", "content^1"] } }
 *
 * The "^3" and "^1" are BOOST FACTORS (see below).
 *
 * ─────────────────────────────────────────────────────────────────
 * WHAT IS BOOSTING?
 * ─────────────────────────────────────────────────────────────────
 * Boosting tells Elasticsearch that a match in one field is MORE important
 * than a match in another field.
 *
 * "title^3" means: if the keyword appears in the title, multiply that
 * field's relevance score by 3. "content^1" means: content matches count
 * at their normal weight (×1, no change).
 *
 * Result: a document whose TITLE contains "nodejs" will rank higher than
 * a document whose CONTENT contains "nodejs" — which makes intuitive sense,
 * because a title match is a stronger signal of relevance.
 *
 * ─────────────────────────────────────────────────────────────────
 * WHAT IS THE COMPLETION SUGGESTER?
 * ─────────────────────────────────────────────────────────────────
 * The completion suggester is a special Elasticsearch feature designed
 * specifically for autocomplete. It stores a compact data structure called
 * a Finite State Transducer (FST) in memory, which allows it to find all
 * documents whose title STARTS WITH a given prefix in sub-millisecond time.
 *
 * Example: typing "nod" returns suggestions like "Node.js Tutorial",
 * "Node.js Best Practices", "Node.js vs Deno", etc.
 *
 * It uses the "title.suggest" field defined in the Elasticsearch mapping
 * (see src/config/elasticsearch.js).
 *
 * ─────────────────────────────────────────────────────────────────
 * WHY LAZY-IMPORT analyticsService?
 * ─────────────────────────────────────────────────────────────────
 * searchService and analyticsService would create a CIRCULAR DEPENDENCY
 * if both imported each other at the top of the file:
 *   searchService → analyticsService → (nothing, but Node.js gets confused)
 *
 * By importing analyticsService INSIDE the function body (lazy import),
 * we avoid the circular reference. Node.js has already fully loaded both
 * modules by the time the function runs, so the require() works fine.
 *
 * ─────────────────────────────────────────────────────────────────
 * EXPORTS
 * ─────────────────────────────────────────────────────────────────
 *   search(params)        — full-text search with caching + analytics
 *   autocomplete(prefix)  — prefix-based title suggestions
 */

'use strict';

// The Elasticsearch client — our interface to the search engine
const { esClient } = require('../config/elasticsearch');

// Cache helpers — check Redis before hitting Elasticsearch, and store results after
const { get, set, buildSearchKey } = require('../utils/cacheManager');

// The Elasticsearch index name — must match the one created in elasticsearch.js
const INDEX_NAME = 'documents';

// ─────────────────────────────────────────────────────────────────────────────
// search(params)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Execute a full-text search against Elasticsearch with caching.
 *
 * STEP-BY-STEP FLOW:
 *   1. Build a deterministic cache key from the query parameters
 *   2. Check Redis — if we have a cached result, return it immediately (cache HIT)
 *   3. Build the Elasticsearch bool query with multi_match + optional filters
 *   4. Add highlight block if highlight=true
 *   5. Add sort if sort=date_asc or sort=date_desc (default is _score desc)
 *   6. Execute the Elasticsearch query
 *   7. Map the raw ES hits into clean result objects
 *   8. Fire-and-forget: record the search event in analytics (non-blocking)
 *   9. Store the result in Redis with a 300-second TTL
 *  10. Return the result with cacheHit: false
 *
 * @param {object} params
 * @param {string}  params.q          - The search keyword (required)
 * @param {number}  [params.page=1]   - Page number for pagination
 * @param {number}  [params.limit=10] - Results per page
 * @param {boolean} [params.highlight=false] - Whether to include highlighted snippets
 * @param {string}  [params.sort='_score']   - Sort order: '_score', 'date_asc', 'date_desc'
 * @param {string}  [params.category]  - Filter by exact category value
 * @param {string}  [params.date_from] - Filter results after this ISO 8601 date
 * @param {string}  [params.date_to]   - Filter results before this ISO 8601 date
 * @param {string}  [params.userId]    - User ID for analytics (optional)
 * @returns {Promise<{ page, limit, total, data, cacheHit: boolean }>}
 */
async function search(params) {
  const {
    q,
    page = 1,
    limit = 10,
    highlight = false,
    sort = '_score',
    category,
    date_from,
    date_to,
    userId,
  } = params;

  // ── Step 1: Build the cache key ──────────────────────────────────────────
  // We include all parameters that affect the result so different queries
  // never share the same cache entry. We use spread syntax with conditional
  // properties so undefined values don't pollute the key.
  const cacheKey = buildSearchKey({
    q,
    page,
    limit,
    sort: sort || '_score',
    ...(category && { category }),
    ...(date_from && { date_from }),
    ...(date_to && { date_to }),
  });

  // ── Step 2: Check Redis cache ────────────────────────────────────────────
  // If we already have a result for this exact query, return it immediately.
  // This avoids hitting Elasticsearch entirely — much faster for repeated queries.
  const cached = await get(cacheKey);
  if (cached) {
    // Spread the cached result and add cacheHit: true so the controller
    // can set the X-Cache: HIT response header.
    return { ...cached, cacheHit: true };
  }

  // ── Step 3: Build the Elasticsearch query ────────────────────────────────
  //
  // WHAT IS A bool QUERY?
  // A bool query combines multiple conditions:
  //   - must:   the document MUST match (affects the relevance score)
  //   - filter: the document MUST match (does NOT affect the score — faster)
  //   - should: the document SHOULD match (boosts score if it does)
  //   - must_not: the document MUST NOT match
  //
  // We use `must` for the full-text search (so score is calculated) and
  // `filter` for category/date filters (exact matches, no scoring needed).
  //
  // WHAT IS _source FILTERING?
  // By default, Elasticsearch returns ALL fields stored in the document.
  // Specifying _source: ['title', 'content', ...] tells ES to only return
  // those fields — reducing network payload and improving performance.
  const esQuery = {
    index: INDEX_NAME,

    // Pagination: skip (page-1)*limit documents, return `limit` documents
    // Example: page=2, limit=10 → from=10, size=10 (documents 11-20)
    from: (page - 1) * limit,
    size: limit,

    // Only return these fields from the stored document (source filtering)
    // This keeps the response lean — we don't need internal ES metadata fields
    _source: ['title', 'content', 'category', 'createdAt'],

    query: {
      bool: {
        // MUST: the full-text search condition
        // multi_match searches across multiple fields simultaneously
        must: {
          multi_match: {
            query: q,
            // title^3 means title matches are 3× more relevant than content matches
            // content^1 means content matches count at normal weight (×1)
            fields: ['title^3', 'content^1'],
            // best_fields: uses the score from the BEST matching field
            // (as opposed to cross_fields which combines scores across fields)
            type: 'best_fields',
            // fuzziness: AUTO means Elasticsearch automatically decides how many
            // character edits to allow based on the word length.
            // Example: "nodjs" will still match "nodejs" (1 character off)
            fuzziness: 'AUTO',
          },
        },
        // FILTER: exact-match conditions that don't affect the relevance score.
        // We build this array dynamically below — only add filters that were provided.
        filter: [],
      },
    },
  };

  // ── Step 4: Add category filter (if provided) ────────────────────────────
  // A `term` filter matches documents where the field value is EXACTLY equal
  // to the provided value. It's used for keyword fields (no tokenization).
  // Example: { term: { category: "programming" } }
  if (category) {
    esQuery.query.bool.filter.push({ term: { category } });
  }

  // ── Step 5: Add date range filter (if provided) ──────────────────────────
  // A `range` filter matches documents where the field value falls within
  // the specified bounds. `gte` = greater than or equal, `lte` = less than or equal.
  // We use spread syntax so we only include gte/lte when the values are provided.
  if (date_from || date_to) {
    esQuery.query.bool.filter.push({
      range: {
        createdAt: {
          ...(date_from && { gte: date_from }),
          ...(date_to && { lte: date_to }),
        },
      },
    });
  }

  // ── Step 6: Add highlight block (if requested) ───────────────────────────
  // Highlighting tells Elasticsearch to return snippets of the matched text
  // with the matching terms wrapped in <em> tags.
  // Example: "Learn <em>Node.js</em> from scratch"
  // The client can use these snippets to show users WHY a result matched.
  if (highlight) {
    esQuery.highlight = {
      fields: {
        title: {},    // highlight matches in the title field
        content: {},  // highlight matches in the content field
      },
    };
  }

  // ── Step 7: Add sort (if not default _score) ─────────────────────────────
  // By default, Elasticsearch sorts by _score descending (most relevant first).
  // We only need to set an explicit sort for date-based ordering.
  if (sort === 'date_asc') {
    // Sort by createdAt ascending (oldest documents first)
    esQuery.sort = [{ createdAt: 'asc' }];
  } else if (sort === 'date_desc') {
    // Sort by createdAt descending (newest documents first)
    esQuery.sort = [{ createdAt: 'desc' }];
  }
  // For sort === '_score' (the default), we don't set esQuery.sort at all —
  // Elasticsearch defaults to sorting by _score descending automatically.

  // ── Step 8: Execute the Elasticsearch query ──────────────────────────────
  const response = await esClient.search(esQuery);

  // ── Step 9: Map the raw ES hits into clean result objects ─────────────────
  // Elasticsearch returns hits in this shape:
  //   { _id: "abc123", _score: 4.23, _source: { title, content, ... }, highlight: {...} }
  //
  // We flatten this into a clean object that the client expects:
  //   { _id: "abc123", title: "...", content: "...", _score: 4.23, highlights: {...} }
  const mappedHits = response.hits.hits.map((hit) => ({
    _id: hit._id,
    // Spread all _source fields (title, content, category, createdAt)
    ...hit._source,
    // Include the relevance score
    _score: hit._score,
    // Only include highlights if they exist (when highlight=true was requested)
    // We rename "highlight" (ES field) to "highlights" (our API field name)
    ...(hit.highlight && { highlights: hit.highlight }),
  }));

  // Build the final result object
  const result = {
    page,
    limit,
    // response.hits.total.value is the total number of matching documents
    // (not just the ones on this page — useful for pagination UI)
    total: response.hits.total.value,
    data: mappedHits,
  };

  // ── Step 10: Fire-and-forget analytics ───────────────────────────────────
  // We record the search event ASYNCHRONOUSLY so it never slows down the
  // search response. setImmediate() schedules the callback to run after the
  // current event loop iteration completes — the user gets their results first.
  //
  // WHY LAZY-IMPORT analyticsService HERE?
  // If we imported analyticsService at the top of this file, and analyticsService
  // imported searchService, we'd have a circular dependency. Node.js handles
  // circular deps by returning an incomplete module object, which causes bugs.
  // By requiring it inside the function body, both modules are fully loaded
  // by the time this code runs, so the require() works correctly.
  setImmediate(() => {
    const analyticsService = require('./analyticsService');
    analyticsService
      .recordSearch(
        q,
        { category, date_from, date_to, sort },
        result.total,
        userId || 'anonymous'
      )
      .catch(console.error); // log errors but never crash the process
  });

  // ── Step 11: Cache the result ─────────────────────────────────────────────
  // Store the result in Redis for 300 seconds (5 minutes).
  // The next identical request will be served from cache (cache HIT).
  await set(cacheKey, result, 300);

  // ── Step 12: Return the result ────────────────────────────────────────────
  // cacheHit: false tells the controller to set the X-Cache: MISS header
  return { ...result, cacheHit: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// autocomplete(prefix)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Return up to 10 autocomplete suggestions for a given prefix.
 *
 * HOW THE COMPLETION SUGGESTER WORKS:
 * Elasticsearch's completion suggester is optimized for prefix-based lookups.
 * It stores a Finite State Transducer (FST) — a compact, memory-efficient
 * data structure — that can find all documents whose title starts with a
 * given prefix in sub-millisecond time.
 *
 * The "title.suggest" field is a special `completion` type field defined in
 * the index mapping (src/config/elasticsearch.js). When a document is indexed,
 * Elasticsearch automatically builds the FST from the title value.
 *
 * Example:
 *   prefix = "nod"
 *   Returns: [
 *     { text: "Node.js Tutorial", score: 1.0 },
 *     { text: "Node.js Best Practices", score: 1.0 },
 *   ]
 *
 * @param {string} prefix - The text the user has typed so far
 * @returns {Promise<Array<{ text: string, score: number }>>} Up to 10 suggestions
 */
async function autocomplete(prefix) {
  // Query the completion suggester on the title.suggest field
  const response = await esClient.search({
    index: INDEX_NAME,
    suggest: {
      // "title-suggest" is the name we give to this suggester query.
      // The response will be keyed by this name.
      'title-suggest': {
        prefix,
        completion: {
          // title.suggest is the completion field defined in our index mapping
          field: 'title.suggest',
          // Return at most 10 suggestions
          size: 10,
        },
      },
    },
  });

  // Extract the suggestion options from the response.
  // The response shape is:
  //   response.suggest['title-suggest'][0].options = [
  //     { text: "Node.js Tutorial", _score: 1.0, _source: {...} },
  //     ...
  //   ]
  const options = response.suggest['title-suggest'][0].options;

  // Map each option to the clean shape our API returns: { text, score }
  return options.map((option) => ({
    text: option.text,
    score: option._score,
  }));
}

// Export both service functions so they can be imported in the controller:
//   const searchService = require('../services/searchService');
//   await searchService.search({ q: 'nodejs', page: 1 });
//   await searchService.autocomplete('nod');
module.exports = { search, autocomplete };
