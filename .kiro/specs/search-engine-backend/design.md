# Design Document: Search Engine Backend

## Overview

This document describes the technical design for a production-level Search Engine Backend ("Mini Google"). The system is a RESTful API built with **Node.js + Express** that lets clients ingest documents, search them with full-text ranking, get autocomplete suggestions, and view analytics — all while being protected by rate limiting, input validation, and Redis caching.

### Technology Stack

| Layer | Technology | Why |
|---|---|---|
| HTTP Framework | Express.js | Minimal, well-understood, huge ecosystem |
| Primary Database | MongoDB (Mongoose) | Flexible document storage, easy schema evolution |
| Search Engine | Elasticsearch 8.x | Industry-standard full-text search with scoring, highlighting, and completion suggesters |
| Cache | Redis | Sub-millisecond key-value lookups, built-in TTL support |
| Validation | Joi or express-validator | Declarative schema validation with good error messages |
| Logging | Winston | Structured JSON logging, multiple transports |
| Rate Limiting | express-rate-limit | Per-IP window-based limiting, minimal config |

### What the System Does (Plain English)

1. A developer POSTs a document (title + content). The system saves it to MongoDB and indexes it in Elasticsearch so it becomes searchable.
2. A user GETs `/api/search?q=keyword`. The system checks Redis first. On a miss it asks Elasticsearch, caches the result for 5 minutes, and returns ranked results.
3. As the user types, `/api/search/autocomplete?q=pre` returns up to 10 title completions from Elasticsearch's completion suggester.
4. Every search is logged asynchronously to MongoDB for analytics. Click events are also recorded.
5. All routes are protected by rate limiting and input validation middleware.

---

## Architecture

The system follows the **MVC (Model-View-Controller)** pattern adapted for a REST API (there is no HTML view layer — the "view" is the JSON response).

```
Client (HTTP)
     │
     ▼
┌─────────────────────────────────────────────────────┐
│                    Express App                       │
│                                                     │
│  Middleware Pipeline                                │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐ │
│  │Rate Limit│→ │ Validator │→ │     Logger       │ │
│  └──────────┘  └───────────┘  └──────────────────┘ │
│                                                     │
│  Routes (URL → Controller mapping)                  │
│  ┌──────────────────────────────────────────────┐  │
│  │  /api/documents  →  DocumentController       │  │
│  │  /api/search     →  SearchController         │  │
│  │  /api/analytics  →  AnalyticsController      │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Controllers (thin — parse req, call service,       │
│               send res)                             │
│                                                     │
│  Services (business logic)                          │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │DocumentSvc   │ │ SearchSvc    │ │AnalyticsSvc │ │
│  └──────┬───────┘ └──────┬───────┘ └──────┬──────┘ │
│         │                │                │        │
└─────────┼────────────────┼────────────────┼────────┘
          │                │                │
    ┌─────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
    │  MongoDB   │  │Elasticsearch│  │   Redis    │
    │ (Mongoose) │  │   Client    │  │  (ioredis) │
    └────────────┘  └─────────────┘  └────────────┘
```

### Key Architectural Decisions

**Why separate Services from Controllers?**
Controllers only know about HTTP (request/response). Services only know about business logic and data. This means you can test a service without spinning up an HTTP server, and you can swap Express for another framework without rewriting business logic.

**Why Redis in front of Elasticsearch?**
Elasticsearch is fast but not free — every query costs CPU. For popular repeated searches (e.g., "javascript tutorial"), Redis returns the result in under 1ms from memory instead of ~10-50ms from Elasticsearch.

**Why async analytics recording?**
Recording a search event should never slow down the search response. We fire-and-forget the analytics write so the user gets their results immediately.

---

## Folder Structure

