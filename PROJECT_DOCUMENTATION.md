# Search Engine Backend — Complete Project Documentation

**Project Name:** Search Engine Backend (Mini Google)
**Tech Stack:** Node.js, Express.js, Elasticsearch, MongoDB, Redis, Joi, Winston, Docker
**Type:** Backend REST API
**Architecture:** MVC (Model-View-Controller)

---

## 1. PROJECT OVERVIEW

This project is a production-level Search Engine Backend built from scratch. It works like the backend of Google — you store documents (articles, posts, any text content), and the system lets you search through them instantly with ranked, relevant results.

The project is not a simple keyword match. It uses Elasticsearch — the same technology used by Wikipedia, GitHub, Netflix, and Uber — to power real full-text search with relevance scoring, fuzzy matching, autocomplete, and analytics.

The system is designed to handle large-scale data efficiently with caching, rate limiting, and proper error handling — making it production-ready, not just a college project.

---

## 2. PROBLEM STATEMENT

Traditional databases like MySQL or MongoDB are not built for search. If you search for "nodejs tutorial" in a MongoDB collection with 1 million documents using a simple query, it scans every single document — which takes seconds.

Real search engines need to:
- Return results in milliseconds
- Rank results by relevance (most useful first)
- Handle typos ("nodjs" should still find "nodejs")
- Search across multiple fields simultaneously
- Scale to millions of documents

This project solves all of these problems.

---

## 3. SYSTEM ARCHITECTURE

```
Client (Browser / Postman)
        |
        | HTTP Request
        v
+------------------+
|   Express Server  |
|   (Node.js)       |
+------------------+
        |
        | Middleware Pipeline
        | (Helmet → CORS → JSON Parser → Logger → Rate Limiter → Validator)
        v
+------------------+
|   Controller      |
|   (HTTP Layer)    |
+------------------+
        |
        v
+------------------+
|   Service Layer   |
|   (Business Logic)|
+------------------+
        |
   _____|_____
  |           |
  v           v
+-------+  +-------------+
| Redis |  | Elasticsearch|
| Cache |  | (Search)     |
+-------+  +-------------+
                |
                v
          +----------+
          | MongoDB  |
          | (Storage)|
          +----------+
```

**Flow:**
1. Request comes in
2. Middleware validates and processes it
3. Controller extracts parameters
4. Service checks Redis cache first
5. If cache miss → queries Elasticsearch
6. Records analytics to MongoDB asynchronously
7. Stores result in Redis cache
8. Returns response to client

---

## 4. FOLDER STRUCTURE

```
SEngine/
├── src/
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   ├── elasticsearch.js   # Elasticsearch client + index bootstrap
│   │   └── redis.js           # Redis client
│   ├── controllers/
│   │   ├── searchController.js      # Handles search HTTP requests
│   │   ├── documentController.js    # Handles document HTTP requests
│   │   └── analyticsController.js   # Handles analytics HTTP requests
│   ├── routes/
│   │   ├── searchRoutes.js          # GET /api/search, GET /api/search/autocomplete
│   │   ├── documentRoutes.js        # POST, GET, DELETE /api/documents
│   │   └── analyticsRoutes.js       # POST /click, GET /popular, GET /history
│   ├── services/
│   │   ├── searchService.js         # Core search logic
│   │   ├── documentService.js       # Document CRUD logic
│   │   └── analyticsService.js      # Analytics recording and retrieval
│   ├── models/
│   │   ├── Document.js              # MongoDB Document schema
│   │   ├── SearchEvent.js           # MongoDB SearchEvent schema
│   │   └── ClickEvent.js            # MongoDB ClickEvent schema
│   ├── middlewares/
│   │   ├── validator.js             # Joi input validation
│   │   ├── rateLimiter.js           # Rate limiting (100 req/15min)
│   │   ├── logger.js                # Winston request logging
│   │   └── errorHandler.js          # Global error handler
│   ├── utils/
│   │   ├── cacheManager.js          # Redis get/set helpers
│   │   └── errors.js                # Custom error classes
│   ├── app.js                       # Express app setup
│   └── server.js                    # Server startup + DB connections
├── tests/
│   ├── unit/                        # Unit tests
│   ├── integration/                 # Integration tests
│   └── property/                    # Property-based tests
├── .env                             # Environment variables (not in git)
├── .env.example                     # Template for environment variables
├── .gitignore
├── package.json
└── README.md
```

