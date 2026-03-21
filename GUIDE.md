# Search Engine Backend — Beginner's Complete Guide

> Welcome! This guide is written for someone who is new to backend development.
> Think of this as a senior engineer sitting next to you, walking you through
> every piece of this project. Take your time, follow the links, and don't
> worry if something doesn't click immediately — it will.

---

## Table of Contents

1. [What You Need to Study First (Prerequisites)](#section-1-what-you-need-to-study-first-prerequisites)
2. [Project Overview](#section-2-project-overview)
3. [How Search Engines Work Internally](#section-3-how-search-engines-work-internally)
4. [Folder Structure Explained](#section-4-folder-structure-explained)
5. [Data Flow Walkthroughs](#section-5-data-flow-walkthroughs)
6. [Every File Explained](#section-6-every-file-explained)
7. [API Reference](#section-7-api-reference)
8. [How to Run the Project](#section-8-how-to-run-the-project)
9. [System Design — Interview Prep](#section-9-system-design--interview-prep)
10. [Deployment Guide](#section-10-deployment-guide)
11. [What to Build Next (Learning Path)](#section-11-what-to-build-next-learning-path)

---

## Section 1: What You Need to Study First (Prerequisites)

Before diving into this project, you'll want a solid foundation in the topics below. Don't skip this section — understanding these concepts will make everything else click much faster.

---

### 1.1 JavaScript Fundamentals

**What it is:** JavaScript is the programming language this entire project is written in. It runs both in browsers and on servers (via Node.js). You need to be comfortable with variables, functions, objects, arrays, and especially asynchronous programming.

**Key concepts to understand:**
- Variables: `const`, `let`, `var` — and why `const` is preferred
- Functions: regular functions, arrow functions (`=>`), and the difference
- Promises: a way to handle operations that take time (like reading from a database)
- `async/await`: cleaner syntax for working with Promises — you'll see this everywhere in this project
- Callbacks: the older way of handling async operations (still used in some libraries)
- Destructuring: `const { title, content } = req.body` — extracting values from objects
- Spread operator: `{ ...result, cacheHit: false }` — merging objects together
- Template literals: `` `search:${queryString}` `` — embedding variables in strings

**What to study:**
- [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide) — start with "Grammar and types", then "Promises", then "async/await"
- [javascript.info](https://javascript.info) — one of the best free resources, very beginner-friendly

**Why it matters for this project:** Every single file is JavaScript. If you don't understand `async/await`, you won't understand how the database calls work. If you don't understand destructuring, the controller code will look like magic.

---

### 1.2 Node.js Basics

**What it is:** Node.js is a runtime that lets you run JavaScript outside of a browser — on a server. It's built on Chrome's V8 engine. The key difference from browser JavaScript is that Node.js has access to the file system, network, and operating system, but it does NOT have `window`, `document`, or DOM APIs.

**Key concepts to understand:**
- `require()` and `module.exports` — how Node.js shares code between files (CommonJS modules)
- `process.env` — how Node.js reads environment variables (like database passwords)
- `process.exit(1)` — how to stop the Node.js process when something goes wrong
- The event loop — why Node.js can handle thousands of requests without multiple threads
- npm — the package manager for installing libraries

**What to study:**
- [Node.js official docs — Getting Started](https://nodejs.org/en/docs/guides/getting-started-guide)
- [Node.js official docs — Modules](https://nodejs.org/api/modules.html)

**Why it matters for this project:** This project IS a Node.js application. Understanding `require()` and `module.exports` is essential — every file uses them to import and export code.

---

### 1.3 HTTP Basics

**What it is:** HTTP (HyperText Transfer Protocol) is the language that browsers and servers use to talk to each other. Every time you visit a website or call an API, you're making an HTTP request and receiving an HTTP response.

**Key concepts to understand:**

HTTP Methods (what kind of action you're taking):
- `GET` — read data (no body, just a URL)
- `POST` — create new data (sends a body with the new data)
- `DELETE` — remove data

HTTP Status Codes (what happened):
- `200 OK` — success, here's your data
- `201 Created` — success, a new resource was created
- `400 Bad Request` — you sent something wrong (missing field, invalid format)
- `404 Not Found` — the resource you asked for doesn't exist
- `429 Too Many Requests` — you're sending too many requests, slow down
- `500 Internal Server Error` — something broke on the server side

HTTP Headers — extra metadata sent with requests and responses:
- `Content-Type: application/json` — tells the server the body is JSON
- `X-Cache: HIT` — a custom header this project uses to indicate a cache hit
- `Retry-After: 900` — tells the client how long to wait before retrying

**What to study:**
- [MDN HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview)
- [MDN HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

**Why it matters for this project:** This project IS an HTTP API. Every endpoint returns a specific status code. Understanding why we return 201 for creation and 404 for missing resources is fundamental.

---

### 1.4 REST APIs

**What it is:** REST (Representational State Transfer) is a set of conventions for designing HTTP APIs. A REST API uses URLs to identify resources and HTTP methods to describe what to do with them.

**Key concepts to understand:**
- Resources: things your API manages (in this project: documents, search results, analytics)
- Endpoints: URL + method combinations, like `POST /api/documents` or `GET /api/search`
- JSON: the data format REST APIs use — JavaScript Object Notation, looks like `{ "key": "value" }`
- Statelessness: each request contains all the information needed — the server doesn't remember previous requests

**Example REST design:**
```
POST   /api/documents       → create a document
GET    /api/documents       → list all documents
GET    /api/documents/:id   → get one document
DELETE /api/documents/:id   → delete one document
```

**What to study:**
- [MDN REST API Guide](https://developer.mozilla.org/en-US/docs/Glossary/REST)
- [restfulapi.net](https://restfulapi.net) — clear explanations with examples

**Why it matters for this project:** This project is a REST API. Every design decision — URL structure, status codes, response shapes — follows REST conventions.

---

### 1.5 MongoDB Basics

**What it is:** MongoDB is a document database. Instead of storing data in rows and columns like a spreadsheet (SQL), it stores data as JSON-like documents. A "collection" is like a table, and a "document" is like a row — but documents can have nested objects and arrays.

**Key concepts to understand:**
- Document: a JSON object stored in MongoDB, e.g. `{ title: "Hello", content: "World", _id: "abc123" }`
- Collection: a group of documents (like a table), e.g. the `documents` collection
- `_id`: MongoDB automatically adds a unique ID to every document
- CRUD: Create, Read, Update, Delete — the four basic database operations
- Mongoose: a Node.js library that adds schemas and validation on top of MongoDB

**What to study:**
- [MongoDB official docs — Introduction](https://www.mongodb.com/docs/manual/introduction/)
- [Mongoose official docs — Getting Started](https://mongoosejs.com/docs/index.html)

**Why it matters for this project:** MongoDB is where all documents, click events, and search events are stored. Mongoose models define the shape of that data.

---

### 1.6 Express.js Basics

**What it is:** Express is a minimal web framework for Node.js. It handles the low-level HTTP plumbing (parsing requests, sending responses) so you can focus on your application logic.

**Key concepts to understand:**
- `app.use()` — register middleware that runs for every request
- `app.get()`, `app.post()`, `app.delete()` — register route handlers for specific methods
- `req` (request) — the incoming HTTP request (contains body, params, query, headers)
- `res` (response) — the outgoing HTTP response (you call `res.json()`, `res.status()`)
- `next` — a function you call to pass control to the next middleware
- Middleware: a function that runs between the request arriving and the response being sent
- Router: a mini Express app for grouping related routes

**What to study:**
- [Express.js official docs](https://expressjs.com/en/guide/routing.html)
- [Express.js Getting Started](https://expressjs.com/en/starter/hello-world.html)

**Why it matters for this project:** Express is the HTTP framework this project is built on. Every route, middleware, and controller uses Express APIs.

---

### 1.7 What Elasticsearch Is

**What it is:** Elasticsearch is a search engine built on top of Apache Lucene. It's designed specifically for full-text search — finding documents that match a keyword, ranking them by relevance, and returning results in milliseconds even across millions of documents.

**Key concepts to understand:**
- Index: like a database table, but optimized for search
- Document: a JSON object stored in an index (similar to a MongoDB document)
- Inverted index: the data structure that makes fast search possible (explained in Section 3)
- Relevance score: a number that represents how well a document matches a query
- Analyzer: a pipeline that processes text before indexing (tokenization, stemming, etc.)
- Shard: a piece of an index — Elasticsearch splits large indices across multiple shards for performance

**What to study:**
- [Elasticsearch official docs — What is Elasticsearch?](https://www.elastic.co/guide/en/elasticsearch/reference/current/elasticsearch-intro.html)
- [Elasticsearch Getting Started](https://www.elastic.co/guide/en/elasticsearch/reference/current/getting-started.html)

**Why it matters for this project:** Elasticsearch is the core of the search functionality. Every search query, autocomplete suggestion, and relevance ranking goes through Elasticsearch.

---

### 1.8 What Redis Is

**What it is:** Redis is an in-memory data store — it keeps data in RAM instead of on disk. This makes it extremely fast (sub-millisecond reads). It's commonly used as a cache: store the result of an expensive operation in Redis, and serve it from memory on the next request.

**Key concepts to understand:**
- Key-value store: you store data with a key (like a variable name) and retrieve it by that key
- TTL (Time To Live): how long a key stays in Redis before it's automatically deleted
- Cache hit: the key exists in Redis — return the cached value (fast)
- Cache miss: the key doesn't exist — compute the value, store it, return it
- SCAN: a Redis command for iterating through keys without blocking the server

**What to study:**
- [Redis official docs — Introduction](https://redis.io/docs/about/)
- [Redis data types](https://redis.io/docs/data-types/)

**Why it matters for this project:** Redis sits in front of Elasticsearch. Repeated search queries are served from Redis in under 1ms instead of hitting Elasticsearch every time.

---

### 1.9 MVC Architecture Pattern

**What it is:** MVC stands for Model-View-Controller. It's a way of organizing code into three distinct layers, each with a clear responsibility. In a REST API, there's no HTML "view" — the JSON response IS the view.

**The three layers:**
- **Model** — defines the shape of your data (Mongoose schemas in this project)
- **View** — in a REST API, this is the JSON response body
- **Controller** — handles HTTP requests: reads from `req`, calls a service, writes to `res`
- **Service** — (an extension of MVC) contains business logic; knows about databases but not HTTP

**Why it matters for this project:** This project follows a strict MVC layout. Understanding which layer does what will help you navigate the codebase and know where to add new features.

---

## Section 2: Project Overview

### What This Project Does (Plain English)

This project is a "Mini Google" — a backend API that lets you:

1. **Store documents** — submit articles, blog posts, or any text content via an API
2. **Search them instantly** — type a keyword and get back ranked, relevant results in milliseconds
3. **Get autocomplete suggestions** — as you type, get title suggestions (like Google's search bar)
4. **Track analytics** — see which queries are most popular and what users click on
5. **Stay fast under load** — repeated searches are served from a cache instead of re-querying the search engine

### The Problem It Solves

Imagine you have a website with 100,000 articles. A user types "javascript async" in the search box. How do you find the most relevant articles quickly?

You can't just scan every article one by one — that would take seconds. You need a search engine that has pre-indexed all the content and can answer queries in milliseconds.

This project solves that problem. It provides:
- A REST API for ingesting and managing documents
- Full-text search powered by Elasticsearch (industry-standard search engine)
- Caching with Redis so popular searches are instant
- Analytics to understand what users are searching for

### The Tech Stack and Why Each Technology Was Chosen

| Technology | Role | Why |
|---|---|---|
| **Node.js + Express** | HTTP server | Fast, non-blocking I/O; huge ecosystem; easy to learn |
| **MongoDB + Mongoose** | Primary database | Flexible document storage; easy to evolve the schema |
| **Elasticsearch** | Search engine | Industry-standard full-text search with scoring, highlighting, autocomplete |
| **Redis** | Cache | Sub-millisecond reads from memory; built-in TTL support |
| **Joi** | Input validation | Declarative schema validation with clear error messages |
| **Winston** | Logging | Structured JSON logging; multiple output destinations |
| **express-rate-limit** | Rate limiting | Protects the API from abuse with minimal configuration |

### How the Pieces Connect (ASCII Diagram)

```
                        ┌─────────────────────────────────────────────┐
                        │              Your Application               │
                        │                                             │
  HTTP Request          │  ┌──────────┐  ┌───────────┐  ┌─────────┐  │
  ─────────────────────►│  │  helmet  │  │   cors    │  │  json   │  │
                        │  │(security)│  │(cross-    │  │ parser  │  │
                        │  └──────────┘  │ origin)   │  └─────────┘  │
                        │                └───────────┘               │
                        │  ┌──────────────────────────────────────┐  │
                        │  │         Request Logger               │  │
                        │  │  (logs every request as JSON)        │  │
                        │  └──────────────────────────────────────┘  │
                        │  ┌──────────────────────────────────────┐  │
                        │  │         Rate Limiter                 │  │
                        │  │  (100 req/15min per IP)              │  │
                        │  └──────────────────────────────────────┘  │
                        │                                             │
                        │  Routes → Controllers → Services           │
                        │  ┌────────────────────────────────────┐    │
                        │  │  /api/documents → DocumentService  │    │
                        │  │  /api/search    → SearchService    │    │
                        │  │  /api/analytics → AnalyticsService │    │
                        │  └────────────────────────────────────┘    │
                        └──────────────┬──────────────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
    ┌──────────────────┐   ┌───────────────────────┐  ┌──────────────┐
    │     MongoDB      │   │     Elasticsearch     │  │    Redis     │
    │                  │   │                       │  │              │
    │  - documents     │   │  - full-text search   │  │  - cache     │
    │  - clickevents   │   │  - relevance scoring  │  │  - TTL keys  │
    │  - searchevents  │   │  - autocomplete       │  │  - fast reads│
    └──────────────────┘   └───────────────────────┘  └──────────────┘
```

**The flow in one sentence:** A request comes in → security/logging/rate-limiting middleware runs → a route matches → a controller extracts the data → a service does the real work (talking to MongoDB, Elasticsearch, Redis) → the controller sends the response.

---

## Section 3: How Search Engines Work Internally

This section explains the core concepts behind Elasticsearch. Understanding these will help you reason about why the code is written the way it is.

---

### 3.1 What Is an Inverted Index?

A regular index (like the index at the back of a book) maps from a page number to the words on that page. An **inverted index** flips this around: it maps from a word to the documents that contain it.

**Example with 3 documents:**

```
Document 1: "Node.js is a JavaScript runtime"
Document 2: "JavaScript is used for web development"
Document 3: "Node.js and JavaScript work together"
```

The inverted index looks like this:

```
Word          → Documents containing it
─────────────────────────────────────────
"node.js"     → [Doc 1, Doc 3]
"javascript"  → [Doc 1, Doc 2, Doc 3]
"runtime"     → [Doc 1]
"web"         → [Doc 2]
"development" → [Doc 2]
"work"        → [Doc 3]
"together"    → [Doc 3]
```

Now when a user searches for "javascript", Elasticsearch looks up "javascript" in the inverted index and instantly knows it appears in Documents 1, 2, and 3 — without scanning the full text of every document. This is why search is fast even with millions of documents.

---

### 3.2 How Tokenization Works

Before building the inverted index, Elasticsearch breaks text into **tokens** (individual searchable units). This process is called **tokenization**.

**Example:**
```
Input:  "Node.js is a JavaScript Runtime"
Tokens: ["node.js", "javascript", "runtime"]
```

Notice what happened:
- "is" and "a" were removed — these are **stop words** (common words that don't help with search)
- "Runtime" became "runtime" — **lowercasing** makes search case-insensitive
- "Runtime" might also become "runtim" — **stemming** reduces words to their root form so "running" matches "run"

This project uses two analyzers:
- **`english` analyzer** on the `title` field — applies stemming and stop word removal for English text
- **`standard` analyzer** on the `content` field — tokenizes by whitespace/punctuation without language-specific stemming

---

### 3.3 How Relevance Scoring Works (TF-IDF and BM25)

When a search returns multiple results, Elasticsearch needs to decide which ones are most relevant. It assigns each result a **score** — a number representing how well the document matches the query.

**TF-IDF (Term Frequency — Inverse Document Frequency):**

This is the classic relevance formula. It has two parts:

- **Term Frequency (TF):** How often does the search term appear in this document? A document that mentions "javascript" 10 times is probably more relevant than one that mentions it once.

- **Inverse Document Frequency (IDF):** How rare is the search term across all documents? If "javascript" appears in 90% of all documents, it's not a very useful signal. But if "Deno" appears in only 2% of documents, a match on "Deno" is a stronger signal of relevance.

**BM25 (Best Match 25):**

Elasticsearch uses BM25, which is an improved version of TF-IDF. It adds two improvements:
1. **Term frequency saturation:** After a word appears a certain number of times, additional occurrences don't keep increasing the score linearly. A document with "javascript" 100 times isn't 10× more relevant than one with 10 times.
2. **Field length normalization:** A match in a short title is more significant than a match in a 10,000-word article.

You don't need to implement this — Elasticsearch handles it automatically. But understanding it helps you reason about why some results rank higher than others.

---

### 3.4 How Boosting Works

**Boosting** lets you tell Elasticsearch that a match in one field is more important than a match in another field.

In this project:
```json
"fields": ["title^3", "content^1"]
```

The `^3` means: multiply the relevance score for title matches by 3. The `^1` means: content matches count at their normal weight.

**Why does this make sense?** If a document's title is "Node.js Tutorial", it's almost certainly about Node.js. If a document's title is "Python Tutorial" but the word "Node.js" appears once in the content, it's probably not what the user is looking for. Boosting the title ensures that title matches rank higher.

---

### 3.5 How Elasticsearch Shards and Replicas Work

**Shards** are how Elasticsearch splits a large index across multiple machines (or CPU cores).

Imagine you have 10 million documents. Instead of storing them all in one place, Elasticsearch splits them into 2 shards (as configured in this project):
- Shard 1: documents 1–5,000,000
- Shard 2: documents 5,000,001–10,000,000

When you search, Elasticsearch queries both shards in parallel and merges the results. This means search speed doesn't degrade as your data grows — you just add more shards.

**Replicas** are copies of shards stored on different nodes (machines).

This project uses 1 replica per shard. So:
- Primary Shard 1 → stored on Node A
- Replica of Shard 1 → stored on Node B

If Node A goes down, Node B's replica takes over automatically. This is **high availability** — the system keeps working even when hardware fails.

```
Node A                    Node B
┌─────────────────┐       ┌─────────────────┐
│ Primary Shard 1 │       │ Replica Shard 1 │
│ Primary Shard 2 │       │ Replica Shard 2 │
└─────────────────┘       └─────────────────┘
     ↕ sync                    ↕ sync
```

---

### 3.6 How This System Scales to Millions of Users

The architecture is designed to scale horizontally (add more machines) rather than vertically (buy a bigger machine):

1. **Redis caching** — popular queries are served from memory without touching Elasticsearch. If 10,000 users search for "javascript tutorial" in the same 5-minute window, only the first request hits Elasticsearch. The other 9,999 are served from Redis.

2. **Elasticsearch sharding** — as data grows, add more shards. As query volume grows, add more Elasticsearch nodes. Queries run in parallel across shards.

3. **Stateless Express app** — the Node.js app doesn't store any state in memory. You can run 10 copies of it behind a load balancer and they all work identically.

4. **Fire-and-forget analytics** — analytics writes never block the search response. Even if MongoDB is slow, users still get their search results immediately.

5. **Rate limiting** — prevents any single client from overwhelming the system.

---

## Section 4: Folder Structure Explained

Here is the complete project structure with every file and folder explained:

```
project-root/
├── src/                        ← All application source code lives here
│   ├── app.js                  ← Express app setup (middleware + routes)
│   ├── server.js               ← Entry point: connects DBs, starts HTTP server
│   │
│   ├── config/                 ← External service connections
│   │   ├── db.js               ← MongoDB connection
│   │   ├── elasticsearch.js    ← Elasticsearch client + index bootstrap
│   │   └── redis.js            ← Redis client
│   │
│   ├── controllers/            ← HTTP layer: read req, call service, send res
│   │   ├── documentController.js
│   │   ├── searchController.js
│   │   └── analyticsController.js
│   │
│   ├── routes/                 ← URL-to-controller mapping
│   │   ├── documentRoutes.js
│   │   ├── searchRoutes.js
│   │   └── analyticsRoutes.js
│   │
│   ├── services/               ← Business logic: talks to databases
│   │   ├── documentService.js
│   │   ├── searchService.js
│   │   └── analyticsService.js
│   │
│   ├── models/                 ← Mongoose schemas: define data shapes
│   │   ├── Document.js
│   │   ├── ClickEvent.js
│   │   └── SearchEvent.js
│   │
│   ├── middlewares/            ← Cross-cutting concerns: run on every request
│   │   ├── rateLimiter.js
│   │   ├── validator.js
│   │   ├── logger.js
│   │   └── errorHandler.js
│   │
│   └── utils/                  ← Reusable helpers
│       ├── cacheManager.js     ← Redis read/write/invalidate helpers
│       └── errors.js           ← Custom error classes
│
├── tests/                      ← All test files
│   ├── unit/                   ← Tests for individual functions
│   ├── integration/            ← Tests for full HTTP round-trips
│   └── property/               ← Property-based tests (fast-check)
│
├── .env                        ← Environment variables (NOT committed to git)
├── .env.example                ← Template showing which variables are needed
└── package.json                ← Project metadata, dependencies, npm scripts
```

---

### `src/config/` — External Service Connections

**What it is:** The `config/` folder contains files that establish connections to external services (MongoDB, Elasticsearch, Redis). Each file exports a singleton — a single shared instance that the whole app uses.

**Why it exists:** Centralizing connection logic means you configure each service in one place. If you need to change the MongoDB connection string, you change it in `db.js` — not in every file that uses MongoDB.

**What a beginner should understand:** These files run once at startup. The exported clients (`redisClient`, `esClient`) are shared across the entire application. You never create a new connection for each request — that would be extremely slow.

---

### `src/controllers/` — HTTP Layer

**What it is:** Controllers are the bridge between HTTP and your business logic. They read data from the request (`req.body`, `req.params`, `req.query`), call a service function, and send the response.

**Why it exists:** Separating HTTP concerns from business logic makes both easier to test and maintain. A controller test can mock the service. A service test doesn't need an HTTP server.

**What a beginner should understand:** Controllers should be "thin" — they should contain almost no logic. If you find yourself writing complex code in a controller, it probably belongs in a service.

---

### `src/routes/` — URL Mapping

**What it is:** Route files map URL patterns to controller functions. They also specify which middleware runs before the controller.

**Why it exists:** Keeping routes in separate files makes the URL structure easy to see at a glance. `app.js` mounts each router at a base path, and the router handles the rest.

**What a beginner should understand:** The order routes are registered matters. More specific routes (like `/autocomplete`) must be registered before generic ones (like `/:id`) to avoid the generic route accidentally matching the specific one.

---

### `src/services/` — Business Logic

**What it is:** Services contain the real work of the application — saving to MongoDB, querying Elasticsearch, reading/writing Redis. They know about databases but nothing about HTTP.

**Why it exists:** Business logic that lives in services can be tested without an HTTP server. It can also be reused by multiple controllers or even by background jobs.

**What a beginner should understand:** Services throw custom errors (`NotFoundError`, `InternalError`) instead of calling `res.status()`. The controller catches these errors and passes them to the global error handler via `next(err)`.

---

### `src/models/` — Data Shapes

**What it is:** Mongoose model files define the schema (shape) of data stored in MongoDB. They specify field names, types, required fields, defaults, and length limits.

**Why it exists:** Without a schema, you could accidentally store `{ title: 123, content: null }` in MongoDB. Mongoose enforces the rules before any data is saved.

**What a beginner should understand:** Mongoose automatically creates a collection named after the model (lowercased, pluralized). `mongoose.model('Document', schema)` creates the `documents` collection.

---

### `src/middlewares/` — Cross-Cutting Concerns

**What it is:** Middleware functions run on every request (or every request to specific routes) before the controller. They handle concerns that apply across many endpoints: logging, rate limiting, validation, error handling.

**Why it exists:** Without middleware, you'd have to add logging, validation, and rate limiting code to every single controller function. Middleware lets you write it once and apply it everywhere.

**What a beginner should understand:** Middleware runs in the order it's registered in `app.js`. The error handler MUST be last — it only catches errors that have been passed via `next(err)` from earlier middleware or controllers.

---

### `src/utils/` — Reusable Helpers

**What it is:** Utility files contain reusable code that doesn't fit neatly into models, services, or middleware. `cacheManager.js` provides Redis helpers. `errors.js` defines custom error classes.

**Why it exists:** Keeping utility code in `utils/` prevents duplication. Multiple services can import `cacheManager.js` without each implementing their own Redis logic.

---

### `src/app.js` — Express Application Setup

**What it is:** This file creates the Express application, registers all middleware, and mounts all route files. It does NOT start the HTTP server.

**Why it exists:** Separating app setup from server startup means tests can import `app` without accidentally starting a real server or connecting to real databases.

---

### `src/server.js` — Entry Point

**What it is:** This is the file you run to start the application. It connects to MongoDB, bootstraps the Elasticsearch index, and then starts the HTTP listener.

**Why it exists:** The startup sequence matters — you must connect to databases before accepting requests. Keeping this in `server.js` keeps `app.js` clean and testable.

---

### `.env` — Environment Variables

**What it is:** A file containing secret configuration values like database passwords and connection strings. It is NOT committed to git (it's in `.gitignore`).

**Why it exists:** Hard-coding secrets in source code is a security risk. Environment variables let you use different values in development, staging, and production without changing the code.

**What a beginner should understand:** Never commit `.env` to git. Use `.env.example` (which has the same keys but empty values) as a template that IS committed.

---

### `package.json` — Project Metadata

**What it is:** The manifest file for the Node.js project. It lists all dependencies, defines npm scripts, and contains project metadata.

**Why it exists:** `npm install` reads `package.json` to know which libraries to install. The `scripts` section defines shortcuts like `npm run dev` and `npm test`.

---

## Section 5: Data Flow Walkthroughs

These walkthroughs trace exactly what happens when a request comes in. Follow each step carefully — this is where everything comes together.

---

### 5.1 Creating a Document (POST /api/documents)

**The request:**
```
POST /api/documents
Content-Type: application/json

{
  "title": "Node.js Tutorial",
  "content": "Node.js is a JavaScript runtime built on Chrome's V8 engine.",
  "category": "programming"
}
```

**Step-by-step:**

1. **HTTP request arrives** at the Express server on port 3000.

2. **`helmet()` middleware** runs first — adds security headers to the response (X-Frame-Options, Content-Security-Policy, etc.). This happens before any application code.

3. **`cors()` middleware** runs — adds CORS headers so browsers on other domains can call this API.

4. **`express.json()` middleware** runs — parses the raw JSON body string into a JavaScript object and puts it on `req.body`. Without this, `req.body` would be `undefined`.

5. **`requestLogger` middleware** runs — records the start time and attaches a `finish` listener to the response. The actual log entry is written after the response is sent.

6. **`globalLimiter` middleware** runs — checks how many requests this IP has made in the last 15 minutes. If under 100, increments the counter and continues. If over 100, returns HTTP 429 immediately.

7. **Route matching** — Express sees `POST /api/documents` and routes it to `documentRoutes.js`.

8. **`strictLimiter` middleware** runs (specific to POST /) — checks the stricter 30 req/15min limit for document creation.

9. **`validateCreateDocument` middleware** runs:
   - Checks that `title` is present and between 1–500 characters
   - Checks that `content` is present and between 1–100,000 characters
   - Strips HTML tags from both fields (e.g., `<b>Hello</b>` becomes `Hello`)
   - Removes any unknown fields (e.g., `isAdmin: true` is silently dropped)
   - If validation fails → calls `next(new ValidationError(...))` → jumps to step 14
   - If validation passes → replaces `req.body` with the clean values and calls `next()`

10. **`createDocument` controller** runs:
    - Extracts `req.body` (already validated and sanitized)
    - Calls `documentService.create(req.body)`
    - Wraps everything in try/catch

11. **`documentService.create()` runs:**
    - Calls `Document.create(data)` → MongoDB saves the document and returns it with an auto-generated `_id` and `createdAt` timestamp
    - Calls `esClient.index(...)` → Elasticsearch indexes the document using the same `_id`
    - **If Elasticsearch fails:** calls `Document.findByIdAndDelete(doc._id)` to roll back the MongoDB write, then throws `InternalError`
    - Stores `esId = doc._id.toString()` on the document and saves it
    - Calls `invalidatePattern('search:*')` → Redis SCAN finds all `search:*` keys and deletes them (cached search results are now stale)
    - Returns the saved document

12. **Back in the controller:** `res.status(201).json({ success: true, data: doc })` sends the response.

13. **`requestLogger`'s `finish` listener** fires — calculates response time, writes the JSON log entry to stdout.

14. **If any step threw an error:** `next(err)` was called → Express skips to `errorHandler` → maps the error type to an HTTP status code → sends `{ success: false, error: { code, message } }`.

**The response:**
```json
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
    "title": "Node.js Tutorial",
    "content": "Node.js is a JavaScript runtime built on Chrome's V8 engine.",
    "category": "programming",
    "esId": "64a1b2c3d4e5f6a7b8c9d0e1",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

### 5.2 Searching (GET /api/search?q=nodejs)

**The request:**
```
GET /api/search?q=nodejs&page=1&limit=10
```

**Step-by-step:**

1. **HTTP request arrives** at the Express server.

2. **`helmet`, `cors`, `express.json`** middleware run (same as above).

3. **`requestLogger`** records start time.

4. **`globalLimiter`** checks the rate limit.

5. **Route matching** — Express routes to `searchRoutes.js`.

6. **`validateSearch` middleware** runs:
   - Checks that `q` is present
   - Coerces `page` from string `"1"` to number `1`
   - Coerces `limit` from string `"10"` to number `10`
   - Validates `date_from`/`date_to` as ISO 8601 if provided
   - Replaces `req.query` with the validated, coerced values

7. **`search` controller** runs:
   - Extracts all query params from `req.query`
   - Calls `searchService.search({ q, page, limit, ... })`

8. **`searchService.search()` runs:**

   **Step 8a — Build cache key:**
   ```
   buildSearchKey({ q: 'nodejs', page: 1, limit: 10, sort: '_score' })
   → 'search:limit=10&page=1&q=nodejs&sort=_score'
   ```
   Keys are sorted alphabetically so the same query always produces the same key.

   **Step 8b — Check Redis:**
   ```
   redisClient.get('search:limit=10&page=1&q=nodejs&sort=_score')
   ```
   - **CACHE HIT:** Redis returns the cached JSON string → parse it → return `{ ...result, cacheHit: true }` → skip to step 9
   - **CACHE MISS:** Redis returns `null` → continue to step 8c

   **Step 8c — Build Elasticsearch query:**
   ```json
   {
     "from": 0,
     "size": 10,
     "_source": ["title", "content", "category", "createdAt"],
     "query": {
       "bool": {
         "must": {
           "multi_match": {
             "query": "nodejs",
             "fields": ["title^3", "content^1"],
             "type": "best_fields",
             "fuzziness": "AUTO"
           }
         },
         "filter": []
       }
     }
   }
   ```

   **Step 8d — Execute Elasticsearch query:**
   Elasticsearch searches its inverted index, scores each matching document using BM25, and returns the top 10 results sorted by score.

   **Step 8e — Map results:**
   Each raw Elasticsearch hit `{ _id, _score, _source: { title, content, ... } }` is flattened into `{ _id, title, content, category, createdAt, _score }`.

   **Step 8f — Fire-and-forget analytics:**
   ```javascript
   setImmediate(() => {
     analyticsService.recordSearch('nodejs', {}, 42, 'anonymous').catch(console.error);
   });
   ```
   This schedules the analytics write to happen after the current event loop tick. The user gets their results immediately — the analytics write happens in the background.

   **Step 8g — Cache the result:**
   ```
   redisClient.set('search:limit=10&page=1&q=nodejs&sort=_score', JSON.stringify(result), 'EX', 300)
   ```
   The result is stored in Redis for 300 seconds (5 minutes).

   **Step 8h — Return result with `cacheHit: false`.**

9. **Back in the controller:**
   - Sets `X-Cache: MISS` header (because `result.cacheHit` is false)
   - Sends `res.status(200).json({ success: true, page, limit, total, data })`

**The response:**
```json
HTTP/1.1 200 OK
X-Cache: MISS
Content-Type: application/json

{
  "success": true,
  "page": 1,
  "limit": 10,
  "total": 3,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
      "title": "Node.js Tutorial",
      "content": "Node.js is a JavaScript runtime...",
      "category": "programming",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "_score": 4.23
    }
  ]
}
```

---

### 5.3 Autocomplete (GET /api/search/autocomplete?q=nod)

**The request:**
```
GET /api/search/autocomplete?q=nod
```

**Step-by-step:**

1. **Standard middleware** runs (helmet, cors, json parser, logger, rate limiter).

2. **Route matching** — Express routes to `searchRoutes.js`. The `/autocomplete` route is registered BEFORE the `/` route, so it matches correctly.

3. **`validateAutocomplete` middleware** — checks that `q` is present.

4. **`autocomplete` controller** — extracts `q`, calls `searchService.autocomplete('nod')`.

5. **`searchService.autocomplete()` runs:**
   Sends this query to Elasticsearch:
   ```json
   {
     "suggest": {
       "title-suggest": {
         "prefix": "nod",
         "completion": {
           "field": "title.suggest",
           "size": 10
         }
       }
     }
   }
   ```
   Elasticsearch's completion suggester uses a Finite State Transducer (FST) stored in memory to find all indexed titles that start with "nod" in sub-millisecond time.

6. **Results are mapped** to `[{ text: "Node.js Tutorial", score: 1.0 }, ...]`.

7. **Controller sends response:**
   ```json
   {
     "success": true,
     "data": [
       { "text": "Node.js Tutorial", "score": 1.0 },
       { "text": "Node.js Best Practices", "score": 1.0 }
     ]
   }
   ```

---

### 5.4 Cache HIT vs MISS

**First request (MISS):**

```
User → GET /api/search?q=javascript
         │
         ▼
    CacheManager.get('search:q=javascript&...')
         │
         ▼ Redis returns null (key doesn't exist)
         │
         ▼
    Elasticsearch.search(query)  ← ~10-50ms
         │
         ▼
    CacheManager.set('search:q=javascript&...', result, 300)
         │
         ▼
    Response: X-Cache: MISS  ← result came from Elasticsearch
```

**Second identical request (HIT):**

```
User → GET /api/search?q=javascript
         │
         ▼
    CacheManager.get('search:q=javascript&...')
         │
         ▼ Redis returns the cached JSON string  ← ~1ms
         │
         ▼
    (Elasticsearch is NOT called)
         │
         ▼
    Response: X-Cache: HIT  ← result came from Redis
```

**Why this matters for performance:**

Elasticsearch is fast, but it's not free. Every query uses CPU and memory. For a popular search term like "javascript tutorial", thousands of users might search for it within the same 5-minute window. Without caching, each of those requests hits Elasticsearch. With caching, only the first request hits Elasticsearch — the other 999 are served from Redis in under 1ms.

This is the difference between a system that handles 100 requests/second and one that handles 10,000 requests/second.

---

## Section 6: Every File Explained

This section walks through every source file in `src/`, explaining its purpose, key functions, and what a beginner might miss.

---

### `src/server.js`

**Purpose:** The application entry point — connects to all external services and starts the HTTP server.

**Key functions:**
- `startServer()` — async function that runs the startup sequence: connect MongoDB → bootstrap Elasticsearch index → start HTTP listener
- Uses `process.exit(1)` if any startup step fails — signals to process managers (Docker, PM2) that the app crashed and should be restarted

**Beginner tip:** Notice that `require('dotenv').config()` is called at the very top, before any other `require()`. This is critical — if you call it after importing `db.js`, the `MONGODB_URI` environment variable won't be loaded yet when `db.js` reads it.

---

### `src/app.js`

**Purpose:** Creates and configures the Express application — registers middleware and mounts route files. Does NOT start the server.

**Key exports:** `app` — the configured Express application instance

**Middleware order (top to bottom):**
1. `helmet()` — security headers
2. `cors()` — cross-origin resource sharing
3. `express.json()` — JSON body parsing
4. `requestLogger` — structured request logging
5. `globalLimiter` — rate limiting (100 req/15min)
6. Route mounts (`/api/documents`, `/api/search`, `/api/analytics`)
7. 404 catch-all handler
8. `errorHandler` — global error handler (MUST be last)

**Beginner tip:** The error handler must have exactly 4 parameters `(err, req, res, next)`. Express identifies error-handling middleware by this signature. If you accidentally write 3 parameters, Express won't treat it as an error handler and errors will go unhandled.

---

### `src/config/db.js`

**Purpose:** Establishes and manages the MongoDB connection using Mongoose.

**Key exports:**
- `connectMongoDB()` — async function that opens the Mongoose connection; called once in `server.js`

**Key behavior:**
- Calls `process.exit(1)` if the initial connection fails (no point running without a database)
- Listens for `disconnected`, `reconnected`, and `error` events to log runtime connection issues
- Mongoose handles automatic reconnection internally

**Beginner tip:** You only call `connectMongoDB()` once at startup. After that, Mongoose manages the connection pool automatically. You never need to manually reconnect or close the connection in normal operation.

---

### `src/config/elasticsearch.js`

**Purpose:** Creates the Elasticsearch client and bootstraps the `documents` index with the correct mapping.

**Key exports:**
- `esClient` — singleton Elasticsearch client instance (shared across all services)
- `bootstrapElasticsearchIndex()` — creates the index if it doesn't exist; idempotent (safe to call multiple times)

**The index mapping defines:**
- `title` — `text` type, `english` analyzer, `boost: 3`, with sub-fields `title.suggest` (completion) and `title.keyword` (keyword)
- `content` — `text` type, `standard` analyzer
- `category` — `keyword` type (exact match, no tokenization)
- `createdAt` — `date` type

**Beginner tip:** The `boost: 3` on `title` is set at index time in the mapping. This is different from query-time boosting (`title^3` in the search query). Both are used in this project — the mapping boost affects how the field is indexed, while the query boost affects how scores are calculated at search time.

---

### `src/config/redis.js`

**Purpose:** Creates the Redis client using ioredis.

**Key exports:**
- `redisClient` — singleton ioredis instance

**Key behavior:**
- Uses `maxRetriesPerRequest: null` — ioredis retries indefinitely if Redis is temporarily unavailable
- Logs connection errors but does NOT call `process.exit()` — the app degrades gracefully without the cache (slower, but still functional)

**Beginner tip:** Unlike MongoDB, Redis being unavailable is not fatal. The app can still work — it just won't cache results. This is called "graceful degradation." The `cacheManager.js` functions catch Redis errors and return `null` (cache miss) instead of crashing.

---

### `src/models/Document.js`

**Purpose:** Defines the Mongoose schema for documents stored in MongoDB.

**Fields:**
- `title` — String, required, max 500 chars
- `content` — String, required, max 100,000 chars
- `category` — String, defaults to `'general'`
- `esId` — String, stores the Elasticsearch document ID (same as MongoDB `_id`)
- `createdAt` — Date, defaults to `Date.now`

**Key export:** `Document` — the Mongoose model class

**Beginner tip:** `default: Date.now` (without parentheses) passes the function reference to Mongoose. Mongoose calls `Date.now()` at insert time. If you wrote `default: Date.now()` (with parentheses), it would call `Date.now()` when the schema is defined — and every document would get the same timestamp (the time the server started).

---

### `src/models/ClickEvent.js`

**Purpose:** Defines the Mongoose schema for click tracking events.

**Fields:**
- `queryId` — String, required (which search query led to this click)
- `documentId` — String, required (which document was clicked)
- `userId` — String, defaults to `'anonymous'`
- `clickedAt` — Date, defaults to `Date.now`

**Beginner tip:** `userId` defaults to `'anonymous'` instead of `null`. This is intentional — it means you can always query by `userId` without worrying about null checks. Anonymous users are still tracked, just without a personal identifier.

---

### `src/models/SearchEvent.js`

**Purpose:** Defines the Mongoose schema for search event logging.

**Fields:**
- `query` — String, required (the search term)
- `filters` — Object, defaults to `{}` (category, date range, sort applied)
- `resultCount` — Number, defaults to `0`
- `userId` — String, defaults to `'anonymous'`
- `searchedAt` — Date, defaults to `Date.now`

**Beginner tip:** `filters` is typed as `Object` — a flexible key-value store. This is intentional: different searches have different filters, and MongoDB's flexible document model handles this well. In a SQL database, you'd need a separate table for each filter type.

---

### `src/middlewares/rateLimiter.js`

**Purpose:** Exports two rate limiter middleware instances using `express-rate-limit`.

**Key exports:**
- `globalLimiter` — 100 requests per 15 minutes per IP (applied to all routes)
- `strictLimiter` — 30 requests per 15 minutes per IP (applied only to POST /api/documents)

**Key behavior:**
- Returns HTTP 429 with a `Retry-After` header when the limit is exceeded
- Uses `standardHeaders: true` to include `RateLimit-*` headers in responses

**Beginner tip:** Rate limiting is stored in memory by default. This means if you run multiple instances of the app (for scaling), each instance has its own counter. For production with multiple instances, you'd configure `express-rate-limit` to use a shared Redis store so all instances share the same counters.

---

### `src/middlewares/validator.js`

**Purpose:** Exports four Joi-based validation middleware functions.

**Key exports:**
- `validateCreateDocument` — validates POST /api/documents body; strips HTML; strips unknown fields
- `validateSearch` — validates GET /api/search query params; coerces types; validates ISO 8601 dates
- `validateAutocomplete` — validates GET /api/search/autocomplete; requires `q`
- `validateTrackClick` — validates POST /api/analytics/click body; requires `queryId` and `documentId`

**Key behavior:**
- Uses `stripUnknown: true` to silently remove fields not in the schema
- Uses `abortEarly: false` to collect ALL validation errors at once (not just the first)
- Calls `next(new ValidationError(...))` on failure — the error handler sends HTTP 400

**Beginner tip:** HTML stripping happens AFTER Joi validation. This is intentional — Joi's length checks run on the original string (before stripping). If you stripped HTML first, a title like `<b>Hi</b>` (9 chars) would become `Hi` (2 chars), and the length check would pass even if the original was too long.

---

### `src/middlewares/logger.js`

**Purpose:** Exports a Winston-based request logging middleware.

**Key exports:**
- `requestLogger` — Express middleware that logs every request as JSON
- `logger` — the raw Winston logger instance (for use in other files)

**Log entry shape:**
```json
{ "method": "GET", "url": "/api/search?q=nodejs", "statusCode": 200, "responseTime": 42, "ip": "127.0.0.1" }
```

**For HTTP 500 errors, also includes:**
```json
{ ..., "stack": "Error: Elasticsearch indexing failed\n    at create (/src/services/documentService.js:45:11)\n..." }
```

**Beginner tip:** The log entry is written in the `res.on('finish')` callback — AFTER the response is sent. This is the only way to know the final `statusCode` and `responseTime`. If you tried to log before calling `next()`, you wouldn't know the status code yet.

---

### `src/middlewares/errorHandler.js`

**Purpose:** The global Express error handler — catches all errors passed via `next(err)` and sends a consistent JSON response.

**Key exports:**
- `errorHandler` — Express error middleware with signature `(err, req, res, next)`

**Error mapping:**
- `NotFoundError` → HTTP 404, code `NOT_FOUND`
- `ValidationError` → HTTP 400, code `VALIDATION_ERROR` (with optional `details` array)
- `InternalError` → HTTP 500, code `INTERNAL_SERVER_ERROR`
- Unknown errors → HTTP 500, code `INTERNAL_SERVER_ERROR` (generic message, no details)

**Beginner tip:** Stack traces are NEVER included in the HTTP response body. They're stored on `res.locals.error` so the logger middleware can include them in the server logs. This is a security best practice — stack traces reveal your internal file structure and library versions to potential attackers.

---

### `src/utils/errors.js`

**Purpose:** Defines three custom error classes that extend JavaScript's built-in `Error`.

**Key exports:**
- `NotFoundError` — HTTP 404, code `NOT_FOUND`
- `ValidationError` — HTTP 400, code `VALIDATION_ERROR`, optional `details` array
- `InternalError` — HTTP 500, code `INTERNAL_SERVER_ERROR`

**Beginner tip:** Each class sets `this.statusCode` and `this.code` in the constructor. The error handler reads these properties to build the HTTP response. This is the "typed error" pattern — instead of checking `if (err.message === 'not found')`, you check `if (err instanceof NotFoundError)`, which is more reliable.

---

### `src/utils/cacheManager.js`

**Purpose:** Provides Redis read, write, and invalidation helpers with a consistent key format.

**Key exports:**
- `get(key)` — fetch from Redis, parse JSON, return `null` on miss or error
- `set(key, value, ttl=300)` — JSON-stringify and store with TTL
- `invalidatePattern(pattern)` — SCAN Redis for matching keys, DEL all matches
- `buildSearchKey(params)` — sort params alphabetically, URL-encode, prefix with `search:`

**Key behavior:**
- All functions catch Redis errors and handle them gracefully (log + return null/void)
- `invalidatePattern` uses SCAN (non-blocking) instead of KEYS (blocking) for production safety
- `buildSearchKey` sorts keys alphabetically so `{ q: 'a', page: 1 }` and `{ page: 1, q: 'a' }` produce the same key

**Beginner tip:** Why use SCAN instead of KEYS? The `KEYS` command in Redis blocks the entire server while it scans — on a large dataset, this can freeze Redis for seconds, causing all other clients to time out. `SCAN` is cursor-based and non-blocking: it returns a small batch of keys per call, keeping Redis responsive throughout.

---

### `src/services/documentService.js`

**Purpose:** Business logic for Document CRUD — saves to MongoDB, indexes in Elasticsearch, invalidates cache.

**Key exports:**
- `create(data)` — save to MongoDB → index in Elasticsearch → rollback on ES failure → invalidate cache
- `list(page, limit)` — paginated MongoDB query
- `getById(id)` — find by `_id`, throw `NotFoundError` if missing
- `delete(id)` — delete from MongoDB → delete from Elasticsearch → invalidate cache

**Beginner tip:** The `delete` function is exported as `delete: deleteDoc` because `delete` is a reserved keyword in JavaScript. You can't use it as a variable name (`const delete = ...` is a syntax error), but you CAN use it as an object property key (`module.exports = { delete: deleteDoc }`).

---

### `src/services/searchService.js`

**Purpose:** Business logic for full-text search and autocomplete — builds Elasticsearch queries, manages caching, fires analytics.

**Key exports:**
- `search(params)` — cache check → build ES query → execute → fire analytics → cache result → return
- `autocomplete(prefix)` — query ES completion suggester → return `[{ text, score }]`

**Beginner tip:** `analyticsService` is imported with `require()` INSIDE the `search()` function body, not at the top of the file. This avoids a circular dependency: if `searchService` imported `analyticsService` at the top, and `analyticsService` imported `searchService`, Node.js would get confused and one module would receive an incomplete object. The lazy import (inside the function) works because both modules are fully loaded by the time the function runs.

---

### `src/services/analyticsService.js`

**Purpose:** Business logic for recording and querying analytics data.

**Key exports:**
- `recordClick(queryId, documentId, userId)` — save ClickEvent to MongoDB (awaited)
- `recordSearch(query, filters, resultCount, userId)` — save SearchEvent to MongoDB (fire-and-forget)
- `getPopular()` — MongoDB aggregation: group by query, count, sort desc, limit 10
- `getHistory(userId)` — find SearchEvents by userId, sort by searchedAt desc, limit 20

**Beginner tip:** `recordSearch` is called with `setImmediate()` in `searchService.js` — it's never awaited. This means if `recordSearch` throws an error, it won't crash the search request. The `.catch(console.error)` at the call site ensures errors are logged but silently swallowed. This is the fire-and-forget pattern.

---

### `src/controllers/documentController.js`

**Purpose:** HTTP layer for document operations — extracts request data, calls service, sends response.

**Key exports:** `createDocument`, `listDocuments`, `getDocument`, `deleteDocument`

**Beginner tip:** Every function wraps its logic in `try/catch` and calls `next(err)` on failure. Controllers NEVER call `res.status(500)` directly — they always delegate error responses to the global error handler. This ensures consistent error formatting across all endpoints.

---

### `src/controllers/searchController.js`

**Purpose:** HTTP layer for search and autocomplete — sets the `X-Cache` header based on cache hit/miss.

**Key exports:** `search`, `autocomplete`

**Beginner tip:** The `X-Cache` header is set based on `result.cacheHit` — a boolean returned by the service. The controller doesn't know HOW caching works (that's the service's job) — it just reads the flag and sets the header. This is the separation of concerns in action.

---

### `src/controllers/analyticsController.js`

**Purpose:** HTTP layer for analytics — records clicks, returns popular queries, returns search history.

**Key exports:** `trackClick`, `getPopularQueries`, `getSearchHistory`

**Beginner tip:** `getSearchHistory` validates `userId` directly in the controller (not in a middleware). This is acceptable for a simple required-field check. The rule of thumb: use middleware for complex validation (Joi schemas), use inline checks for simple required-field validation.

---

### `src/routes/documentRoutes.js`, `searchRoutes.js`, `analyticsRoutes.js`

**Purpose:** Map URL patterns to controller functions and specify which middleware runs before each controller.

**Beginner tip:** In `searchRoutes.js`, the `/autocomplete` route is registered BEFORE the `/` route. This is critical. If you had a param route like `/:something`, it would match `/autocomplete` before the specific route. Always register specific routes before generic ones.

---

## Section 7: API Reference

Complete documentation for every endpoint, with request/response examples and curl commands.

---

### Base URL

```
http://localhost:3000
```

### Common Headers

All requests that send a body should include:
```
Content-Type: application/json
```

### Standard Response Shapes

**Success:**
```json
{ "success": true, "data": { ... } }
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

### Documents API

#### POST /api/documents — Create a Document

Creates a new document, saves it to MongoDB, and indexes it in Elasticsearch.

**Rate limit:** 30 requests per 15 minutes per IP

**Request body:**
```json
{
  "title": "Node.js Tutorial",
  "content": "Node.js is a JavaScript runtime built on Chrome's V8 engine.",
  "category": "programming"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | yes | 1–500 characters; HTML stripped |
| `content` | string | yes | 1–100,000 characters; HTML stripped |
| `category` | string | no | Defaults to `"general"` |

**Success response (HTTP 201):**
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
    "title": "Node.js Tutorial",
    "content": "Node.js is a JavaScript runtime built on Chrome's V8 engine.",
    "category": "programming",
    "esId": "64a1b2c3d4e5f6a7b8c9d0e1",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Error responses:**
- HTTP 400 — missing or invalid fields
- HTTP 429 — rate limit exceeded
- HTTP 500 — Elasticsearch indexing failed

**curl:**
```bash
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{"title": "Node.js Tutorial", "content": "Node.js is a JavaScript runtime.", "category": "programming"}'
```

---

#### GET /api/documents — List Documents

Returns a paginated list of all documents from MongoDB.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `limit` | integer | 10 | Results per page |

**Success response (HTTP 200):**
```json
{
  "success": true,
  "page": 1,
  "limit": 10,
  "total": 42,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
      "title": "Node.js Tutorial",
      "content": "...",
      "category": "programming",
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

**curl:**
```bash
curl "http://localhost:3000/api/documents?page=1&limit=10"
```

---

#### GET /api/documents/:id — Get a Single Document

Returns one document by its MongoDB `_id`.

**URL parameter:** `:id` — the MongoDB document ID

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
    "title": "Node.js Tutorial",
    "content": "Node.js is a JavaScript runtime...",
    "category": "programming",
    "esId": "64a1b2c3d4e5f6a7b8c9d0e1",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Error responses:**
- HTTP 404 — document not found

**curl:**
```bash
curl http://localhost:3000/api/documents/64a1b2c3d4e5f6a7b8c9d0e1
```

---

#### DELETE /api/documents/:id — Delete a Document

Deletes a document from MongoDB and Elasticsearch, then invalidates the search cache.

**URL parameter:** `:id` — the MongoDB document ID

**Success response (HTTP 200):**
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

**Error responses:**
- HTTP 404 — document not found
- HTTP 500 — Elasticsearch deletion failed

**curl:**
```bash
curl -X DELETE http://localhost:3000/api/documents/64a1b2c3d4e5f6a7b8c9d0e1
```

---

### Search API

#### GET /api/search — Full-Text Search

Searches documents using Elasticsearch with optional filters, pagination, highlighting, and sorting.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string | required | Search keyword |
| `page` | integer | 1 | Page number |
| `limit` | integer | 10 | Results per page (max 100) |
| `highlight` | boolean | false | Include highlighted snippets |
| `sort` | string | `_score` | `_score`, `date_asc`, or `date_desc` |
| `category` | string | — | Filter by exact category |
| `date_from` | ISO 8601 | — | Filter results after this date |
| `date_to` | ISO 8601 | — | Filter results before this date |

**Response headers:**
- `X-Cache: HIT` — result served from Redis cache
- `X-Cache: MISS` — result fetched from Elasticsearch

**Success response (HTTP 200):**
```json
{
  "success": true,
  "page": 1,
  "limit": 10,
  "total": 3,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
      "title": "Node.js Tutorial",
      "content": "Node.js is a JavaScript runtime...",
      "category": "programming",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "_score": 4.23
    }
  ]
}
```

**With highlight=true:**
```json
{
  "data": [
    {
      "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
      "title": "Node.js Tutorial",
      "_score": 4.23,
      "highlights": {
        "title": ["<em>Node.js</em> Tutorial"],
        "content": ["...learn <em>Node.js</em> from scratch..."]
      }
    }
  ]
}
```

**Error responses:**
- HTTP 400 — `q` is missing, or `date_from`/`date_to` is not valid ISO 8601

**curl examples:**
```bash
# Basic search
curl "http://localhost:3000/api/search?q=nodejs"

# With pagination
curl "http://localhost:3000/api/search?q=nodejs&page=2&limit=5"

# With highlighting
curl "http://localhost:3000/api/search?q=nodejs&highlight=true"

# With category filter
curl "http://localhost:3000/api/search?q=tutorial&category=programming"

# With date range
curl "http://localhost:3000/api/search?q=nodejs&date_from=2024-01-01T00:00:00Z&date_to=2024-12-31T23:59:59Z"

# Sort by date (newest first)
curl "http://localhost:3000/api/search?q=nodejs&sort=date_desc"
```

---

#### GET /api/search/autocomplete — Autocomplete Suggestions

Returns up to 10 title suggestions for a given prefix using Elasticsearch's completion suggester.

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `q` | string | yes | The prefix to autocomplete |

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": [
    { "text": "Node.js Tutorial", "score": 1.0 },
    { "text": "Node.js Best Practices", "score": 1.0 },
    { "text": "Node.js vs Deno", "score": 1.0 }
  ]
}
```

**Error responses:**
- HTTP 400 — `q` is missing

**curl:**
```bash
curl "http://localhost:3000/api/search/autocomplete?q=nod"
```

---

### Analytics API

#### POST /api/analytics/click — Record a Click Event

Records that a user clicked on a specific search result.

**Request body:**
```json
{
  "queryId": "search-session-abc123",
  "documentId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "userId": "user-xyz789"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `queryId` | string | yes | ID of the search session |
| `documentId` | string | yes | ID of the clicked document |
| `userId` | string | no | Defaults to `"anonymous"` |

**Success response (HTTP 201):**
```json
{
  "success": true,
  "data": {
    "_id": "64b2c3d4e5f6a7b8c9d0e1f2",
    "queryId": "search-session-abc123",
    "documentId": "64a1b2c3d4e5f6a7b8c9d0e1",
    "userId": "user-xyz789",
    "clickedAt": "2024-01-15T10:05:00.000Z"
  }
}
```

**Error responses:**
- HTTP 400 — `queryId` or `documentId` is missing

**curl:**
```bash
curl -X POST http://localhost:3000/api/analytics/click \
  -H "Content-Type: application/json" \
  -d '{"queryId": "search-session-abc123", "documentId": "64a1b2c3d4e5f6a7b8c9d0e1", "userId": "user-xyz789"}'
```

---

#### GET /api/analytics/popular — Top 10 Popular Queries

Returns the 10 most-searched query strings, ordered by frequency.

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": [
    { "query": "javascript tutorial", "count": 142 },
    { "query": "node.js express",     "count": 98  },
    { "query": "mongodb aggregation", "count": 67  }
  ]
}
```

**curl:**
```bash
curl http://localhost:3000/api/analytics/popular
```

---

#### GET /api/analytics/history — Search History for a User

Returns the 20 most recent search events for a specific user, ordered by most recent first.

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `userId` | string | yes | The user whose history to retrieve |

**Success response (HTTP 200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64c3d4e5f6a7b8c9d0e1f2a3",
      "query": "node.js tutorial",
      "filters": { "category": "programming" },
      "resultCount": 5,
      "userId": "user-xyz789",
      "searchedAt": "2024-01-15T10:04:00.000Z"
    }
  ]
}
```

**Error responses:**
- HTTP 400 — `userId` query parameter is missing

**curl:**
```bash
curl "http://localhost:3000/api/analytics/history?userId=user-xyz789"
```

---

## Section 8: How to Run the Project

Follow these steps in order. Don't skip any — each step depends on the previous one.

---

### Step 1: Install Node.js

Node.js is the runtime that executes this project.

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS (Long Term Support)** version — it's the most stable
3. Run the installer
4. Verify the installation:
   ```bash
   node --version   # should print v18.x.x or higher
   npm --version    # should print 9.x.x or higher
   ```

---

### Step 2: Install MongoDB

MongoDB is the primary database for storing documents and analytics events.

**Option A — Install locally:**
1. Go to [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Download MongoDB Community Server for your OS
3. Follow the installation guide for your platform
4. Start MongoDB: `mongod --dbpath /data/db`

**Option B — Use Docker (recommended for beginners):**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:7
```

**Option C — Use MongoDB Atlas (cloud, no installation):**
See Section 10 for Atlas setup.

---

### Step 3: Install Elasticsearch

Elasticsearch is the search engine.

**Option A — Use Docker (strongly recommended):**
```bash
docker run -d \
  --name elasticsearch \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  elasticsearch:8.11.0
```

Wait about 30 seconds for Elasticsearch to start, then verify:
```bash
curl http://localhost:9200
# Should return a JSON response with cluster info
```

**Option B — Install locally:**
1. Go to [https://www.elastic.co/downloads/elasticsearch](https://www.elastic.co/downloads/elasticsearch)
2. Download Elasticsearch 8.x for your OS
3. Extract and run: `./bin/elasticsearch`

---

### Step 4: Install Redis

Redis is the cache layer.

**Option A — Use Docker (recommended):**
```bash
docker run -d -p 6379:6379 --name redis redis:7
```

**Option B — Install locally:**
- **macOS:** `brew install redis && brew services start redis`
- **Ubuntu/Debian:** `sudo apt install redis-server && sudo systemctl start redis`
- **Windows:** Download from [https://redis.io/docs/getting-started/installation/install-redis-on-windows/](https://redis.io/docs/getting-started/installation/install-redis-on-windows/)

Verify Redis is running:
```bash
redis-cli ping
# Should print: PONG
```

---

### Step 5: Clone or Download the Project

If you have git:
```bash
git clone <repository-url>
cd <project-folder>
```

Or download the ZIP file and extract it.

---

### Step 6: Install Dependencies

```bash
npm install
```

This reads `package.json` and installs all listed dependencies into the `node_modules/` folder. This may take a minute.

---

### Step 7: Configure Environment Variables

```bash
cp .env.example .env
```

Now open `.env` in a text editor and fill in the values:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/searchengine
ELASTICSEARCH_URL=http://localhost:9200
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

**What each variable does:**
- `PORT` — the port the HTTP server listens on
- `MONGODB_URI` — the MongoDB connection string (includes database name)
- `ELASTICSEARCH_URL` — the Elasticsearch server URL
- `REDIS_URL` — the Redis server URL
- `NODE_ENV` — `development` or `production` (affects logging behavior)

---

### Step 8: Start the Development Server

```bash
npm run dev
```

This uses `nodemon` to start the server and automatically restart it whenever you change a file. You should see:

```
MongoDB connected
Elasticsearch index 'documents' ready
Redis connected
Server running on port 3000
Environment: development
```

If you see errors, check that MongoDB, Elasticsearch, and Redis are all running.

---

### Step 9: Test with curl Commands

Try these commands to verify everything is working:

```bash
# 1. Create a document
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{"title": "Node.js Tutorial", "content": "Node.js is a JavaScript runtime built on Chrome V8.", "category": "programming"}'

# 2. Create another document
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{"title": "JavaScript Promises", "content": "Promises are used for asynchronous programming in JavaScript.", "category": "programming"}'

# 3. Search (first request — should be X-Cache: MISS)
curl -v "http://localhost:3000/api/search?q=javascript" 2>&1 | grep -E "X-Cache|success"

# 4. Search again (second request — should be X-Cache: HIT)
curl -v "http://localhost:3000/api/search?q=javascript" 2>&1 | grep -E "X-Cache|success"

# 5. Autocomplete
curl "http://localhost:3000/api/search/autocomplete?q=nod"

# 6. List all documents
curl "http://localhost:3000/api/documents"

# 7. Get popular queries
curl "http://localhost:3000/api/analytics/popular"
```

---

### Docker Compose — Run Everything Locally

Save this as `docker-compose.yml` in the project root to start MongoDB, Elasticsearch, and Redis with a single command:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  elasticsearch:
    image: elasticsearch:8.11.0
    ports:
      - "9200:9200"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  mongodb_data:
  elasticsearch_data:
  redis_data:
```

Start all services:
```bash
docker-compose up -d
```

Stop all services:
```bash
docker-compose down
```

Then run the Node.js app locally with `npm run dev` (it connects to the Docker services via localhost).

---

## Section 9: System Design — Interview Prep

This project prepares you to answer 20 common backend and system design interview questions. Study these carefully — they come up constantly.

---

**1. What is an inverted index and how does Elasticsearch use it?**

An inverted index maps from words to the documents that contain them. Instead of scanning every document for a keyword, Elasticsearch looks up the keyword in the index and instantly gets the list of matching documents. This is why search is fast even with millions of documents. Elasticsearch builds the inverted index when you index a document — the `english` and `standard` analyzers tokenize the text before it's stored.

---

**2. How does relevance scoring work in Elasticsearch?**

Elasticsearch uses BM25 (Best Match 25), an improved version of TF-IDF. It considers: (1) term frequency — how often the search term appears in the document; (2) inverse document frequency — how rare the term is across all documents; (3) field length normalization — a match in a short title is more significant than a match in a long article. In this project, title matches are boosted 3× (`title^3`) so documents with the keyword in the title rank higher than those with it only in the content.

---

**3. Why do we use Redis in front of Elasticsearch?**

Elasticsearch is fast (~10-50ms per query) but not free — every query uses CPU and memory. For popular repeated searches, Redis returns the result in under 1ms from memory. This dramatically reduces load on Elasticsearch and improves response times for users. The trade-off is that cached results may be up to 5 minutes stale (the TTL), which is acceptable for most search use cases.

---

**4. What is cache invalidation and why is it hard?**

Cache invalidation means removing stale cached data when the underlying data changes. It's hard because you need to know which cached entries are affected by a change. In this project, when a document is created or deleted, we invalidate ALL `search:*` keys in Redis (a broad invalidation strategy). This is simple but potentially over-invalidates — a document in the "programming" category shouldn't invalidate cached searches for "cooking recipes." A more sophisticated approach would only invalidate keys related to the affected category.

---

**5. What is the MVC pattern and why do we use it?**

MVC (Model-View-Controller) separates an application into three layers: Models define data shapes, Controllers handle HTTP requests/responses, and Services (an extension) contain business logic. We use it because it makes code easier to test (services can be tested without an HTTP server), easier to maintain (each file has one clear responsibility), and easier to extend (you can add a new endpoint without touching the business logic).

---

**6. Why do we separate services from controllers?**

Controllers know about HTTP (`req`, `res`, status codes). Services know about databases (MongoDB, Elasticsearch, Redis). Keeping them separate means: (1) you can test a service by calling it directly without spinning up an HTTP server; (2) you can swap Express for another framework without rewriting business logic; (3) the same service can be called from multiple controllers or background jobs.

---

**7. What is rate limiting and why is it important?**

Rate limiting restricts how many requests a single IP address can make in a time window. Without it, a single bad actor could flood the API with thousands of requests per second, crashing the server for everyone else (a denial-of-service attack). This project uses two limits: 100 req/15min globally, and 30 req/15min for document creation (which is more expensive because it writes to two databases).

---

**8. How does pagination work in Elasticsearch?**

Elasticsearch uses `from` and `size` parameters. `from` is the number of results to skip (like SQL's `OFFSET`), and `size` is the number of results to return (like SQL's `LIMIT`). For page 3 with 10 results per page: `from = (3-1) * 10 = 20`, `size = 10`. The response includes `hits.total.value` — the total number of matching documents — which the client uses to calculate how many pages exist.

---

**9. What are Elasticsearch shards and replicas?**

Shards split an index across multiple nodes so queries can run in parallel. This project uses 2 primary shards. Replicas are copies of shards on different nodes for high availability — if a node goes down, the replica takes over. This project uses 1 replica per shard. The trade-off: more shards = better parallelism but more overhead; more replicas = better availability but more storage.

---

**10. How does the completion suggester work for autocomplete?**

The completion suggester stores a Finite State Transducer (FST) — a compact, memory-efficient data structure — for each indexed document's `title.suggest` field. When you query with a prefix like "nod", the FST finds all titles starting with "nod" in sub-millisecond time. It's much faster than a regular `prefix` query because the FST is kept in memory and optimized for prefix lookups.

---

**11. What is a MongoDB aggregation pipeline?**

An aggregation pipeline is a series of stages that transform data step by step. Each stage takes the output of the previous stage as input. In `analyticsService.getPopular()`, the pipeline has 4 stages: `$group` (group SearchEvents by query and count them), `$sort` (sort by count descending), `$limit` (keep top 10), `$project` (rename `_id` to `query`). It's equivalent to `SELECT query, COUNT(*) FROM search_events GROUP BY query ORDER BY count DESC LIMIT 10` in SQL.

---

**12. Why do we use fire-and-forget for analytics recording?**

Recording a search event to MongoDB takes time (~5-20ms). If we awaited it, every search response would be delayed by that amount. Since analytics data is not critical to the user's immediate experience, we use `setImmediate()` to schedule the write after the current event loop tick — the user gets their results immediately, and the analytics write happens in the background. The trade-off: if the write fails, we lose that analytics event silently.

---

**13. What is the difference between a term filter and a match query in Elasticsearch?**

A `match` query is for full-text search — it analyzes the query string (tokenizes, stems, etc.) and finds documents where the analyzed tokens appear. It affects the relevance score. A `term` filter is for exact-value matching — it does NOT analyze the value and does NOT affect the score. Use `match` for text fields (title, content), use `term` for keyword fields (category, status). In this project, `multi_match` is used for the search query and `term` is used for the category filter.

---

**14. How would you scale this system to handle 1 million users?**

Several strategies: (1) Run multiple Node.js instances behind a load balancer (the app is stateless); (2) Move rate limiting to a shared Redis store so all instances share counters; (3) Add more Elasticsearch nodes and increase shard count; (4) Use a Redis cluster for the cache layer; (5) Move MongoDB to a replica set for read scaling; (6) Add a CDN in front of the API for static responses; (7) Use Elasticsearch's async bulk indexing for write-heavy workloads.

---

**15. What is the difference between MongoDB and Elasticsearch — why use both?**

MongoDB is a general-purpose document database optimized for CRUD operations, flexible schemas, and transactional writes. Elasticsearch is a search engine optimized for full-text search, relevance scoring, and aggregations. MongoDB is the source of truth (authoritative data store). Elasticsearch is the search index (optimized read layer). We use both because MongoDB handles reliable storage and Elasticsearch handles fast search — each does what it's best at.

---

**16. What is CORS and why do we need it?**

CORS (Cross-Origin Resource Sharing) is a browser security mechanism that blocks JavaScript from making requests to a different domain than the page it's on. For example, a frontend at `https://myapp.com` cannot call `https://api.myapp.com` without CORS headers. The `cors()` middleware adds `Access-Control-Allow-Origin` and related headers to responses, telling browsers that cross-origin requests are allowed. Without it, browser-based frontends can't call the API.

---

**17. What does helmet.js do?**

Helmet sets ~14 HTTP security headers that protect against common web vulnerabilities: `X-Content-Type-Options` (prevents MIME-type sniffing), `X-Frame-Options` (prevents clickjacking), `Content-Security-Policy` (restricts which scripts can run), `Strict-Transport-Security` (forces HTTPS), and more. It's a one-liner that gives you significant security improvements for free.

---

**18. What is the difference between HTTP 400 and HTTP 422?**

HTTP 400 (Bad Request) means the server cannot process the request because of a client error — the request is malformed, missing required fields, or has invalid syntax. HTTP 422 (Unprocessable Entity) means the request is syntactically correct but semantically invalid — the server understands the request but can't process it (e.g., a date range where `date_from` is after `date_to`). This project uses 400 for all validation errors, which is the most common convention for REST APIs.

---

**19. How does the rollback strategy work when Elasticsearch fails after MongoDB write?**

When `documentService.create()` saves to MongoDB successfully but Elasticsearch indexing fails, the service calls `Document.findByIdAndDelete(doc._id)` to delete the MongoDB record, then throws an `InternalError`. This keeps both stores in sync — the document doesn't exist in either. The client receives HTTP 500 and can retry. Note: true distributed transactions across MongoDB and Elasticsearch are not possible without a saga/outbox pattern. The compensating delete approach is a pragmatic approximation.

---

**20. What is property-based testing and how does it differ from unit testing?**

Unit testing verifies specific examples: "given this input, expect this output." Property-based testing verifies universal properties: "for ANY valid input, this invariant should hold." For example, instead of testing that `buildSearchKey({ q: 'a' })` returns `'search:q=a'`, a property test asserts that `buildSearchKey()` ALWAYS returns a string starting with `'search:'` for any input. Property-based testing uses libraries like `fast-check` to generate hundreds of random inputs automatically, finding edge cases you wouldn't think to test manually.

---

## Section 10: Deployment Guide

When you're ready to share your project with the world, here's how to deploy it.

---

### Environment Variables for Production

Set these in your hosting platform's environment variable settings (never in code):

```env
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/searchengine
ELASTICSEARCH_URL=https://your-cluster.es.io:9243
REDIS_URL=redis://default:password@your-redis-host:6379
```

**Production checklist:**
- `NODE_ENV=production` — disables development-only features, enables optimizations
- Use strong, randomly generated passwords for all services
- Enable authentication on MongoDB, Elasticsearch, and Redis
- Use HTTPS for all service connections
- Set up monitoring and alerting (e.g., Datadog, New Relic)
- Configure log aggregation (e.g., Papertrail, Logtail)
- Set up health check endpoints

---

### Deploying to Railway

[Railway](https://railway.app) is a beginner-friendly platform that deploys Node.js apps from a GitHub repository.

1. **Create a Railway account** at [railway.app](https://railway.app)

2. **Create a new project** → "Deploy from GitHub repo" → select your repository

3. **Add environment variables:**
   - Go to your service → Variables tab
   - Add all variables from the production `.env` section above

4. **Railway auto-detects Node.js** and runs `npm start` automatically. Make sure your `package.json` has:
   ```json
   "scripts": {
     "start": "node src/server.js"
   }
   ```

5. **Add MongoDB, Redis as Railway services:**
   - In your project, click "New" → "Database" → "MongoDB" or "Redis"
   - Railway provides the connection URL automatically — copy it to your environment variables

6. **For Elasticsearch:** Use Elastic Cloud (see below) — Railway doesn't offer Elasticsearch natively.

7. **Deploy:** Railway deploys automatically on every push to your main branch.

---

### Deploying to Render

[Render](https://render.com) is another beginner-friendly platform with a generous free tier.

1. **Create a Render account** at [render.com](https://render.com)

2. **Create a new Web Service** → connect your GitHub repository

3. **Configure the service:**
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `node src/server.js`

4. **Add environment variables** in the Environment tab

5. **For MongoDB:** Use MongoDB Atlas (see below)

6. **For Redis:** Render offers a managed Redis service — create one and copy the connection URL

7. **For Elasticsearch:** Use Elastic Cloud (see below)

8. **Deploy:** Render deploys automatically on every push.

---

### Using MongoDB Atlas (Cloud MongoDB)

MongoDB Atlas is the official cloud-hosted MongoDB service. It has a free tier (M0) that's perfect for learning.

1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a new cluster (choose the free M0 tier)
4. Create a database user (username + password)
5. Add your IP address to the IP Access List (or use `0.0.0.0/0` to allow all IPs)
6. Click "Connect" → "Connect your application" → copy the connection string
7. Replace `<password>` in the connection string with your database user's password
8. Set `MONGODB_URI` to this connection string in your deployment environment

---

### Using Elastic Cloud (Cloud Elasticsearch)

Elastic Cloud is the official cloud-hosted Elasticsearch service. It has a 14-day free trial.

1. Go to [https://cloud.elastic.co](https://cloud.elastic.co)
2. Create a free account and start a trial
3. Create a new deployment (choose the smallest size for learning)
4. After deployment, go to "Manage" → "Copy endpoint" for the Elasticsearch URL
5. Create an API key or use the `elastic` user credentials
6. Set `ELASTICSEARCH_URL` to `https://username:password@your-cluster.es.io:9243`

---

### Using Redis Cloud (Cloud Redis)

Redis Cloud is the official cloud-hosted Redis service. It has a free tier (30MB).

1. Go to [https://redis.com/try-free/](https://redis.com/try-free/)
2. Create a free account
3. Create a new database (free tier)
4. Copy the connection string from the database details page
5. Set `REDIS_URL` to the provided connection string

---

### Production Checklist

Before going live, verify:

- [ ] `NODE_ENV=production` is set
- [ ] All secrets are in environment variables, not in code
- [ ] `.env` is in `.gitignore` and NOT committed to git
- [ ] MongoDB, Elasticsearch, and Redis all require authentication
- [ ] All service connections use HTTPS/TLS
- [ ] Rate limiting is configured appropriately for your expected traffic
- [ ] Error logs are being collected and monitored
- [ ] Health check endpoint exists (e.g., `GET /health` returns 200)
- [ ] The app restarts automatically on crash (Railway and Render handle this)
- [ ] You've tested the deployment with the curl commands from Section 7

---

## Section 11: What to Build Next (Learning Path)

You've built a solid foundation. Here are 5 features to add that will deepen your skills and make the project more impressive.

---

### 1. JWT Authentication

**What it is:** JSON Web Tokens (JWT) are a way to authenticate users. Instead of sending a username and password with every request, the user logs in once and receives a token. They include this token in subsequent requests, and the server verifies it.

**What you'll learn:**
- How authentication works in REST APIs
- How to use `jsonwebtoken` npm package
- How to write authentication middleware
- The difference between authentication (who are you?) and authorization (what can you do?)

**How to add it:**
1. Create a `User` model with `email` and `password` (hashed with `bcrypt`)
2. Add `POST /api/auth/register` and `POST /api/auth/login` endpoints
3. On login, generate a JWT with `jwt.sign({ userId }, SECRET, { expiresIn: '7d' })`
4. Create `authMiddleware` that reads the `Authorization: Bearer <token>` header, verifies the JWT, and sets `req.user`
5. Protect routes by adding `authMiddleware` before the controller

**Resources:**
- [jwt.io](https://jwt.io) — interactive JWT decoder and documentation
- [jsonwebtoken npm package](https://www.npmjs.com/package/jsonwebtoken)

---

### 2. Full-Text Search with Synonyms

**What it is:** Synonyms let users find documents even when they use different words. For example, a search for "automobile" should also match documents containing "car" or "vehicle."

**What you'll learn:**
- Elasticsearch custom analyzers
- Synonym token filters
- How to update an index mapping

**How to add it:**
1. Create a custom analyzer in the Elasticsearch index settings:
   ```json
   {
     "settings": {
       "analysis": {
         "filter": {
           "synonym_filter": {
             "type": "synonym",
             "synonyms": ["car, automobile, vehicle", "js, javascript"]
           }
         },
         "analyzer": {
           "synonym_analyzer": {
             "tokenizer": "standard",
             "filter": ["lowercase", "synonym_filter"]
           }
         }
       }
     }
   }
   ```
2. Apply the `synonym_analyzer` to the `content` field in the mapping
3. Re-index all documents

---

### 3. Search Result Ranking Feedback (Thumbs Up/Down)

**What it is:** Let users vote on whether a search result was helpful. Use this feedback to improve relevance over time.

**What you'll learn:**
- How to collect user feedback
- How to use Elasticsearch's `function_score` query to boost highly-rated documents
- How to build a feedback loop into a search system

**How to add it:**
1. Add a `rating` field to the Document model (average score, vote count)
2. Create `POST /api/documents/:id/vote` endpoint (accepts `+1` or `-1`)
3. Update the Elasticsearch document with the new rating
4. Modify the search query to use `function_score` with a `field_value_factor` on the rating field:
   ```json
   {
     "query": {
       "function_score": {
         "query": { "multi_match": { ... } },
         "field_value_factor": {
           "field": "rating",
           "factor": 1.2,
           "modifier": "log1p"
         }
       }
     }
   }
   ```

---

### 4. Elasticsearch Aggregations for Faceted Search

**What it is:** Faceted search shows users how many results exist in each category, date range, or other dimension — like the filters on an e-commerce site ("Electronics (42)", "Books (18)").

**What you'll learn:**
- Elasticsearch aggregations (bucket aggregations, metric aggregations)
- How to build faceted navigation
- How to combine search results with aggregation data in one query

**How to add it:**
1. Add an `aggs` block to the Elasticsearch search query:
   ```json
   {
     "aggs": {
       "categories": {
         "terms": { "field": "category", "size": 10 }
       },
       "date_histogram": {
         "date_histogram": {
           "field": "createdAt",
           "calendar_interval": "month"
         }
       }
     }
   }
   ```
2. Include the aggregation results in the API response:
   ```json
   {
     "data": [...],
     "facets": {
       "categories": [
         { "key": "programming", "count": 42 },
         { "key": "science", "count": 18 }
       ]
     }
   }
   ```

---

### 5. WebSocket for Real-Time Search Suggestions

**What it is:** Instead of making a new HTTP request for every keystroke (which can be slow and expensive), use a WebSocket connection to stream autocomplete suggestions in real time.

**What you'll learn:**
- How WebSockets work (persistent bidirectional connection vs. HTTP request/response)
- How to use the `ws` npm package with Express
- How to debounce user input on the client side
- The difference between HTTP and WebSocket protocols

**How to add it:**
1. Install `ws`: `npm install ws`
2. Create a WebSocket server alongside the HTTP server in `server.js`:
   ```javascript
   const WebSocket = require('ws');
   const wss = new WebSocket.Server({ server: httpServer });
   
   wss.on('connection', (ws) => {
     ws.on('message', async (prefix) => {
       const suggestions = await searchService.autocomplete(prefix.toString());
       ws.send(JSON.stringify(suggestions));
     });
   });
   ```
3. On the client side, open a WebSocket connection and send the current input value on each keystroke (with debouncing to avoid sending on every character)

---

## Converting This Guide to PDF

To convert this guide to PDF, run:

```
pandoc GUIDE.md -o GUIDE.pdf
```

(requires Pandoc installed: https://pandoc.org/installing.html)

You can also use any Markdown-to-PDF VS Code extension, or paste the content into a tool like [md2pdf.netlify.app](https://md2pdf.netlify.app).

---

*You've made it to the end! This project covers a lot of ground — search engines, caching, analytics, rate limiting, validation, and structured logging. Each of these is a skill that real backend engineers use every day. Keep building, keep experimenting, and don't be afraid to break things. That's how you learn. Good luck!*
