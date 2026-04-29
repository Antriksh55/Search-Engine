# Elasticsearch & Caching Layer — Full Documentary

This document explains everything about how Elasticsearch and Redis caching work
in this project. Written in simple language so even a beginner can understand.

---

# PART 1 — ELASTICSEARCH

---

## What is Elasticsearch?

Elasticsearch is a search engine. You give it documents (text data), it stores
them in a special way so you can search through millions of them in milliseconds.

Normal databases like MongoDB or MySQL are good at storing and retrieving data.
But they are NOT good at searching. If you do:

```sql
SELECT * FROM documents WHERE content LIKE '%nodejs%'
```

This scans every single row. With 10 million rows, this takes seconds. That's too slow.

Elasticsearch solves this with something called an **Inverted Index**.

---

## Inverted Index — The Core Idea

Imagine you have 3 documents:

```
Doc 1: "Node.js is a JavaScript runtime"
Doc 2: "JavaScript is used for web development"
Doc 3: "Node.js and JavaScript work together"
```

A normal database stores it as-is. Elasticsearch breaks every document into words
and builds a reverse lookup table:

```
"node"        → [Doc1, Doc3]
"javascript"  → [Doc1, Doc2, Doc3]
"runtime"     → [Doc1]
"web"         → [Doc2]
"development" → [Doc2]
"work"        → [Doc3]
```

Now when you search "javascript", Elasticsearch doesn't scan documents.
It just looks up "javascript" in this table → instantly gets [Doc1, Doc2, Doc3].

This is why search is fast. It's like the index at the back of a textbook.
You don't read the whole book to find a topic — you look it up in the index.

---

## How Documents Get Indexed in This Project

When you call `POST /api/documents`, this happens:

```
1. Request comes in
2. Validator checks title and content are present
3. documentService.create() is called
4. Document is saved to MongoDB (raw storage)
5. Document is indexed in Elasticsearch (for search)
```

The Elasticsearch part looks like this in `documentService.js`:

```js
await esClient.index({
  index: 'documents',
  id: doc._id.toString(),
  document: {
    title: doc.title,
    content: doc.content,
    category: doc.category,
    createdAt: doc.createdAt,
  }
});
```

This sends the document to Elasticsearch which then:
- Breaks the text into tokens (words)
- Runs them through an analyzer
- Builds the inverted index entries
- Stores the document for retrieval

---

## Analyzers — How Text is Processed

Before indexing, Elasticsearch runs text through an **analyzer**.
An analyzer does 3 things:

1. **Character filter** — removes HTML tags, special characters
2. **Tokenizer** — splits text into words ("Node.js runtime" → ["Node", "js", "runtime"])
3. **Token filter** — lowercases, removes stop words, stems words

In this project, two analyzers are used:

### English Analyzer (used on `title` field)

```js
title: {
  type: 'text',
  analyzer: 'english'
}
```

The English analyzer:
- Lowercases everything ("Node.js" → "node.js")
- Removes stop words ("is", "a", "the", "and" are ignored)
- Stems words ("running" → "run", "searches" → "search")

So if someone searches "searching", it still finds documents with "search" or "searches".

### Standard Analyzer (used on `content` field)

```js
content: {
  type: 'text',
  analyzer: 'standard'
}
```

The Standard analyzer:
- Lowercases everything
- Splits on whitespace and punctuation
- Does NOT stem words

---

## Index Mapping — The Schema

Just like MongoDB has schemas (Mongoose), Elasticsearch has **mappings**.
The mapping tells Elasticsearch what type each field is and how to index it.

Here is the mapping used in this project (`src/config/elasticsearch.js`):

```js
mappings: {
  properties: {
    title: {
      type: 'text',
      analyzer: 'english',      // analyzed for full-text search
      fields: {
        suggest: { type: 'completion' },  // for autocomplete
        keyword: { type: 'keyword' },     // for exact match / sorting
      }
    },
    content: {
      type: 'text',
      analyzer: 'standard'
    },
    category: { type: 'keyword' },  // exact match only, not analyzed
    createdAt: { type: 'date' }     // for date range filters and sorting
  }
}
```

