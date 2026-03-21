/**
 * cacheManager.js — Redis-based caching utilities
 *
 * What is Redis?
 * Redis is an in-memory data store (think of it as a super-fast dictionary that
 * lives in RAM). We use it as a cache so that repeated search queries don't have
 * to hit Elasticsearch every time — Redis can answer in under 1ms vs ~10-50ms
 * for Elasticsearch.
 *
 * What is TTL (Time To Live)?
 * TTL is the number of seconds a cached value stays alive before Redis
 * automatically deletes it. We default to 300 seconds (5 minutes). After that,
 * the next request will be a cache miss and will re-query Elasticsearch.
 *
 * Cache invalidation strategy:
 * When a document is created or deleted, search results may be stale. We use
 * Redis SCAN to find all keys that start with "search:" and delete them so the
 * next search re-fetches fresh results from Elasticsearch.
 */

const { redisClient } = require('../config/redis');

/**
 * Fetch a value from Redis by key.
 * Returns the parsed JSON object, or null if the key doesn't exist or an error occurs.
 *
 * @param {string} key - The Redis key to look up
 * @returns {Promise<any|null>}
 */
async function get(key) {
  try {
    const raw = await redisClient.get(key);
    if (raw === null) return null; // cache miss
    return JSON.parse(raw);
  } catch (err) {
    // If Redis is down or the value is malformed, treat it as a miss
    // rather than crashing the whole request.
    console.error('[CacheManager] get error:', err.message);
    return null;
  }
}

/**
 * Store a value in Redis with an expiry (TTL).
 *
 * @param {string} key   - The Redis key
 * @param {any}    value - The value to store (will be JSON-stringified)
 * @param {number} ttl   - Seconds until the key expires (default: 300)
 * @returns {Promise<void>}
 */
async function set(key, value, ttl = 300) {
  try {
    // EX sets the expiry in seconds — this is the TTL
    await redisClient.set(key, JSON.stringify(value), 'EX', ttl);
  } catch (err) {
    // A cache write failure is non-fatal; log it and move on
    console.error('[CacheManager] set error:', err.message);
  }
}

/**
 * Delete all Redis keys that match a glob pattern.
 *
 * Why SCAN instead of KEYS?
 * KEYS blocks the entire Redis server while it scans — dangerous in production
 * because it can freeze all other clients for seconds on large datasets.
 * SCAN is non-blocking: it returns a small cursor-based batch each call, so
 * Redis stays responsive throughout the operation.
 *
 * @param {string} pattern - Redis glob pattern, e.g. "search:*"
 * @returns {Promise<void>}
 */
async function invalidatePattern(pattern) {
  try {
    const keys = [];
    let cursor = '0';

    // SCAN iterates through the keyspace in batches.
    // We keep going until the cursor wraps back to '0' (full scan complete).
    do {
      // COUNT 100 is a hint to Redis about batch size — not a hard limit
      const [nextCursor, batch] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    // Nothing to delete — handle gracefully
    if (keys.length === 0) return;

    // DEL accepts multiple keys at once for efficiency
    await redisClient.del(...keys);
  } catch (err) {
    console.error('[CacheManager] invalidatePattern error:', err.message);
  }
}

/**
 * Build a deterministic cache key from a search params object.
 *
 * Why sort keys alphabetically?
 * { q: 'node', page: 1 } and { page: 1, q: 'node' } represent the same query.
 * By sorting the keys before building the string, we guarantee that both
 * produce the identical cache key — so we never store duplicate entries for
 * the same logical query.
 *
 * Example:
 *   buildSearchKey({ q: 'nodejs', page: 1, limit: 10 })
 *   → 'search:limit=10&page=1&q=nodejs'
 *
 * @param {Object} params - Search query parameters
 * @returns {string} Cache key prefixed with 'search:'
 */
function buildSearchKey(params) {
  // Sort keys alphabetically so key order never affects the cache key
  const sortedKeys = Object.keys(params).sort();

  const queryString = sortedKeys
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  return `search:${queryString}`;
}

module.exports = { get, set, invalidatePattern, buildSearchKey };