```
project-root/
├── src/
│   ├── app.js              # Express app setup (middleware, routes)
│   ├── server.js           # HTTP server entry point (listen, DB connect)
│   │
│   ├── config/
│   │   ├── db.js           # MongoDB connection
│   │   ├── elasticsearch.js # Elasticsearch client + index bootstrap
│   │   └── redis.js        # Redis client
│   │
│   ├── controllers/
│   │   ├── documentController.js
│   │   ├── searchController.js
│   │   └── analyticsController.js
│   │
│   ├── routes/
│   │   ├── documentRoutes.js
│   │   ├── searchRoutes.js
│   │   └── analyticsRoutes.js
│   │
│   ├── services/
│   │   ├── documentService.js
│   │   ├── searchService.js
│   │   └── analyticsService.js
│   │
│   ├── models/
│   │   ├── Document.js     # Mongoose schema
│   │   ├── ClickEvent.js   # Mongoose schema
│   │   └── SearchEvent.js  # Mongoose schema
│   │
│   ├── middlewares/
│   │   ├── rateLimiter.js
│   │   ├── validator.js
│   │   ├── logger.js
│   │   └── errorHandler.js
│   │
│   └── utils/
│       └── cacheManager.js # Redis read/write/invalidate helpers
│
├── .env
├── package.json
└── README.md
```

**Rule of thumb for where code lives:**
- Does it touch `req` or `res`? → Controller or Middleware
- Does it contain business logic or talk to a database? → Service
- Does it define a data shape? → Model
- Is it reusable infrastructure (cache, logging helpers)? → Utils or Config

---

## Components and Interfaces

### 1. `app.js` — Express Application Setup

Responsibilities: mount global middleware, mount route files, mount the 404 handler and global error handler.

```
app.js
  ├── apply morgan/winston request logger
  ├── apply express.json() body parser
  ├── apply global rate limiter
  ├── mount /api/documents  → documentRoutes
  ├── mount /api/search     → searchRoutes
  ├── mount /api/analytics  → analyticsRoutes
  ├── 404 catch-all handler
  └── global error handler (errorHandler middleware)
```

### 2. `server.js` — Entry Point

Responsibilities: connect to MongoDB, bootstrap Elasticsearch index, start HTTP listener.

```javascript
// Pseudocode
await connectMongoDB();
await bootstrapElasticsearchIndex(); // creates index if missing
app.listen(PORT);
```

### 3. Controllers

Controllers are intentionally thin. Their only job is:
1. Extract data from `req` (params, query, body)
2. Call the appropriate service method
3. Send the HTTP response

**DocumentController** methods:
- `createDocument(req, res, next)` — calls `documentService.create()`
- `listDocuments(req, res, next)` — calls `documentService.list()`
- `getDocument(req, res, next)` — calls `documentService.getById()`
- `deleteDocument(req, res, next)` — calls `documentService.delete()`

**SearchController** methods:
- `search(req, res, next)` — calls `searchService.search()`, sets `X-Cache` header
- `autocomplete(req, res, next)` — calls `searchService.autocomplete()`

**AnalyticsController** methods:
- `trackClick(req, res, next)` — calls `analyticsService.recordClick()`
- `getPopularQueries(req, res, next)` — calls `analyticsService.getPopular()`
- `getSearchHistory(req, res, next)` — calls `analyticsService.getHistory()`

### 4. Services

**DocumentService** — `src/services/documentService.js`

```
create(data):
  1. Validate (already done by middleware, but service double-checks)
  2. Save to MongoDB → get _id
  3. Index in Elasticsearch with same _id
  4. If ES fails → delete MongoDB doc → throw error
  5. Return created document

list(page, limit):
  1. Query MongoDB with skip/limit
  2. Return { page, limit, total, data }

getById(id):
  1. Query MongoDB by _id
  2. Return doc or throw NotFoundError

delete(id):
  1. Find doc in MongoDB (throw 404 if missing)
  2. Delete from MongoDB
  3. Delete from Elasticsearch
  4. If ES delete fails → log inconsistency → throw error
  5. Invalidate Redis cache entries for this doc's category
```

**SearchService** — `src/services/searchService.js`

