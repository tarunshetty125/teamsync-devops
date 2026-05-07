/**
 * Dashboard Page Component
 * Main SaaS dashboard with stats, activity feed, team members, and pipeline viz.
 */
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import './Dashboard.css';

const API_BASE = '/api';

// Demo fallback data
const DEMO_STATS = {
  totalUsers: 2847, activeProjects: 156, revenue: 48250,
  growth: 12.5, uptime: 99.97, apiCalls: 1243567
};

const DEMO_ACTIVITIES = [
  { id: 1, type: 'deploy', message: 'Production deployment completed', user: 'Tarun Shetty', timestamp: new Date(Date.now() - 300000).toISOString(), status: 'success' },
  { id: 2, type: 'user', message: 'New team member added', user: 'Admin', timestamp: new Date(Date.now() - 1800000).toISOString(), status: 'info' },
  { id: 3, type: 'alert', message: 'CPU usage spike detected (85%)', user: 'System', timestamp: new Date(Date.now() - 3600000).toISOString(), status: 'warning' },
  { id: 4, type: 'deploy', message: 'Staging environment updated', user: 'CI/CD Pipeline', timestamp: new Date(Date.now() - 7200000).toISOString(), status: 'success' },
  { id: 5, type: 'security', message: 'SSL certificate renewed', user: 'System', timestamp: new Date(Date.now() - 10800000).toISOString(), status: 'success' },
];

const DEMO_TEAM = [
  { id: 1, name: 'Tarun Shetty', role: 'DevOps Lead', status: 'online', avatar: 'TS' },
  { id: 2, name: 'Priya Kumar', role: 'Backend Dev', status: 'online', avatar: 'PK' },
  { id: 3, name: 'Rahul Nair', role: 'Frontend Dev', status: 'away', avatar: 'RN' },
  { id: 4, name: 'Ananya Rao', role: 'QA Engineer', status: 'online', avatar: 'AR' },
  { id: 5, name: 'Vikram Das', role: 'Cloud Architect', status: 'offline', avatar: 'VD' },
];

