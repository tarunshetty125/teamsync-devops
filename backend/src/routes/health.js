/**
 * Health Check Routes
 * 
 * GET /api/health - Returns server health status
 * 
 * Used by:
 * - Docker health checks
 * - Load balancers
 * - Monitoring systems (Prometheus/Grafana)
 */

const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * GET /api/health
 * Returns comprehensive health status including:
 * - Server status
 * - Database connection state
 * - Uptime and memory usage
 */
router.get('/', (req, res) => {
  const healthcheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    // Database connection status
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      host: mongoose.connection.host || 'N/A'
    },
    // Memory usage in MB
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    },
    // Node.js version
    nodeVersion: process.version
  };

  // Always return 200 — server is functional even without DB (demo mode)
  // Database status is reported in the response body for monitoring
  res.status(200).json(healthcheck);
});

module.exports = router;