```
search(params):
  params = { q, page, limit, highlight, sort, category, date_from, date_to }
  1. Build cache key from normalized params
  2. Check Redis → if HIT return { data, cacheHit: true }
  3. Build Elasticsearch query (see Query Construction below)
  4. Execute ES query
  5. Record search event asynchronously (fire-and-forget)
  6. Store result in Redis with TTL=300s
  7. Return { data, cacheHit: false }

autocomplete(prefix):
  1. Query ES completion suggester on title.suggest
  2. Return array of { text, score }
```

**AnalyticsService** — `src/services/analyticsService.js`

```
recordClick(queryId, documentId, userId):
  1. Save ClickEvent to MongoDB

recordSearch(query, filters, resultCount, userId):
  1. Save SearchEvent to MongoDB (called async, never awaited by caller)

getPopular():
  1. MongoDB aggregation: group SearchEvents by query, count, sort desc, limit 10

getHistory(userId):
  1. Query SearchEvents by userId, sort by searchedAt desc, limit 20
```

### 5. Middleware Pipeline

Request flow through middleware:

```
Incoming Request
      │
      ▼
  [Logger]          ← logs method, URL, IP; attaches start time
      │
      ▼
  [Rate Limiter]    ← checks per-IP counter in memory/Redis
      │
      ▼
  [Body Parser]     ← express.json()
      │
      ▼
  [Route Match]
      │
      ▼
  [Validator]       ← route-specific schema validation
      │
      ▼
  [Controller]
      │
      ▼
  [Error Handler]   ← catches anything thrown with next(err)
```

**rateLimiter.js** — two instances:
- `globalLimiter`: 100 req / 15 min per IP (applied in `app.js`)
- `strictLimiter`: 30 req / 15 min per IP (applied only on `POST /api/documents`)

**validator.js** — exports validation middleware factories using Joi schemas:
- `validateCreateDocument` — requires title (1-500 chars), content (1-100000 chars); strips HTML; strips unknown fields
- `validateSearch` — requires q; validates date_from/date_to as ISO 8601
- `validateAutocomplete` — requires q
- `validateTrackClick` — requires queryId, documentId

**logger.js** — Winston middleware:
- Logs every request as JSON: `{ method, url, statusCode, responseTime, ip }`
- On 500 errors, includes `stack` field

**errorHandler.js** — Express error middleware `(err, req, res, next)`:
- Maps known error types to HTTP codes
- Always responds with `{ success: false, error: { code, message } }`
- Never exposes stack traces to clients

### 6. CacheManager — `src/utils/cacheManager.js`

```javascript
// Interface
get(key)                    // returns parsed JSON or null
set(key, value, ttl=300)    // stores JSON-stringified value
invalidatePattern(pattern)  // uses Redis SCAN + DEL for pattern matching
buildSearchKey(params)      // normalizes params → deterministic cache key
```

Key format: `search:<normalized-query-string>`

Example: `search:q=javascript&page=1&limit=10&sort=_score`

---

## Data Models

### MongoDB: Document Schema

```javascript
// src/models/Document.js
{
  title:     { type: String, required: true, maxlength: 500 },
  content:   { type: String, required: true, maxlength: 100000 },
  category:  { type: String, default: 'general' },
  esId:      { type: String },          // Elasticsearch _id (same as _id by convention)
  createdAt: { type: Date, default: Date.now }
}
```

### MongoDB: ClickEvent Schema

```javascript
// src/models/ClickEvent.js
{
  queryId:    { type: String, required: true },
  documentId: { type: String, required: true },
  userId:     { type: String, default: 'anonymous' },
  clickedAt:  { type: Date, default: Date.now }
}
```

### MongoDB: SearchEvent Schema

```javascript
// src/models/SearchEvent.js
{
  query:       { type: String, required: true },
  filters:     { type: Object, default: {} },   // category, date_from, date_to, sort
  resultCount: { type: Number, default: 0 },
  userId:      { type: String, default: 'anonymous' },
  searchedAt:  { type: Date, default: Date.now }
}
```

### Elasticsearch Index Mapping

The index is named `documents`. It is created on application startup if it does not exist.

