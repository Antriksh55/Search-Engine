# Requirements Document

## Introduction

A production-level Search Engine Backend ("Mini Google") built with Node.js (Express) and Elasticsearch. The system stores documents (title + content), indexes them for fast full-text retrieval, returns ranked results, supports advanced search features (pagination, highlighting, sorting, boosting, filters), provides autocomplete, caches frequent queries via Redis, enforces rate limiting, tracks analytics, and is structured in a strict MVC layout suitable for large-scale data.

---

## Glossary

- **API**: The Express HTTP interface exposed to clients.
- **Document**: A record with at minimum a `title`, `content`, `category`, and `createdAt` field stored in MongoDB and indexed in Elasticsearch.
- **Index**: An Elasticsearch index that holds indexed Document data for full-text search.
- **Search_Service**: The service layer component responsible for constructing and executing Elasticsearch queries.
- **Document_Service**: The service layer component responsible for CRUD operations on Documents in MongoDB and Elasticsearch.
- **Cache**: The Redis layer used to store and retrieve results for repeated queries.
- **Cache_Manager**: The utility responsible for reading, writing, and invalidating Cache entries.
- **Rate_Limiter**: The Express middleware that enforces per-IP request rate limits.
- **Validator**: The middleware responsible for validating and sanitizing incoming request payloads.
- **Logger**: The middleware responsible for structured request/response logging.
- **Analytics_Service**: The service layer component responsible for recording and aggregating search analytics events.
- **Suggester**: The Elasticsearch completion suggester used to power autocomplete.
- **Score**: The Elasticsearch relevance score assigned to a search result.
- **Highlight**: Elasticsearch-generated HTML snippets showing matched terms in context.
- **User**: An authenticated or anonymous client consuming the API.

---

## Requirements

### Requirement 1: Document Ingestion

**User Story:** As a developer, I want to submit documents via API so that they are persisted and made searchable.

#### Acceptance Criteria

1. WHEN a `POST /api/documents` request is received with a valid `title` and `content`, THE Document_Service SHALL persist the Document in MongoDB and index it in Elasticsearch within the same request lifecycle.
2. WHEN a `POST /api/documents` request is received, THE API SHALL return the created Document with its generated `id`, `title`, `content`, `category`, `createdAt`, and Elasticsearch `_id` in the response body with HTTP 201.
3. IF the `title` or `content` field is missing or empty in a `POST /api/documents` request, THEN THE Validator SHALL reject the request with HTTP 400 and a descriptive error message identifying the missing field.
4. IF Elasticsearch indexing fails after MongoDB persistence, THEN THE Document_Service SHALL log the failure, roll back the MongoDB write, and return HTTP 500 with an error message.
5. THE Index SHALL be configured with a custom mapping that sets `title` with a boost factor of 3 and `content` with a boost factor of 1 at index time.

### Requirement 2: Document Retrieval

**User Story:** As a developer, I want to list all stored documents so that I can inspect the corpus.

#### Acceptance Criteria

1. WHEN a `GET /api/documents` request is received, THE Document_Service SHALL return a paginated list of Documents from MongoDB with `page`, `limit`, `total`, and `data` fields.
2. WHEN a `GET /api/documents` request is received without `page` or `limit` query parameters, THE API SHALL default to `page=1` and `limit=10`.
3. WHEN a `GET /api/documents/:id` request is received with a valid Document `id`, THE Document_Service SHALL return the matching Document with HTTP 200.
4. IF a `GET /api/documents/:id` request references a non-existent `id`, THEN THE API SHALL return HTTP 404 with a descriptive error message.

### Requirement 3: Document Deletion

**User Story:** As a developer, I want to delete a document by ID so that it is removed from both storage and the search index.

#### Acceptance Criteria

1. WHEN a `DELETE /api/documents/:id` request is received with a valid Document `id`, THE Document_Service SHALL delete the Document from MongoDB and remove it from the Elasticsearch Index atomically within the same request lifecycle.
2. WHEN a `DELETE /api/documents/:id` request succeeds, THE API SHALL return HTTP 200 with a confirmation message.
3. IF a `DELETE /api/documents/:id` request references a non-existent `id`, THEN THE API SHALL return HTTP 404 with a descriptive error message.
4. IF Elasticsearch deletion fails after MongoDB deletion, THEN THE Document_Service SHALL log the inconsistency and return HTTP 500 with an error message.

