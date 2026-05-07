/**
 * Prometheus Metrics Middleware
 * 
 * Collects HTTP request metrics for monitoring.
 * Exposes metrics at /metrics endpoint for Prometheus scraping.
 */

const client = require('prom-client');

// Create a Registry to register metrics
const register = new client.Registry();

// Add default Node.js metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register });

// ─── Custom Metrics ─────────────────────────────────────────

// Counter: Total HTTP requests
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Histogram: HTTP request duration
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.5, 1, 5],
  registers: [register]
});

// Gauge: Active connections
const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register]
});

/**
 * Middleware to collect metrics for each HTTP request
 * Records request count, duration, and active connections
 */
const metricsMiddleware = (req, res, next) => {
  // Skip metrics endpoint to avoid recursion
  if (req.path === '/metrics') return next();

  activeConnections.inc();
  const start = Date.now();

  // Hook into response finish event
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;

    httpRequestsTotal.inc({
      method: req.method,
      route: route,
      status_code: res.statusCode
    });

    httpRequestDuration.observe({
      method: req.method,
      route: route,
      status_code: res.statusCode
    }, duration);

    activeConnections.dec();
  });

  next();
};

/**
 * Endpoint handler for /metrics
 * Returns all registered metrics in Prometheus exposition format
 */
const metricsEndpoint = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
};

module.exports = { metricsMiddleware, metricsEndpoint };
