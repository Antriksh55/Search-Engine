'use strict';

/**
 * server.js — Application Entry Point
 *
 * This is the file you run to START the application: `node src/server.js`
 * (or `npm run dev` which uses nodemon to auto-restart on file changes).
 *
 * DIFFERENCE BETWEEN app.js AND server.js:
 *
 *   app.js   → Defines the Express application: middleware, routes, error handling.
 *              It is a pure configuration file. It does NOT connect to databases
 *              or bind to a port. This makes it easy to import in tests without
 *              side effects.
 *
 *   server.js → The startup script. It connects to all external services
 *               (MongoDB, Elasticsearch) and then starts the HTTP listener.
 *               This is the "launch sequence" for the whole application.
 *
 * Keeping these two concerns separate is a best practice: tests can import
 * app without accidentally starting a real server or connecting to real DBs.
 */

/**
 * WHY dotenv.config() MUST BE CALLED FIRST:
 *
 * dotenv reads the .env file and loads its key=value pairs into process.env.
 * Any module that reads process.env (like db.js reading MONGODB_URI) will get
 * undefined if dotenv has not run yet.
 *
 * Rule: always call dotenv.config() at the very top of your entry point,
 * before requiring any other module that depends on environment variables.
 */
require('dotenv').config();

const app = require('./app');
const { connectMongoDB } = require('./config/db');
const { bootstrapElasticsearchIndex } = require('./config/elasticsearch');

// Read PORT from environment, fall back to 3000 for local development
const PORT = process.env.PORT || 3000;

/**
 * startServer — async startup sequence
 *
 * WHY connect to databases BEFORE calling app.listen()?
 *
 * If the server starts accepting HTTP requests before the database is ready,
 * the first few requests will fail with connection errors. By awaiting the
 * database connections first, we guarantee that when the server is open for
 * business (i.e., listening on a port), it can actually handle requests.
 *
 * The sequence is intentional:
 *   1. Connect to MongoDB  — document reads/writes need this
 *   2. Bootstrap Elasticsearch index — search needs the index to exist
 *   3. Start HTTP listener — only now do we accept incoming requests
 */
async function startServer() {
  try {
    // Step 1: Connect to MongoDB
    await connectMongoDB();

    // Step 2: Create the Elasticsearch index if it does not already exist.
    // This is idempotent — calling it multiple times is safe (it checks first).
    await bootstrapElasticsearchIndex();

    // Step 3: Start the HTTP server.
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    /**
     * WHY process.exit(1)?
     *
     * If any step above throws (e.g., MongoDB is unreachable), the server
     * cannot function correctly. Continuing would leave the app in a broken
     * state where requests silently fail.
     *
     * process.exit(1) terminates the Node.js process immediately.
     * The exit code 1 signals to the OS and process managers like PM2 or
     * Docker that the process exited due to an error (exit code 0 means
     * success; any non-zero code means failure). This lets orchestration
     * tools automatically restart the service.
     */
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
