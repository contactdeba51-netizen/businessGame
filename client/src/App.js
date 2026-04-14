import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Lobby from './pages/Lobby';
import Game from './pages/Game';

// ── Protected Route ────────────────────────────────────────
// If user is not logged in, redirect to login page
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={styles.loading}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

// ── Public Route ───────────────────────────────────────────
// If user is already logged in, redirect to dashboard
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={styles.loading}>Loading...</div>;
  if (user) return <Navigate to="/dashboard" />;
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes — only for non-logged-in users */}
      <Route path="/login" element={
        <PublicRoute><Login /></PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute><Register /></PublicRoute>
      } />

      {/* Protected routes — only for logged-in users */}
      <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/lobby/:roomCode" element={
        <ProtectedRoute><Lobby /></ProtectedRoute>
      } />
      <Route path="/game/:roomCode" element={
        <ProtectedRoute><Game /></ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
};

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a3c5e',
    color: '#fff',
    fontSize: '1.5rem',
  },
};

export default App;