```json
{
  "settings": {
    "number_of_shards": 2,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "title": {
        "type": "text",
        "analyzer": "english",
        "boost": 3,
        "fields": {
          "suggest": {
            "type": "completion"
          },
          "keyword": {
            "type": "keyword"
          }
        }
      },
      "content": {
        "type": "text",
        "analyzer": "standard",
        "boost": 1
      },
      "category": {
        "type": "keyword"
      },
      "createdAt": {
        "type": "date"
      }
    }
  }
}
```

**Why these settings?**

- `number_of_shards: 2` — splits the index across 2 primary shards so queries can run in parallel on two nodes. Good starting point for medium-scale data.
- `number_of_replicas: 1` — each primary shard has one copy on another node. If a node goes down, the replica takes over (high availability).
- `english` analyzer on `title` — applies stemming (e.g., "running" matches "run"), removes stop words ("the", "a"), improving relevance for English text.
- `standard` analyzer on `content` — tokenizes by whitespace/punctuation without language-specific stemming. Good for general content.
- `boost: 3` on `title` — a match in the title is 3× more relevant than a match in the content. This is set at index time via the mapping.
- `title.suggest` completion field — a special Elasticsearch field type optimized for prefix-based autocomplete. It stores a finite-state transducer (FST) in memory for sub-millisecond lookups.
- `title.keyword` — an unanalyzed copy of title for exact-match filtering and sorting.
- `category: keyword` — stored as-is (no tokenization) so we can filter by exact category value.

### Elasticsearch Query Construction

**Full-text search query (multi_match):**

```json
{
  "query": {
    "bool": {
      "must": {
        "multi_match": {
          "query": "<user_query>",
          "fields": ["title^3", "content^1"],
          "type": "best_fields",
          "fuzziness": "AUTO"
        }
      },
      "filter": [
        { "term": { "category": "<category>" } },
        { "range": { "createdAt": { "gte": "<date_from>", "lte": "<date_to>" } } }
      ]
    }
  },
  "highlight": {
    "fields": { "title": {}, "content": {} }
  },
  "sort": [ ... ],
  "from": (page-1) * limit,
  "size": limit,
  "_source": ["title", "content", "category", "createdAt"]
}
```

The `filter` array is built dynamically — only included when the corresponding query parameter is present.

**Autocomplete query:**

```json
{
  "suggest": {
    "title-suggest": {
      "prefix": "<user_prefix>",
      "completion": {
        "field": "title.suggest",
        "size": 10
      }
    }
  }
}
```

### Redis Caching Design

```
Key format:   search:<url-encoded-normalized-params>
Example:      search:q=node.js&page=1&limit=10
TTL:          300 seconds (5 minutes)
Value:        JSON-stringified search result object

Invalidation strategy:
  - On document CREATE or DELETE:
    1. SCAN Redis for keys matching pattern search:*
    2. For each matching key, check if it contains the document's category
    3. DEL matching keys
  - Alternatively (simpler): flush all search:* keys on any write
    (acceptable for low write volume; revisit if writes are frequent)
```

**Why 300 seconds?** Search results for a given query are unlikely to change dramatically within 5 minutes. This balances freshness with performance.

**Why key prefix `search:`?** Namespacing lets us invalidate all search cache entries with a single `SCAN search:*` pattern without touching other Redis keys (e.g., session data, other features).

---

## API Endpoint Design

### Documents

| Method | Path | Description | Success | Error |
|--------|------|-------------|---------|-------|
| POST | `/api/documents` | Create document | 201 | 400, 500 |
| GET | `/api/documents` | List documents (paginated) | 200 | 500 |
| GET | `/api/documents/:id` | Get single document | 200 | 404 |
| DELETE | `/api/documents/:id` | Delete document | 200 | 404, 500 |

### Search

| Method | Path | Description | Success | Error |
|--------|------|-------------|---------|-------|
| GET | `/api/search` | Full-text search | 200 | 400 |
| GET | `/api/search/autocomplete` | Autocomplete suggestions | 200 | 400 |