### Field Types Explained

| Type | What it does |
|------|-------------|
| `text` | Analyzed for full-text search. "Node.js Runtime" becomes ["node", "js", "runtime"] |
| `keyword` | Stored as-is. Used for exact match, filtering, sorting. "technology" stays "technology" |
| `date` | Stored as a timestamp. Used for range queries and sorting by date |
| `completion` | Special type for autocomplete. Optimized for prefix matching |

---

## The Search Query — How It Works

When you call `GET /api/search?q=nodejs`, this is the Elasticsearch query built:

```js
{
  index: 'documents',
  from: 0,        // start from first result (pagination)
  size: 10,       // return 10 results
  _source: ['title', 'content', 'category', 'createdAt'],  // only these fields
  query: {
    bool: {
      must: {
        multi_match: {
          query: 'nodejs',
          fields: ['title^3', 'content^1'],  // title is 3x more important
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      },
      filter: []  // extra filters added here if category/date provided
    }
  }
}
```

### bool Query

A `bool` query combines multiple conditions:

- `must` — document MUST match this. Affects the relevance score.
- `filter` — document MUST match this. Does NOT affect score. Faster.
- `should` — document SHOULD match. Boosts score if it does.
- `must_not` — document MUST NOT match this.

### multi_match Query

Searches across multiple fields at once.

```js
fields: ['title^3', 'content^1']
```

`^3` means boost. A match in title is worth 3x more than a match in content.
So if "nodejs" appears in the title, that document ranks higher than one where
it only appears in the content.

### Fuzziness

```js
fuzziness: 'AUTO'
```

This allows typos. Elasticsearch calculates how many character changes are needed
to match a word. With AUTO:
- 1-2 character words: no fuzziness
- 3-5 character words: 1 edit allowed ("nodjs" → "nodejs")
- 6+ character words: 2 edits allowed

So users don't need to spell perfectly.

---

## Relevance Scoring — How _score is Calculated

Every search result has a `_score`. Higher score = more relevant = shown first.

The score is based on **TF-IDF** (Term Frequency — Inverse Document Frequency):

### Term Frequency (TF)
How many times does the search word appear in the document?
More occurrences = higher score.

```
Doc A: "nodejs nodejs nodejs" → TF = 3 (high)
Doc B: "nodejs is great"     → TF = 1 (low)
```

### Inverse Document Frequency (IDF)
How rare is the word across ALL documents?
Rare words are more meaningful than common words.

```
"nodejs" appears in 2 out of 100 docs → rare → high IDF → boosts score
"the"   appears in 99 out of 100 docs → common → low IDF → barely boosts score
```

### Final Score Formula (simplified)
```
score = TF × IDF × field_boost × document_length_normalization
```

The `title^3` boost multiplies the title score by 3 before combining with content score.

---

## Filters — Category and Date

Filters are different from queries. They don't affect the score, they just
include or exclude documents.

### Category Filter

```js
{ term: { category: 'technology' } }
```

Only returns documents where category is exactly "technology".
Uses the `keyword` type — no analysis, exact match.

### Date Range Filter

```js
{
  range: {
    createdAt: {
      gte: '2026-01-01T00:00:00Z',  // greater than or equal
      lte: '2026-12-31T23:59:59Z'   // less than or equal
    }
  }
}
```

Only returns documents created within this date range.

---

## Highlighting

When `highlight=true` is passed, Elasticsearch wraps matched words in `<em>` tags:

```js
highlight: {
  fields: {
    title: {},
    content: {}
  }
}
```

Response includes:
```json
"highlights": {
  "title": ["Introduction to <em>Node.js</em>"],
  "content": ["<em>Node.js</em> is a JavaScript runtime..."]
}
```