function Dashboard({ user, onLogout }) {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [team, setTeam] = useState([]);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('teamsync_token');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    try {
      const [statsRes, activityRes, teamRes] = await Promise.all([
        fetch(`${API_BASE}/dashboard/stats`, { headers }),
        fetch(`${API_BASE}/dashboard/activity`, { headers }),
        fetch(`${API_BASE}/dashboard/team`, { headers })
      ]);
      const [statsData, activityData, teamData] = await Promise.all([statsRes.json(), activityRes.json(), teamRes.json()]);
      if (statsData.success) setStats(statsData.data);
      if (activityData.success) setActivities(activityData.data);
      if (teamData.success) setTeam(teamData.data);
    } catch (err) {
      console.log('Using demo data');
      setStats(DEMO_STATS);
      setActivities(DEMO_ACTIVITIES);
      setTeam(DEMO_TEAM);
    }
  };

  const timeAgo = (ts) => {
    const s = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const activityIcons = { deploy: '🚀', user: '👤', alert: '⚠️', security: '🔒', database: '🗄️' };

  const PIPELINE = [
    { name: 'Source', icon: '📝', status: 'complete', detail: 'GitHub Push' },
    { name: 'Build', icon: '🔨', status: 'complete', detail: 'Docker Build' },
    { name: 'Test', icon: '🧪', status: 'complete', detail: 'All Passed' },
    { name: 'Deploy', icon: '🚀', status: 'complete', detail: 'AWS EC2' },
    { name: 'Monitor', icon: '📊', status: 'active', detail: 'Prometheus' },
  ];

  const INFRA = [
    { name: 'Docker', icon: '🐳', status: 'Running', detail: '3 containers' },
    { name: 'Nginx', icon: '⚡', status: 'Active', detail: 'Reverse proxy' },
    { name: 'MongoDB', icon: '🍃', status: 'Connected', detail: 'Atlas Cluster' },
    { name: 'Prometheus', icon: '📈', status: 'Scraping', detail: '15s interval' },
    { name: 'Grafana', icon: '📊', status: 'Live', detail: 'Port 3001' },
    { name: 'GitHub Actions', icon: '🔄', status: 'Ready', detail: 'CI/CD Pipeline' },
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar user={user} activeSection={activeSection} onSectionChange={setActiveSection} onLogout={onLogout} />
      <main className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-left">
            <h1>Dashboard Overview</h1>
            <p className="header-subtitle">Welcome back, {user?.name || 'User'} 👋</p>
          </div>
          <div className="header-right">
            <div className="header-status"><span className="status-dot status-dot-live"></span><span>All Systems Operational</span></div>
          </div>
        </header>

        {/* Stats Cards */}
        <section className="stats-grid">
          {[
            { label: 'Total Users', value: stats?.totalUsers?.toLocaleString(), change: `+${stats?.growth || 0}% this month`, iconClass: 'stat-icon-users', iconPath: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' },
            { label: 'Active Projects', value: stats?.activeProjects, change: '+8 new this week', iconClass: 'stat-icon-projects', iconPath: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' },
            { label: 'Revenue (MRR)', value: `$${stats?.revenue?.toLocaleString() || '—'}`, change: '+18.2% growth', iconClass: 'stat-icon-revenue', iconPath: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
            { label: 'Uptime', value: `${stats?.uptime || '—'}%`, change: 'Excellent', iconClass: 'stat-icon-uptime', iconPath: 'M22 12 18 12 15 21 9 3 6 12 2 12' },
          ].map((card, i) => (
            <div key={card.label} className="stat-card animate-fade-in" style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
              <div className={`stat-icon ${card.iconClass}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={card.iconPath}/></svg>
              </div>
              <div className="stat-content">
                <span className="stat-label">{card.label}</span>
                <span className="stat-value">{card.value || '—'}</span>
                <span className="stat-change positive">{card.change}</span>
              </div>
            </div>
          ))}
        </section>

        {/* Activity & Team Grid */}
        <div className="content-grid">
          <section className="dashboard-card activity-card animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <div className="card-header"><h2>Recent Activity</h2><span className="card-badge">{activities.length} events</span></div>
            <div className="activity-list">
              {activities.map((a) => (
                <div key={a.id} className="activity-item">
                  <span className="activity-icon">{activityIcons[a.type] || '📋'}</span>
                  <div className="activity-content">
                    <p className="activity-message">{a.message}</p>
                    <div className="activity-meta"><span className="activity-user">{a.user}</span><span className="activity-time">{timeAgo(a.timestamp)}</span></div>
                  </div>
                  <span className={`activity-status activity-${a.status}`}>{a.status}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="dashboard-card team-card animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <div className="card-header"><h2>Team Members</h2><span className="card-badge">{team.filter(m => m.status === 'online').length} online</span></div>
            <div className="team-list">
              {team.map((m) => (
                <div key={m.id} className="team-member">
                  <div className="member-avatar"><span>{m.avatar}</span><span className={`member-status status-${m.status}`}></span></div>
                  <div className="member-info"><p className="member-name">{m.name}</p><p className="member-role">{m.role}</p></div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Pipeline Status */}
        <section className="dashboard-card pipeline-card animate-fade-in" style={{ animationDelay: '0.7s' }}>
          <div className="card-header"><h2>DevOps Pipeline Status</h2><span className="card-badge live">Live</span></div>
          <div className="pipeline-stages">
            {PIPELINE.map((stage, i) => (
              <React.Fragment key={stage.name}>
                <div className={`pipeline-stage ${stage.status}`}>
                  <span className="stage-icon">{stage.icon}</span>
                  <span className="stage-name">{stage.name}</span>
                  <span className="stage-detail">{stage.detail}</span>
                  <span className={`stage-indicator ${stage.status}`}></span>
                </div>
                {i < 4 && <div className={`pipeline-connector ${stage.status}`}></div>}
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* Infrastructure */}
        <section className="dashboard-card infra-card animate-fade-in" style={{ animationDelay: '0.8s' }}>
          <div className="card-header"><h2>Infrastructure</h2></div>
          <div className="infra-grid">
            {INFRA.map((item) => (
              <div key={item.name} className="infra-item">
                <span className="infra-icon">{item.icon}</span>
                <div className="infra-info"><span className="infra-name">{item.name}</span><span className="infra-detail">{item.detail}</span></div>
                <span className="infra-status">{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
