/**
 * src/config/db.js
 * MongoDB connection configuration using Mongoose.
 *
 * What this file does (for beginners):
 *   - Connects our Node.js app to a MongoDB database.
 *   - If the connection fails, it logs the error and stops the process
 *     (no point running the app without a database).
 *   - Mongoose emits events when the connection drops or reconnects, so
 *     we listen to those and log them — useful for debugging in production.
 */

'use strict';

const mongoose = require('mongoose');

/**
 * connectMongoDB
 * Async function that opens a Mongoose connection to MongoDB.
 * Call this once at application startup (in server.js).
 */
async function connectMongoDB() {
  const uri = process.env.MONGODB_URI;

  try {
    // mongoose.connect() returns a promise; we await it so the caller
    // knows the connection is ready before the server starts listening.
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err) {
    // If the initial connection fails (e.g., wrong URI, DB not running),
    // log the error and exit. process.exit(1) signals an abnormal exit.
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }

  // --- Reconnect / lifecycle event listeners ---
  // These fire AFTER the initial connection, so they handle runtime drops.

  // 'disconnected' fires when Mongoose loses the connection mid-run.
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Attempting to reconnect...');
  });

  // 'reconnected' fires when Mongoose successfully re-establishes the link.
  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
  });

  // 'error' fires for any connection-level error after the initial connect.
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB runtime error:', err.message);
  });
}

module.exports = { connectMongoDB };