**Search query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | required | Search keyword |
| `page` | integer | 1 | Page number |
| `limit` | integer | 10 | Results per page |
| `highlight` | boolean | false | Include highlighted snippets |
| `sort` | string | `_score` | `_score`, `date_asc`, `date_desc` |
| `category` | string | — | Filter by category |
| `date_from` | ISO 8601 | — | Filter results after this date |
| `date_to` | ISO 8601 | — | Filter results before this date |

### Analytics

| Method | Path | Description | Success | Error |
|--------|------|-------------|---------|-------|
| POST | `/api/analytics/click` | Record a click event | 201 | 400 |
| GET | `/api/analytics/popular` | Top 10 popular queries | 200 | 500 |
| GET | `/api/analytics/history` | Search history for a user | 200 | 400 |

### Response Shapes

**Success (search):**
```json
{
  "success": true,
  "page": 1,
  "limit": 10,
  "total": 42,
  "data": [
    {
      "_id": "abc123",
      "title": "Node.js Tutorial",
      "content": "...",
      "category": "programming",
      "createdAt": "2024-01-15T10:00:00Z",
      "_score": 4.23,
      "highlights": {
        "title": ["<em>Node.js</em> Tutorial"],
        "content": ["...learn <em>Node.js</em> basics..."]
      }
    }
  ]
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "title is required"
  }
}
```

---

## Data Flow Diagrams

### Search Request Flow

```
Client
  │  GET /api/search?q=nodejs&page=1
  ▼
Logger Middleware (record start time)
  │
  ▼
Rate Limiter (check IP counter)
  │
  ▼
Validator (ensure q is present, validate date params)
  │
  ▼
SearchController.search()
  │
  ▼
SearchService.search()
  │
  ├─► CacheManager.get("search:q=nodejs&page=1")
  │         │
  │    HIT ─┤─► return cached result → X-Cache: HIT
  │         │
  │   MISS ─┘
  │
  ├─► Build Elasticsearch multi_match query
  │
  ├─► Elasticsearch.search(query)
  │         │
  │         └─► returns { hits, total }
  │
  ├─► CacheManager.set("search:q=nodejs&page=1", result, 300)
  │
  ├─► analyticsService.recordSearch(...) ← fire-and-forget (async)
  │
  └─► return result → X-Cache: MISS

SearchController sends HTTP 200 response
Logger Middleware records status + response time
```

### Document Ingestion Flow

