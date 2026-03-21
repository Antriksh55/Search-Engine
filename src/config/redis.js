/**
 * src/config/redis.js
 * Redis client configuration using ioredis.
 *
 * What this file does (for beginners):
 *   - Creates a single Redis client that the whole app shares (singleton pattern).
 *   - Redis is our cache layer — it stores search results in memory so we don't
 *     have to hit Elasticsearch on every repeated query.
 *   - If Redis is unavailable, we log the error but DO NOT crash the process.
 *     The app can still work without the cache; it just won't be as fast.
 */

'use strict';

const Redis = require('ioredis');

// Read the Redis connection URL from the environment, or fall back to localhost.
// In production you'd set REDIS_URL to something like redis://user:pass@host:6379
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * redisClient — singleton ioredis instance.
 *
 * ioredis automatically attempts to reconnect when the connection drops,
 * so we don't need to write reconnect logic manually.
 *
 * lazyConnect: false (default) means it connects immediately when this
 * module is first required.
 */
const redisClient = new Redis(REDIS_URL, {
  // If Redis is down at startup, ioredis will keep retrying.
  // maxRetriesPerRequest: null tells ioredis to retry indefinitely
  // rather than throwing after a fixed number of attempts.
  maxRetriesPerRequest: null,
});

// 'connect' fires once the TCP connection to Redis is established.
redisClient.on('connect', () => {
  console.log('Redis connected');
});

// 'error' fires on any connection or command error.
// We log it but do NOT call process.exit() — the app degrades gracefully
// (cache misses on every request) rather than going completely down.
redisClient.on('error', (err) => {
  console.error('Redis error:', err.message);
});

module.exports = { redisClient };
