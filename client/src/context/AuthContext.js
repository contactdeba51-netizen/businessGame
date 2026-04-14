import React, { createContext, useState, useContext, useEffect } from 'react';
import { loginUser, registerUser, getMe } from '../services/api';
import { getSocket } from '../services/socket';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Connect socket whenever we have a logged-in user
  useEffect(() => {
    const socket = getSocket();
    if (user) {
      if (!socket.connected) {
        socket.connect();
        console.log('🔌 Socket connected for user:', user.username);
      }
    }
  }, [user]);

  // On app load, check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const data = await getMe();
          setUser(data.user);
        } catch {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [token]);

  const register = async (username, email, password) => {
    const data = await registerUser(username, email, password);
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const login = async (email, password) => {
    const data = await loginUser(email, password);
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    const socket = getSocket();
    socket.disconnect();
    sessionStorage.removeItem('monopoly_room');
    sessionStorage.removeItem('monopoly_player');
    sessionStorage.removeItem('monopoly_gamestate');
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);