**Why MVC Architecture?**
- **Model** — MongoDB schemas define data structure
- **Controller** — handles HTTP request/response only
- **Service** — contains all business logic (search, caching, analytics)
- This separation makes code testable, maintainable, and scalable

---

## 5. TECHNOLOGY STACK — DETAILED

### Node.js
JavaScript runtime built on Chrome's V8 engine. Used for the server because it is non-blocking and event-driven — perfect for I/O heavy operations like database queries and API calls.

### Express.js
Web framework for Node.js. Handles routing, middleware, and HTTP request/response cycle. All API endpoints are defined using Express.

### Elasticsearch
Distributed search and analytics engine. The core of this project. Uses inverted index for millisecond-level full-text search. Handles ranking, fuzzy matching, highlighting, autocomplete, and filtering.

### MongoDB
NoSQL document database. Stores raw documents and analytics events (search history, click events). Used alongside Elasticsearch in a dual-write pattern — document saved in both MongoDB (raw storage) and Elasticsearch (search index).

### Redis
In-memory data store. Used as a caching layer. Stores search results for 5 minutes so repeated searches don't hit Elasticsearch every time. Reduces response time from ~50ms to ~1ms on cache hits.

### Joi
Input validation library. Validates all incoming API parameters before they reach the business logic. Prevents bad data, SQL injection attempts, and crashes from unexpected input.

### Winston
Logging library. Logs every request as structured JSON with method, URL, status code, response time, and IP address. Essential for debugging in production.

### Docker
Used to run MongoDB, Elasticsearch, and Redis as containers. Makes the project portable — anyone can run it with 3 Docker commands regardless of their OS.

---

## 6. ALL API ENDPOINTS

### Document APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents` | Add a new document to MongoDB + Elasticsearch |
| GET | `/api/documents` | Get all documents with pagination |
| GET | `/api/documents/:id` | Get a single document by ID |
| DELETE | `/api/documents/:id` | Delete document from MongoDB + Elasticsearch |

**POST /api/documents — Request Body:**
```json
{
  "title": "Introduction to Node.js",
  "content": "Node.js is a JavaScript runtime built on Chrome V8 engine.",
  "category": "technology"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "69be4f84ab01216136e23b3f",
    "title": "Introduction to Node.js",
    "content": "Node.js is a JavaScript runtime...",
    "category": "technology",
    "createdAt": "2026-03-21T07:57:56.667Z",
    "esId": "69be4f84ab01216136e23b3f"
  }
}
```

---

### Search APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=keyword` | Full-text search with ranking |
| GET | `/api/search/autocomplete?q=prefix` | Autocomplete suggestions |

**Search Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| q | string | required | Search keyword |
| page | number | 1 | Page number |
| limit | number | 10 | Results per page (max 100) |
| highlight | boolean | false | Highlight matched words |
| sort | string | _score | Sort by: _score, date_asc, date_desc |
| category | string | - | Filter by category |
| date_from | ISO date | - | Filter from date |
| date_to | ISO date | - | Filter to date |
| userId | string | anonymous | Track search history |

**Search Response:**
```json
{
  "success": true,
  "page": 1,
  "limit": 10,
  "total": 3,
  "data": [
    {
      "_id": "69be4faaab01216136e23b4b",
      "title": "How Search Engines Work",
      "content": "Search engines crawl the web...",
      "category": "technology",
      "createdAt": "2026-03-21T07:58:34.270Z",
      "_score": 3.6598177
    }
  ]
}
```

**Autocomplete Response:**
```json
{
  "success": true,
  "data": [
    { "text": "Node.js Guide", "score": 1.0 },
    { "text": "Node.js Runtime", "score": 1.0 }
  ]
}
```

