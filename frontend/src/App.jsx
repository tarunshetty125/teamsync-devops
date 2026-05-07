/**
 * App Component - Root Application Router
 * 
 * Handles routing between Login and Dashboard pages.
 * Manages authentication state via localStorage token.
 */
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('teamsync_token');
    const savedUser = localStorage.getItem('teamsync_user');
    
    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  /**
   * Handle successful login
   * Stores token and user data in localStorage
   */
  const handleLogin = (token, userData) => {
    localStorage.setItem('teamsync_token', token);
    localStorage.setItem('teamsync_user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  /**
   * Handle logout
   * Clears stored authentication data
   */
  const handleLogout = () => {
    localStorage.removeItem('teamsync_token');
    localStorage.removeItem('teamsync_user');
    setIsAuthenticated(false);
    setUser(null);
  };

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading TeamSync...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Routes>
        {/* Login Route */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        
        {/* Dashboard Route (Protected) */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <Dashboard user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        
        {/* Default redirect */}
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </div>
  );
}

export default App;
