import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

// Holds "who is logged in" for the whole app. The login itself lives in an httpOnly cookie that
// JavaScript can't read, so on startup we simply ask the backend: GET /api/auth/me.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.data.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  // If any request comes back 401 (session expired / account deactivated), log out locally
  // so ProtectedRoute sends the user to the login page.
  useEffect(() => {
    const id = api.interceptors.response.use(
      (response) => response,
      (error) => {
        const url = error.config?.url ?? '';
        if (error.response?.status === 401 && !url.startsWith('/auth/')) setUser(null);
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data.data.user);
    return res.data.data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, checking, login, logout }), [user, checking, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