This lets you show users exactly WHY a result matched their search.

---

## Autocomplete — Completion Suggester

The `title.suggest` field uses the `completion` type:

```js
title: {
  fields: {
    suggest: { type: 'completion' }
  }
}
```

When you call `GET /api/search/autocomplete?q=nod`, Elasticsearch uses this field
to find all titles that START with "nod":

```js
{
  suggest: {
    title_suggest: {
      prefix: 'nod',
      completion: {
        field: 'title.suggest',
        size: 10
      }
    }
  }
}
```

Returns: ["Node.js Guide", "Node.js Runtime", "NoSQL Databases", ...]

This is much faster than a regular search because the completion field is
optimized specifically for prefix matching.

---

## Pagination

```js
from: (page - 1) * limit,
size: limit
```

Example: page=2, limit=10
- from = (2-1) × 10 = 10 (skip first 10 results)
- size = 10 (return next 10)

So you get results 11-20. This is how all paginated APIs work.

---

## Shards and Replicas

In `src/config/elasticsearch.js`:

```js
settings: {
  number_of_shards: 2,
  number_of_replicas: 1
}
```

### Shards
An index is split into shards. Each shard is a separate Lucene index.
With 2 shards, your data is split across 2 pieces. Queries run on both
shards in parallel and results are merged. This is how Elasticsearch
scales to billions of documents.

### Replicas
Each shard has 1 replica (copy). If a shard fails, the replica takes over.
This is how Elasticsearch stays available even when nodes go down.

---

# PART 2 — CACHING LAYER (REDIS)

---

## What is Caching?

Caching means storing the result of an expensive operation so you don't
have to do it again.

Without cache:
```
User searches "nodejs" → hits Elasticsearch → 50ms → returns result
User searches "nodejs" again → hits Elasticsearch again → 50ms → same result
```

With cache:
```
User searches "nodejs" → hits Elasticsearch → 50ms → saves to Redis → returns result
User searches "nodejs" again → hits Redis → 1ms → returns same result
```

50x faster on repeated searches. This is huge at scale.

---

## What is Redis?

Redis is an **in-memory** data store. It stores data in RAM, not on disk.
RAM is 100x faster than disk. That's why Redis is so fast.

Redis stores key-value pairs:
```
key: "search:nodejs:page1:limit10"
value: { total: 5, data: [...] }
```

---

## How Caching Works in This Project

The cache logic is in `src/utils/cacheManager.js`. Here's the full flow:

### Step 1 — Build Cache Key

```js
const cacheKey = buildSearchKey({
  q: 'nodejs',
  page: 1,
  limit: 10,
  sort: '_score'
});
// Result: "search:nodejs:limit:10:page:1:sort:_score"
```

Every unique combination of search parameters gets a unique key.
So `q=nodejs&page=1` and `q=nodejs&page=2` are stored separately.

### Step 2 — Check Cache (Cache Lookup)

```js
const cached = await get(cacheKey);
if (cached) {
  return { ...cached, cacheHit: true };
}
```

If the key exists in Redis, return it immediately. Skip Elasticsearch entirely.
The response header will be `X-Cache: HIT`.

### Step 3 — Cache Miss → Query Elasticsearch

If the key doesn't exist in Redis, query Elasticsearch normally.
This is called a **cache miss**.

### Step 4 — Store Result in Redis

```js
await set(cacheKey, result, 300);
```

Store the result with a TTL (Time To Live) of 300 seconds (5 minutes).
After 5 minutes, Redis automatically deletes it.

### Step 5 — Return Result

Return the result with `cacheHit: false`.
The response header will be `X-Cache: MISS`.

---

## TTL — Time To Live

```js
await set(cacheKey, result, 300);  // 300 seconds = 5 minutes
```

TTL means the cached data expires automatically after 5 minutes.
After expiry, the next request will hit Elasticsearch again and refresh the cache.