```
Client
  │  POST /api/documents  { title, content, category }
  ▼
Validator (strip HTML, check lengths, strip unknown fields)
  │
  ▼
DocumentController.createDocument()
  │
  ▼
DocumentService.create()
  │
  ├─► MongoDB.save(document) → gets _id
  │
  ├─► Elasticsearch.index({ id: _id, title, content, category, createdAt })
  │         │
  │    FAIL ─┤─► MongoDB.deleteOne(_id)
  │         │   throw InternalError → HTTP 500
  │         │
  │  SUCCESS─┘
  │
  ├─► CacheManager.invalidatePattern("search:*")
  │
  └─► return created document

DocumentController sends HTTP 201 response
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The properties below were derived from the acceptance criteria. For each criterion we asked: "Is this a rule that should hold for all valid inputs, or just a specific example?" Properties are universally quantified — they must hold for any input we can generate, not just the ones we thought of.

---

### Property 1: Document Creation Round-Trip

*For any* valid document (with non-empty title and content), after a successful POST to `/api/documents`, a subsequent GET to `/api/documents/:id` using the returned ID should return a document with the same title and content.

**Validates: Requirements 1.1, 2.3**

---

### Property 2: Created Document Response Shape

*For any* valid document creation request, the HTTP 201 response body should contain all of: `id`, `title`, `content`, `category`, `createdAt`, and `esId` (Elasticsearch `_id`), and none of these fields should be null or undefined.

**Validates: Requirements 1.2**

---

### Property 3: Validation Rejects Invalid Inputs

*For any* document creation request where `title` is missing, empty, or exceeds 500 characters, OR where `content` is missing, empty, or exceeds 100,000 characters, the API should respond with HTTP 400 and an error body that identifies the offending field.

**Validates: Requirements 1.3, 9.2**

---

### Property 4: Pagination Response Shape and Correctness

*For any* list request with valid `page` and `limit` parameters against a collection of N documents, the response should contain `page`, `limit`, `total`, and `data` fields, where `data.length <= limit` and `total == N`.

**Validates: Requirements 2.1, 5.1**

---

### Property 5: Non-Existent ID Returns 404

*For any* ID that does not correspond to a document in the system, both GET `/api/documents/:id` and DELETE `/api/documents/:id` should return HTTP 404 with a non-empty error message.

**Validates: Requirements 2.4, 3.3**

---

### Property 6: Deletion Removes Document from Both Stores

*For any* document that exists in the system, after a successful DELETE `/api/documents/:id`, a subsequent GET `/api/documents/:id` should return HTTP 404, and an Elasticsearch query for that document's ID should return no results.

**Validates: Requirements 3.1**

---

### Property 7: Title Boost — Title Matches Outscore Content-Only Matches

*For any* keyword K, a document whose `title` contains K should have a higher Elasticsearch `_score` in search results than a document whose `title` does not contain K but whose `content` does, assuming all other factors are equal.

**Validates: Requirements 4.1**

---

### Property 8: Search Result Shape Invariant

*For any* search query that returns at least one result, every item in the `data` array should contain all of: `_id`, `title`, `content`, `category`, `createdAt`, and `_score`, with no field being null or undefined.

**Validates: Requirements 4.2**

---

### Property 9: Default Sort by Score Descending

*For any* search query returning multiple results without an explicit `sort` parameter, the `_score` values in the `data` array should be in non-increasing order (each score ≥ the next score).

**Validates: Requirements 4.4**

---

### Property 10: Highlights Present When Requested

*For any* search query with `highlight=true` that returns at least one result, every item in the `data` array should contain a `highlights` key with at least one non-empty entry.

**Validates: Requirements 5.3**

---

### Property 11: Date Sort Ordering Invariant

*For any* search query with `sort=date_asc`, the `createdAt` values in the `data` array should be in non-decreasing order. For `sort=date_desc`, they should be in non-increasing order.

**Validates: Requirements 5.4**

---

### Property 12: Category Filter — All Results Match Category

*For any* search query with a `category` filter parameter, every document in the `data` array should have a `category` field exactly equal to the filter value.

**Validates: Requirements 5.5**

---

### Property 13: Date Range Filter — All Results Within Range

*For any* search query with `date_from` and/or `date_to` parameters, every document in the `data` array should have a `createdAt` value that falls within the specified range (inclusive).

**Validates: Requirements 5.6**

---

### Property 14: Invalid Date Strings Rejected

*For any* string that is not a valid ISO 8601 date, passing it as `date_from` or `date_to` should result in HTTP 400 with a descriptive error message.

**Validates: Requirements 5.7**

---

### Property 15: Autocomplete Count and Shape

*For any* prefix string, the autocomplete endpoint should return an array of at most 10 items, and every item in the array should contain both a `text` field (string) and a `score` field (number).

**Validates: Requirements 6.1, 6.2**

---

### Property 16: Cache Hit/Miss Behavior

*For any* search query Q, the first request should return `X-Cache: MISS` and the second identical request (within 300 seconds) should return `X-Cache: HIT` with the same response body. Furthermore, all cache keys stored in Redis by the search service should begin with the prefix `search:`.

**Validates: Requirements 7.1, 7.2, 7.3, 7.5**

---

### Property 17: Cache Invalidation on Write

*For any* search query Q that has been cached, after creating or deleting a document, the next request for Q should return `X-Cache: MISS` (the cache was invalidated).

**Validates: Requirements 7.4**

---

### Property 18: HTML Stripping

*For any* document creation request where `title` or `content` contains HTML tags (e.g., `<script>`, `<b>`, `<img>`), the stored document should have those tags removed, and the stored text should contain only the plain-text content.

**Validates: Requirements 9.1**

---

### Property 19: Unknown Fields Stripped

*For any* document creation request that includes fields not in the Document schema (e.g., `isAdmin`, `__proto__`), the stored document should not contain those extra fields.

**Validates: Requirements 9.3**

---

### Property 20: Error Response Shape Invariant

*For any* request that results in an error (4xx or 5xx), the response body should match the shape `{ success: false, error: { code: string, message: string } }`, with no field being null or undefined.

**Validates: Requirements 9.4, 11.1**

---

### Property 21: Log Entry Shape Invariant

*For any* HTTP request processed by the server, the corresponding log entry written to stdout should be valid JSON and should contain all of: `method`, `url`, `statusCode`, `responseTime`, and `ip` fields.

**Validates: Requirements 10.1, 10.2**

---

### Property 22: Click Event Persistence Round-Trip

*For any* valid click event (with `queryId`, `documentId`, `userId`), after a successful POST to `/api/analytics/click`, querying MongoDB for that event should return a document with a `clickedAt` timestamp.

**Validates: Requirements 12.1**

---

### Property 23: Popular Queries Ordering

*For any* set of search events in the database, the `/api/analytics/popular` endpoint should return at most 10 items, and the items should be ordered by frequency in non-increasing order (the most-searched query first).

**Validates: Requirements 12.2**

---

### Property 24: Search Event Recording

*For any* search request, after the response is returned, a corresponding `SearchEvent` document should eventually exist in MongoDB containing the query string, filters, result count, and userId.

**Validates: Requirements 12.3**

---

### Property 25: Search History Ordering and Limit

*For any* userId with more than 20 search events, the `/api/analytics/history?userId=<id>` endpoint should return exactly 20 items ordered by `searchedAt` in non-increasing order (most recent first).

**Validates: Requirements 12.4**

---

### Property 26: Index Bootstrap Idempotence

*For any* number of application startup calls, the Elasticsearch index should exist exactly once with the correct mapping — calling the bootstrap function multiple times should not throw an error or create duplicate indices.

**Validates: Requirements 13.3**

---

### Property 27: Source Filtering — No Extra Fields in Results

*For any* search query, the documents in the `data` array should contain only the fields defined in the response schema (`_id`, `title`, `content`, `category`, `createdAt`, `_score`, and optionally `highlights`). No raw Elasticsearch internal fields or unmapped document fields should leak through.

**Validates: Requirements 13.4**

---

## Error Handling

### Error Types and HTTP Codes

| Error Type | HTTP Code | Error Code | When |
|---|---|---|---|
| Validation failure | 400 | `VALIDATION_ERROR` | Missing/invalid fields |
| Not found | 404 | `NOT_FOUND` | Document ID doesn't exist, unknown route |
| Rate limit exceeded | 429 | `RATE_LIMIT_EXCEEDED` | Too many requests from one IP |
| Internal server error | 500 | `INTERNAL_SERVER_ERROR` | Unhandled exceptions, ES/MongoDB failures |

### Error Response Format (always)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "title is required"
  }
}
```

