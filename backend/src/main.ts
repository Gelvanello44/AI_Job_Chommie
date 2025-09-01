// This is the main entry point that ensures Sentry is initialized BEFORE Express
// Initialize Sentry first
import { initSentry } from './config/sentry.js';
initSentry();

// Now import and start the server - this ensures Express is loaded AFTER Sentry
import { startServer } from './server.js';

console.log(' Starting AI Job Chommie Backend...');

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