Why 5 minutes? Because search results don't change that frequently.
If someone adds a new document, it won't appear in cached results for up to 5 minutes.
That's an acceptable tradeoff for the speed gain.

---

## Cache Invalidation

Cache invalidation means deciding when to clear the cache.

In this project, two strategies are used:

### 1. TTL-based (automatic)
Every cache entry expires after 300 seconds. No manual work needed.

### 2. Manual invalidation on document changes
When a document is added or deleted, the cache for affected searches
should ideally be cleared. This is a known tradeoff — this project uses
TTL-based invalidation for simplicity.

In production systems, you'd also clear specific cache keys when data changes.

---

## X-Cache Header

```js
res.set('X-Cache', result.cacheHit ? 'HIT' : 'MISS');
```

This header tells you (and any proxy/CDN) where the result came from:

- `X-Cache: HIT` → served from Redis (fast, ~1ms)
- `X-Cache: MISS` → served from Elasticsearch (~10-50ms), now cached

You can see this in browser DevTools → Network tab → Response Headers.

---

## Redis Data Structure Used

Redis supports many data types. This project uses **Strings** with JSON:

```js
// Store
await redisClient.setex(key, ttlSeconds, JSON.stringify(value));

// Retrieve
const raw = await redisClient.get(key);
const value = JSON.parse(raw);
```

`setex` = SET with EXpiry. Sets the key and TTL in one command.

---

## Why Not Cache Everything?

Caching is not always the right answer. Things NOT cached in this project:

- `POST /api/documents` — writes should never be cached
- `DELETE /api/documents/:id` — same reason
- `GET /api/analytics/history` — personal data, changes frequently
- `GET /api/analytics/popular` — needs to be real-time

Only search results are cached because:
- They are read-heavy (same query asked many times)
- They are expensive to compute (Elasticsearch query)
- They don't change every second

---

## Redis Connection

In `src/config/redis.js`:

```js
const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null
});
```

`maxRetriesPerRequest: null` means ioredis retries indefinitely if Redis is down.
The app degrades gracefully — if Redis is unavailable, every request goes to
Elasticsearch directly. Slower, but still works.

---

## Summary — Full Search Request Flow

Here is what happens from the moment you type a search to getting results:

```
1. Browser sends: GET /api/search?q=nodejs&page=1

2. Express receives the request

3. Middleware pipeline runs:
   - helmet() adds security headers
   - cors() allows cross-origin requests
   - express.json() parses body
   - requestLogger() logs the request
   - globalLimiter() checks rate limit (100 req/15min per IP)
   - validateSearch() validates and coerces query params

4. searchController.search() is called

5. searchService.search() is called with params

6. Cache key is built: "search:nodejs:limit:10:page:1:sort:_score"

7. Redis is checked:
   - HIT → return cached result immediately (1ms)
   - MISS → continue to step 8

8. Elasticsearch query is built:
   - multi_match on title^3 + content^1
   - fuzziness: AUTO
   - from: 0, size: 10

9. Elasticsearch executes the query:
   - Looks up "nodejs" in inverted index
   - Finds matching documents
   - Calculates TF-IDF scores
   - Applies field boosts
   - Sorts by score descending
   - Returns top 10 results

10. Results are mapped to clean objects

11. Analytics recorded asynchronously (fire-and-forget):
    - SearchEvent saved to MongoDB with query, userId, resultCount, timestamp

12. Result stored in Redis with 300s TTL

13. Response sent to client:
    {
      success: true,
      page: 1,
      limit: 10,
      total: 3,
      data: [
        { title: "...", content: "...", _score: 3.45 },
        ...
      ]
    }

14. X-Cache: MISS header set on response
```

Total time: ~10-50ms (Elasticsearch) or ~1ms (Redis cache hit)

---

That's the complete picture of how Elasticsearch and Redis work together
in this project to deliver fast, relevant search results.
