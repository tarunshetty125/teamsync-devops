/**
 * Dashboard Routes
 * 
 * GET /api/dashboard/stats    - Get dashboard statistics
 * GET /api/dashboard/activity - Get recent activity feed
 * GET /api/dashboard/team     - Get team members list
 * 
 * All routes are protected and require JWT authentication.
 */

const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/dashboard/stats
 * Returns SaaS dashboard statistics (sample data)
 */
router.get('/stats', authMiddleware, (req, res) => {
  // Sample SaaS dashboard metrics
  const stats = {
    totalUsers: 2847,
    activeProjects: 156,
    revenue: 48250,
    growth: 12.5,
    uptime: 99.97,
    apiCalls: 1243567,
    // Monthly trend data for charts
    monthlyData: [
      { month: 'Jan', users: 1200, revenue: 28000 },
      { month: 'Feb', users: 1450, revenue: 31000 },
      { month: 'Mar', users: 1680, revenue: 34500 },
      { month: 'Apr', users: 1920, revenue: 37200 },
      { month: 'May', users: 2340, revenue: 42800 },
      { month: 'Jun', users: 2847, revenue: 48250 }
    ]
  };

  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/dashboard/activity
 * Returns recent activity feed (sample data)
 */
router.get('/activity', authMiddleware, (req, res) => {
  const activities = [
    {
      id: 1,
      type: 'deploy',
      message: 'Production deployment completed',
      user: 'Tarun Shetty',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      status: 'success'
    },
    {
      id: 2,
      type: 'user',
      message: 'New team member added',
      user: 'Admin',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      status: 'info'
    },
    {
      id: 3,
      type: 'alert',
      message: 'CPU usage spike detected (85%)',
      user: 'System',
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      status: 'warning'
    },
    {
      id: 4,
      type: 'deploy',
      message: 'Staging environment updated',
      user: 'CI/CD Pipeline',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      status: 'success'
    },
    {
      id: 5,
      type: 'security',
      message: 'SSL certificate renewed',
      user: 'System',
      timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      status: 'success'
    },
    {
      id: 6,
      type: 'database',
      message: 'Database backup completed',
      user: 'Cron Job',
      timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      status: 'success'
    }
  ];

  res.json({
    success: true,
    data: activities
  });
});

/**
 * GET /api/dashboard/team
 * Returns team members (sample data)
 */
router.get('/team', authMiddleware, (req, res) => {
  const team = [
    { id: 1, name: 'Tarun Shetty', role: 'DevOps Lead', status: 'online', avatar: 'TS' },
    { id: 2, name: 'Priya Kumar', role: 'Backend Dev', status: 'online', avatar: 'PK' },
    { id: 3, name: 'Rahul Nair', role: 'Frontend Dev', status: 'away', avatar: 'RN' },
    { id: 4, name: 'Ananya Rao', role: 'QA Engineer', status: 'online', avatar: 'AR' },
    { id: 5, name: 'Vikram Das', role: 'Cloud Architect', status: 'offline', avatar: 'VD' }
  ];

  res.json({
    success: true,
    data: team
  });
});

module.exports = router;