### Requirement 4: Full-Text Search

**User Story:** As a user, I want to search documents by keyword so that I receive ranked, relevant results quickly.

#### Acceptance Criteria

1. WHEN a `GET /api/search?q=<keyword>` request is received, THE Search_Service SHALL execute a `multi_match` query across the `title` and `content` fields with `title` boosted at 3x relative to `content`.
2. WHEN search results are returned, THE API SHALL include each result's `_id`, `title`, `content`, `category`, `createdAt`, and Elasticsearch `_score` in the response body.
3. WHEN a `GET /api/search` request is received without the `q` parameter, THE Validator SHALL reject the request with HTTP 400 and a message indicating the query parameter is required.
4. WHEN a search query is executed, THE Search_Service SHALL return results sorted by `_score` descending by default.
5. WHEN a search query produces no results, THE API SHALL return HTTP 200 with an empty `data` array and `total` of 0.

### Requirement 5: Advanced Search — Pagination, Highlighting, Sorting, and Filters

**User Story:** As a user, I want to paginate, highlight matches, sort results, and filter by metadata so that I can navigate large result sets efficiently.

#### Acceptance Criteria

1. WHEN a `GET /api/search` request includes `page` and `limit` query parameters, THE Search_Service SHALL apply Elasticsearch `from` and `size` parameters accordingly and return `page`, `limit`, `total`, and `data` in the response.
2. WHEN a `GET /api/search` request is received without `page` or `limit`, THE API SHALL default to `page=1` and `limit=10`.
3. WHEN a `GET /api/search` request includes `highlight=true`, THE Search_Service SHALL request Elasticsearch highlights on `title` and `content` fields and include them in each result under a `highlights` key.
4. WHEN a `GET /api/search` request includes a `sort` parameter with value `date_asc` or `date_desc`, THE Search_Service SHALL sort results by `createdAt` ascending or descending respectively.
5. WHEN a `GET /api/search` request includes a `category` filter parameter, THE Search_Service SHALL apply an Elasticsearch `term` filter on the `category` keyword field.
6. WHEN a `GET /api/search` request includes `date_from` or `date_to` parameters, THE Search_Service SHALL apply an Elasticsearch `range` filter on the `createdAt` field using the provided ISO 8601 date values.
7. IF a `date_from` or `date_to` value is not a valid ISO 8601 date string, THEN THE Validator SHALL reject the request with HTTP 400 and a descriptive error message.

### Requirement 6: Autocomplete

**User Story:** As a user, I want autocomplete suggestions as I type so that I can find documents faster.

#### Acceptance Criteria

1. WHEN a `GET /api/search/autocomplete?q=<prefix>` request is received, THE Search_Service SHALL query the Elasticsearch Suggester on the `title.suggest` completion field and return up to 10 suggestions.
2. WHEN autocomplete results are returned, THE API SHALL include each suggestion's `text` and `score` in the response array.
3. WHEN a `GET /api/search/autocomplete` request is received without the `q` parameter, THE Validator SHALL reject the request with HTTP 400.
4. THE Index SHALL be configured with a `title.suggest` field of type `completion` to support the Suggester.

### Requirement 7: Redis Caching

**User Story:** As a system operator, I want frequent search queries cached so that repeated requests are served faster without hitting Elasticsearch.

#### Acceptance Criteria

1. WHEN a `GET /api/search` request is received, THE Cache_Manager SHALL check Redis for a cached result keyed by the normalized query string (including all filter and pagination parameters) before executing an Elasticsearch query.
2. WHEN a Cache hit occurs, THE API SHALL return the cached result with an `X-Cache: HIT` response header.
3. WHEN a Cache miss occurs, THE Search_Service SHALL execute the Elasticsearch query, store the result in Redis with a TTL of 300 seconds, and return the result with an `X-Cache: MISS` response header.
4. WHEN a Document is created or deleted, THE Cache_Manager SHALL invalidate all Cache entries whose keys contain the affected Document's `category` and any wildcard pattern matching the search namespace.
5. THE Cache_Manager SHALL use a key prefix of `search:` for all search Cache entries to enable namespace-scoped invalidation.

