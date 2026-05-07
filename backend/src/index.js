/**
 * TeamSync Backend - Main Entry Point
 * 
 * Express server with MongoDB Atlas connection,
 * JWT authentication, and Prometheus metrics.
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const healthRoutes = require('./routes/health');

// Import Prometheus metrics middleware
const { metricsMiddleware, metricsEndpoint } = require('./middleware/metrics');

const app = express();
const PORT = process.env.PORT || 5987;

// ─── Middleware ──────────────────────────────────────────────
app.use(cors());                          // Enable CORS for frontend
app.use(express.json());                  // Parse JSON request bodies
app.use(morgan('combined'));              // HTTP request logging
app.use(metricsMiddleware);               // Prometheus metrics collection

// ─── API Routes ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);         // Authentication endpoints
app.use('/api/dashboard', dashboardRoutes); // Dashboard data endpoints
app.use('/api/health', healthRoutes);     // Health check endpoint

// ─── Prometheus Metrics Endpoint ────────────────────────────
app.get('/metrics', metricsEndpoint);

// ─── Root Route ─────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    message: 'TeamSync API v1.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      dashboard: '/api/dashboard',
      health: '/api/health',
      metrics: '/metrics'
    }
  });
});

// ─── MongoDB Connection ─────────────────────────────────────
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:5006/teamsync';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    // In production, retry connection instead of exiting
    if (process.env.NODE_ENV === 'production') {
      console.log('⏳ Retrying connection in 5 seconds...');
      setTimeout(connectDB, 5000);
    }
  }
};

// ─── Start Server ───────────────────────────────────────────
const startServer = async () => {
  await connectDB();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TeamSync Backend running on port ${PORT}`);
    console.log(`📊 Metrics available at /metrics`);
    console.log(`🏥 Health check at /api/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer();

module.exports = app;