---

### Analytics APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analytics/click` | Track when user clicks a result |
| GET | `/api/analytics/popular` | Get most searched keywords |
| GET | `/api/analytics/history?userId=abc` | Get search history for a user |

**History Response:**
```json
{
  "success": true,
  "data": [
    {
      "query": "redis",
      "resultCount": 1,
      "userId": "user123",
      "searchedAt": "2026-03-21T08:40:01.799Z"
    },
    {
      "query": "database",
      "resultCount": 2,
      "userId": "user123",
      "searchedAt": "2026-03-21T08:40:01.773Z"
    }
  ]
}
```

---

## 7. CORE FEATURES — DETAILED EXPLANATION

### 7.1 Full-Text Search

Not a simple `LIKE '%keyword%'` query. Elasticsearch breaks documents into tokens, builds an inverted index, and searches the index — not the documents themselves.

**Inverted Index Example:**
```
Documents:
  Doc1: "Node.js is a JavaScript runtime"
  Doc2: "JavaScript is used for web development"

Inverted Index:
  "node"        → [Doc1]
  "javascript"  → [Doc1, Doc2]
  "runtime"     → [Doc1]
  "web"         → [Doc2]
  "development" → [Doc2]
```

Searching "javascript" → instantly returns [Doc1, Doc2] without scanning documents.

### 7.2 Relevance Ranking

Every result has a `_score`. Results are sorted by score descending (most relevant first).

Score is calculated using TF-IDF:
- **TF (Term Frequency)** — how many times the keyword appears in the document
- **IDF (Inverse Document Frequency)** — how rare the keyword is across all documents
- **Field Boost** — title matches are 3x more valuable than content matches (`title^3`)

### 7.3 Fuzzy Search

`fuzziness: AUTO` allows typos:
- "nodjs" → finds "nodejs" (1 character edit)
- "elasticsearh" → finds "elasticsearch" (1 character edit)

### 7.4 Keyword Highlighting

With `highlight=true`:
```json
"highlights": {
  "title": ["Introduction to <em>Node.js</em>"],
  "content": ["<em>Node.js</em> is a JavaScript runtime..."]
}
```

Shows users exactly which part of the document matched their search.

### 7.5 Autocomplete

Uses Elasticsearch's `completion` suggester on the `title.suggest` field. Optimized for prefix matching — much faster than a regular search query.

`GET /api/search/autocomplete?q=nod` → returns titles starting with "nod"

### 7.6 Pagination

```
page=1, limit=10 → results 1-10
page=2, limit=10 → results 11-20
page=3, limit=10 → results 21-30
```

Response always includes `total` count for building pagination UI.

### 7.7 Filtering

**By category:**
```
GET /api/search?q=nodejs&category=technology
```

**By date range:**
```
GET /api/search?q=nodejs&date_from=2026-01-01T00:00:00Z&date_to=2026-12-31T23:59:59Z
```

**By sort order:**
```
GET /api/search?q=nodejs&sort=date_desc   (newest first)
GET /api/search?q=nodejs&sort=date_asc    (oldest first)
GET /api/search?q=nodejs&sort=_score      (most relevant first — default)
```

---

## 8. CACHING LAYER — DETAILED

### How It Works

```
Request: GET /api/search?q=nodejs

Step 1: Build cache key
  → "search:nodejs:limit:10:page:1:sort:_score"

Step 2: Check Redis
  → Key exists? Return cached result (1ms) — X-Cache: HIT
  → Key missing? Continue to Elasticsearch

Step 3: Query Elasticsearch (~50ms)

Step 4: Store result in Redis with 300s TTL

Step 5: Return result — X-Cache: MISS
```

### Cache Key Strategy

Every unique combination of parameters gets its own cache key:
- `q=nodejs&page=1` → different key from `q=nodejs&page=2`
- `q=nodejs&category=tech` → different key from `q=nodejs`

### TTL (Time To Live)