### Requirement 8: Rate Limiting

**User Story:** As a system operator, I want to limit request rates per IP so that the API is protected from abuse and overload.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL enforce a maximum of 100 requests per 15-minute window per IP address across all API routes.
2. WHEN a client exceeds the rate limit, THE Rate_Limiter SHALL return HTTP 429 with a `Retry-After` header indicating the number of seconds until the window resets.
3. THE Rate_Limiter SHALL apply a stricter limit of 30 requests per 15-minute window per IP address on the `POST /api/documents` route.

### Requirement 9: Input Validation and Sanitization

**User Story:** As a system operator, I want all inputs validated and sanitized so that the API is protected from malformed or malicious data.

#### Acceptance Criteria

1. THE Validator SHALL strip all HTML tags from `title` and `content` fields before persistence.
2. THE Validator SHALL enforce a maximum length of 500 characters for `title` and 100,000 characters for `content`.
3. IF a request body contains fields not defined in the Document schema, THEN THE Validator SHALL strip the unknown fields before processing.
4. WHEN validation fails, THE Validator SHALL return HTTP 400 with a structured error body containing a `field` name and `message` for each violation.

### Requirement 10: Request Logging

**User Story:** As a system operator, I want structured request logs so that I can monitor traffic and debug issues.

#### Acceptance Criteria

1. THE Logger SHALL record the HTTP method, URL, status code, response time in milliseconds, and client IP for every request.
2. THE Logger SHALL write logs in JSON format to stdout.
3. WHEN a request results in HTTP 500, THE Logger SHALL include the full error stack trace in the log entry.

### Requirement 11: Global Error Handling

**User Story:** As a developer, I want a consistent error response format so that clients can handle errors predictably.

#### Acceptance Criteria

1. THE API SHALL return all error responses in the format `{ "success": false, "error": { "code": "<CODE>", "message": "<message>" } }`.
2. WHEN an unhandled exception occurs, THE API SHALL return HTTP 500 with error code `INTERNAL_SERVER_ERROR` without exposing stack traces to the client.
3. WHEN a route is not found, THE API SHALL return HTTP 404 with error code `NOT_FOUND`.

### Requirement 12: Analytics — Click Tracking and Popular Queries

**User Story:** As a product owner, I want to track which results users click and which queries are most popular so that I can improve search relevance.

#### Acceptance Criteria

1. WHEN a `POST /api/analytics/click` request is received with `queryId`, `documentId`, and `userId` fields, THE Analytics_Service SHALL persist the click event in MongoDB with a `clickedAt` timestamp.
2. WHEN a `GET /api/analytics/popular` request is received, THE Analytics_Service SHALL return the top 10 most-searched query strings aggregated from the search event log, ordered by frequency descending.
3. WHEN a `GET /api/search` request is executed, THE Analytics_Service SHALL asynchronously record a search event containing the query string, applied filters, result count, and `userId` (if present) without blocking the search response.
4. WHEN a `GET /api/analytics/history?userId=<id>` request is received, THE Analytics_Service SHALL return the 20 most recent search events for the specified User ordered by `searchedAt` descending.
5. IF a `POST /api/analytics/click` request is missing `queryId` or `documentId`, THEN THE Validator SHALL reject the request with HTTP 400.

### Requirement 13: Elasticsearch Index and Performance Optimization

**User Story:** As a system operator, I want the Elasticsearch index optimized for production workloads so that search latency remains low under high data volumes.

#### Acceptance Criteria

1. THE Index SHALL be created with 2 primary shards and 1 replica shard on startup if it does not already exist.
2. THE Index SHALL use the `standard` analyzer for `content` and the `english` analyzer for `title` to improve relevance for English-language documents.
3. WHEN the application starts, THE Document_Service SHALL verify the Index exists and create it with the defined mapping if absent.
4. THE Search_Service SHALL use Elasticsearch `_source` filtering to return only the fields required by the response schema, reducing network payload size.
5. WHEN bulk-indexing more than 50 Documents, THE Document_Service SHALL use the Elasticsearch Bulk API instead of individual index requests.
