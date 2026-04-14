// api.js — All HTTP requests to our backend
// axios is like fetch but cleaner and with better error handling

import axios from 'axios';

const SERVER_URL = process.env.REACT_APP_SERVER_URL;

// Create axios instance with base URL
const api = axios.create({
  baseURL: SERVER_URL,
  headers: { 
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',   // ← ADD THIS
  },
});

// Automatically attach JWT token to every request if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth API calls ───────────────────────────────────────
export const registerUser = async (username, email, password) => {
  const response = await api.post('/api/auth/register', {
    username, email, password
  });
  return response.data;
};

export const loginUser = async (email, password) => {
  const response = await api.post('/api/auth/login', {
    email, password
  });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/api/auth/me');
  return response.data;
};

export default api;