/**
 * src/config/elasticsearch.js
 * Elasticsearch client configuration and index bootstrap.
 *
 * What this file does (for beginners):
 *   - Creates a single Elasticsearch client that the whole app shares (singleton).
 *   - Provides a bootstrapElasticsearchIndex() function that creates the
 *     "documents" index with the correct mapping on startup — but only if it
 *     doesn't already exist (idempotent: safe to call multiple times).
 *
 * Key concepts:
 *   - Index: like a "table" in SQL — it holds all our searchable documents.
 *   - Mapping: like a "schema" — it tells Elasticsearch the type of each field
 *     and how to analyze/index it for search.
 *   - Shards: Elasticsearch splits an index into shards so queries can run in
 *     parallel across multiple nodes (2 primary shards here).
 *   - Replicas: copies of each shard on other nodes for high availability
 *     (1 replica per shard here).
 */

'use strict';

const { Client } = require('@elastic/elasticsearch');

// Read the Elasticsearch URL from the environment, or fall back to localhost.
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

/**
 * esClient — singleton Elasticsearch client instance.
 * All services import this same object to run queries.
 */
const esClient = new Client({ node: ELASTICSEARCH_URL });

// Name of the index we store and search documents in.
const INDEX_NAME = 'documents';

/**
 * The exact index mapping required by the spec.
 *
 * Why these settings?
 *   - number_of_shards: 2  → splits data across 2 primary shards for parallelism
 *   - number_of_replicas: 1 → one backup copy per shard for fault tolerance
 *
 * Why these field types?
 *   - title (text, english analyzer, boost 3): applies English stemming so
 *     "running" matches "run"; boost 3 means a title match is 3× more relevant
 *     than a content match.
 *   - title.suggest (completion): a special field type for fast prefix autocomplete.
 *   - title.keyword (keyword): unanalyzed copy for exact-match filtering/sorting.
 *   - content (text, standard analyzer): tokenizes by whitespace/punctuation,
 *     no language-specific stemming — good for general text.
 *   - category (keyword): stored as-is so we can filter by exact value.
 *   - createdAt (date): lets us sort and range-filter by date.
 */
const INDEX_MAPPING = {
  settings: {
    number_of_shards: 2,
    number_of_replicas: 1,
  },
  mappings: {
    properties: {
      title: {
        type: 'text',
        analyzer: 'english',
        fields: {
          suggest: { type: 'completion' },
          keyword: { type: 'keyword' },
        },
      },
      content: {
        type: 'text',
        analyzer: 'standard',
      },
      category: { type: 'keyword' },
      createdAt: { type: 'date' },
    },
  },
};

/**
 * bootstrapElasticsearchIndex
 * Creates the "documents" index if it does not already exist.
 *
 * Idempotent: calling this function multiple times is safe — it checks
 * for the index first and skips creation if it already exists.
 *
 * Call this once at application startup (in server.js) before the HTTP
 * server starts accepting requests.
 */
async function bootstrapElasticsearchIndex() {
  // Check whether the index already exists.
  // In the @elastic/elasticsearch v8 JS client, indices.exists() resolves
  // to a plain boolean (true = exists, false = does not exist).
  const exists = await esClient.indices.exists({ index: INDEX_NAME });

  // Skip creation silently if the index is already present (idempotent).
  if (exists) {
    console.log(`Elasticsearch index '${INDEX_NAME}' ready`);
    return;
  }

  // Create the index with our mapping.
  await esClient.indices.create({
    index: INDEX_NAME,
    ...INDEX_MAPPING,
  });

  console.log(`Elasticsearch index '${INDEX_NAME}' ready`);
}

module.exports = { esClient, bootstrapElasticsearchIndex };