For validation errors with multiple violations:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "title", "message": "title is required" },
      { "field": "content", "message": "content must not exceed 100000 characters" }
    ]
  }
}
```

### Error Propagation Pattern

Services throw typed errors (e.g., `NotFoundError`, `ValidationError`, `InternalError`). Controllers do not catch errors — they let them propagate to the global `errorHandler` middleware via `next(err)`. The error handler maps error types to HTTP codes and formats the response.

```javascript
// Example custom error classes
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
  }
}

class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = 'VALIDATION_ERROR';
    this.details = details;
  }
}
```

### Rollback Strategy

When Elasticsearch indexing fails after a MongoDB write (or vice versa), the service must attempt a compensating action:

```
MongoDB write succeeds → ES index fails
  → DELETE from MongoDB
  → throw InternalError (HTTP 500)

MongoDB delete succeeds → ES delete fails
  → Log inconsistency (document exists in ES but not MongoDB)
  → throw InternalError (HTTP 500)
  → (Manual reconciliation required — log contains enough info)
```

Note: True distributed transactions across MongoDB and Elasticsearch are not possible without a saga/outbox pattern. For this system, the compensating delete approach is sufficient. The inconsistency window is logged so operators can reconcile manually if needed.

---

## Testing Strategy

### Dual Testing Approach

This system uses two complementary testing strategies:

1. **Unit / Integration tests** — verify specific examples, edge cases, and error conditions
2. **Property-based tests** — verify universal properties across hundreds of randomly generated inputs

Neither alone is sufficient. Unit tests catch concrete bugs you thought of; property tests catch bugs you didn't think of.

### Property-Based Testing Library

**Recommended library:** `fast-check` (JavaScript/TypeScript)

```bash
npm install --save-dev fast-check
```

`fast-check` generates random inputs, shrinks failing cases to the minimal reproducing example, and integrates with Jest/Vitest.

### Property Test Configuration

Each property test should run a minimum of **100 iterations** (fast-check default is 100, increase for critical properties):

```javascript
// Example property test structure
import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