Results cached for 300 seconds (5 minutes). After expiry, Redis deletes automatically. Next request refreshes the cache.

### Graceful Degradation

If Redis goes down, the app continues working — every request goes directly to Elasticsearch. Slower, but never crashes.

### X-Cache Header

Every search response includes:
- `X-Cache: HIT` — served from Redis (~1ms)
- `X-Cache: MISS` — served from Elasticsearch (~50ms), now cached

---

## 9. MIDDLEWARE PIPELINE

Every request passes through this pipeline in order:

```
1. helmet()        → Sets 14 security HTTP headers
2. cors()          → Allows cross-origin requests
3. express.json()  → Parses JSON request body
4. requestLogger() → Logs request details via Winston
5. globalLimiter() → Rate limiting: 100 requests/15min per IP
6. validateSearch()→ Joi validation of query parameters
7. Controller      → Business logic
8. errorHandler()  → Catches all errors, returns consistent response
```

### Rate Limiting

Prevents API abuse. If an IP sends more than 100 requests in 15 minutes:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later"
  }
}
```

### Input Validation (Joi)

Every query parameter is validated:
- `q` must be present and non-empty
- `page` must be a positive integer
- `limit` must be between 1 and 100
- `sort` must be one of: `_score`, `date_asc`, `date_desc`
- `date_from` / `date_to` must be valid ISO 8601 dates

Invalid input returns HTTP 400 with clear error message.

### Global Error Handler

All errors — validation errors, database errors, not found errors — return the same consistent shape:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Route GET / not found"
  }
}
```

---

## 10. ANALYTICS SYSTEM

### What is Tracked

**Search Events** (every search):
- Query string
- Filters applied
- Result count
- User ID
- Timestamp

**Click Events** (when user clicks a result):
- Query ID
- Document ID clicked
- User ID
- Timestamp

### Fire-and-Forget Pattern

Analytics are recorded asynchronously using `setImmediate()`:
```js
setImmediate(() => {
  analyticsService.recordSearch(q, filters, resultCount, userId)
    .catch(console.error);
});
```

This means analytics recording NEVER slows down the search response. The user gets their results first, analytics are saved in the background.

### Search History

Per-user search history stored in MongoDB:
```
GET /api/analytics/history?userId=user123
```
Returns last 20 searches sorted by most recent first.

### Popular Searches

Aggregates most frequent queries across all users:
```
GET /api/analytics/popular
```

---

## 11. DATABASE SCHEMAS

### Document Schema (MongoDB)
```
title      : String (required)
content    : String (required)
category   : String
createdAt  : Date (auto)
esId       : String (Elasticsearch document ID)
```

### SearchEvent Schema (MongoDB)
```
query      : String (required)
filters    : Object
resultCount: Number
userId     : String (default: 'anonymous')
searchedAt : Date (auto)
```

### ClickEvent Schema (MongoDB)
```
queryId    : String
documentId : String
userId     : String
clickedAt  : Date (auto)
```

### Elasticsearch Index Mapping
```
title      : text (english analyzer) + completion (autocomplete) + keyword (exact)
content    : text (standard analyzer)
category   : keyword (exact match)
createdAt  : date
```

---

## 12. ELASTICSEARCH INDEX SETTINGS

```json
{
  "settings": {
    "number_of_shards": 2,
    "number_of_replicas": 1
  }
}
```

**Shards:** Index split into 2 pieces. Queries run on both in parallel. This is how Elasticsearch scales to billions of documents.

**Replicas:** 1 backup copy per shard. If a shard fails, replica takes over. High availability.

---

## 13. COMPLETE FEATURE CHECKLIST