describe('Search Engine Backend', () => {
  // Feature: search-engine-backend, Property 3: Validation rejects invalid inputs
  it('rejects document creation when title is missing or empty', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.oneof(fc.constant(''), fc.constant(null), fc.constant(undefined)),
          content: fc.string({ minLength: 1 })
        }),
        async (invalidDoc) => {
          const response = await request(app).post('/api/documents').send(invalidDoc);
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Tag Format

Every property test must include a comment referencing the design property:

```javascript
// Feature: search-engine-backend, Property <N>: <property_text>
```

### Test File Organization

```
tests/
├── unit/
│   ├── services/
│   │   ├── documentService.test.js
│   │   ├── searchService.test.js
│   │   └── analyticsService.test.js
│   ├── utils/
│   │   └── cacheManager.test.js
│   └── middlewares/
│       ├── validator.test.js
│       └── errorHandler.test.js
├── integration/
│   ├── documents.test.js    # Full HTTP round-trips
│   ├── search.test.js
│   └── analytics.test.js
└── property/
    ├── documents.property.test.js
    ├── search.property.test.js
    ├── analytics.property.test.js
    └── cache.property.test.js
```

### Unit Test Focus Areas

Unit tests should cover:
- Specific examples that demonstrate correct behavior (e.g., "a document with title 'hello' is returned when searching for 'hello'")
- Edge cases: empty result sets, single-character queries, maximum-length inputs
- Error conditions: ES connection failure, MongoDB timeout, malformed IDs
- Index mapping verification (one-time example test)
- Rate limit threshold examples (exactly at limit, one over limit)
- Bulk API usage when document count > 50

### Property Test Focus Areas

Each of the 27 correctness properties above should be implemented as a single property-based test. Key generators to build:

```javascript
// Arbitrary generators
const validDocument = fc.record({
  title: fc.string({ minLength: 1, maxLength: 500 }),
  content: fc.string({ minLength: 1, maxLength: 100000 }),
  category: fc.constantFrom('tech', 'science', 'news', 'general')
});

const validSearchParams = fc.record({
  q: fc.string({ minLength: 1 }),
  page: fc.integer({ min: 1, max: 100 }),
  limit: fc.integer({ min: 1, max: 50 }),
  sort: fc.constantFrom('_score', 'date_asc', 'date_desc')
});

const invalidDateString = fc.string().filter(s => isNaN(Date.parse(s)));

const htmlString = fc.string().map(s => `<script>${s}</script><b>${s}</b>`);
```

### Test Environment Setup

Property tests that hit real databases should use:
- A dedicated test MongoDB database (wiped before each test suite)
- A dedicated test Elasticsearch index (wiped before each test suite)
- A dedicated Redis database (DB index 1 for tests, DB index 0 for dev)

For unit tests of services, mock the database clients using `jest.mock()` or `vitest`'s `vi.mock()`.