| Feature | Status | Implementation |
|---------|--------|----------------|
| Full-text search | ✅ | Elasticsearch multi_match query |
| Case-insensitive search | ✅ | Elasticsearch analyzers handle this |
| Search in multiple fields | ✅ | title + content simultaneously |
| Result count | ✅ | `total` field in every response |
| No-result handling | ✅ | Returns `total: 0, data: []` |
| Relevance ranking | ✅ | TF-IDF scoring, title^3 boost |
| Keyword highlighting | ✅ | `highlight=true` parameter |
| Fuzzy search (typo tolerance) | ✅ | `fuzziness: AUTO` |
| Autocomplete | ✅ | Elasticsearch completion suggester |
| Pagination | ✅ | `page` and `limit` parameters |
| Sort by date | ✅ | `sort=date_asc` or `sort=date_desc` |
| Filter by category | ✅ | `category=technology` parameter |
| Filter by date range | ✅ | `date_from` and `date_to` parameters |
| Redis caching | ✅ | 300s TTL, cache hit/miss headers |
| Search history | ✅ | Per-user, last 20 searches |
| Popular searches | ✅ | Most frequent queries |
| Click tracking | ✅ | Analytics click events |
| Rate limiting | ✅ | 100 requests/15min per IP |
| Input validation | ✅ | Joi schema validation |
| Global error handling | ✅ | Consistent error response shape |
| Request logging | ✅ | Winston structured JSON logs |
| Security headers | ✅ | Helmet middleware |
| CORS | ✅ | Cross-origin requests allowed |
| MVC Architecture | ✅ | Controllers, Services, Models |
| Dual-write pattern | ✅ | MongoDB + Elasticsearch sync |
| Graceful Redis degradation | ✅ | Works without Redis |
| Async analytics | ✅ | Fire-and-forget, never blocks response |
| X-Cache header | ✅ | HIT/MISS cache indicator |

**Total: 28 features implemented**

---

## 14. HOW TO RUN

### Prerequisites
- Node.js v18+
- Docker Desktop

### Step 1 — Start Services
```bash
docker run -d --name mongodb -p 27017:27017 mongo:7
docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" -e "xpack.security.enabled=false" docker.elastic.co/elasticsearch/elasticsearch:8.13.0
docker run -d --name redis -p 6379:6379 redis:7
```

### Step 2 — Setup Project
```bash
git clone https://github.com/Antriksh55/Search-Engine.git
cd Search-Engine
npm install
cp .env.example .env
```

### Step 3 — Configure .env
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/searchengine
ELASTICSEARCH_URL=http://localhost:9200
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

### Step 4 — Start Server
```bash
npm run dev
```

### Expected Output
```
Redis connected
MongoDB connected
Elasticsearch index 'documents' ready
Server running on port 3000
Environment: development
```

---

## 15. SAMPLE API USAGE

### Add a Document
```
POST http://localhost:3000/api/documents
Content-Type: application/json

{
  "title": "Introduction to Node.js",
  "content": "Node.js is a JavaScript runtime built on Chrome V8 engine.",
  "category": "technology"
}
```

### Basic Search
```
GET http://localhost:3000/api/search?q=nodejs
```

### Search with All Options
```
GET http://localhost:3000/api/search?q=nodejs&page=1&limit=5&highlight=true&sort=date_desc&category=technology&userId=user123
```

### Autocomplete
```
GET http://localhost:3000/api/search/autocomplete?q=nod
```

### Search History
```
GET http://localhost:3000/api/analytics/history?userId=user123
```

### Popular Searches
```
GET http://localhost:3000/api/analytics/popular
```

---

## 16. WHAT MAKES THIS PROJECT DIFFERENT

Most student projects are:
- Simple CRUD apps (create, read, update, delete)
- Use only one database
- No caching
- No proper error handling
- No input validation
- No logging
- No analytics

This project has:
- 3 databases working together (Elasticsearch + MongoDB + Redis)
- Production-grade middleware pipeline
- Real search engine concepts (inverted index, TF-IDF, fuzzy matching)
- Caching layer with proper invalidation strategy
- Analytics system with async recording
- 28 features implemented
- Clean MVC architecture

This is the kind of backend system that powers real products at scale.

---

*Documentation prepared for: Search Engine Backend Project*
*Tech Stack: Node.js, Express.js, Elasticsearch, MongoDB, Redis, Joi, Winston, Docker*
