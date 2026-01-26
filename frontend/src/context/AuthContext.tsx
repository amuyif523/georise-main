/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { connectSocket, disconnectSocket, resetSocketGuard } from '../lib/socket';

type Role = 'CITIZEN' | 'AGENCY_STAFF' | 'ADMIN';

interface User {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  agencyId?: number | null;
  trustScore?: number;
  totalReports?: number;
  validReports?: number;
  rejectedReports?: number;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getInitialToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('georise_token');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialToken = getInitialToken();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!initialToken);
  const [lastActive, setLastActive] = useState<number>(() => Date.now());
  const SESSION_MAX_IDLE_MS = 30 * 60 * 1000; // 30 minutes
  const meInFlight = useRef<Promise<User | null> | null>(null);
  const meCacheRef = useRef<{ user: User | null; ts: number } | null>(null);
  const ME_CACHE_TTL_MS = 60_000; // avoid spamming /me on refreshes

  const fetchMe = useCallback(async () => {
    const now = Date.now();
    if (meCacheRef.current && now - meCacheRef.current.ts < ME_CACHE_TTL_MS) {
      setUser(meCacheRef.current.user);
      return meCacheRef.current.user;
    }

    if (!meInFlight.current) {
      meInFlight.current = api
        .get('/auth/me')
        .then((res) => {
          meCacheRef.current = { user: res.data.user, ts: Date.now() };
          setUser(res.data.user);
          return res.data.user;
        })
        .catch(() => {
          meCacheRef.current = { user: null, ts: Date.now() };
          setUser(null);
          return null;
        })
        .finally(() => {
          meInFlight.current = null;
        });
    }

    return meInFlight.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('georise_token');
    const run = async () => {
      if (token) {
        await fetchMe();
        if (!cancelled) {
          connectSocket(token);
        }
      } else {
        setUser(null);
      }
      if (!cancelled) setLoading(false);
    };

    if (token) {
      run();
    }

    const updateActive = () => setLastActive(Date.now());
    window.addEventListener('mousemove', updateActive);
    window.addEventListener('keydown', updateActive);
    return () => {
      window.removeEventListener('mousemove', updateActive);
      window.removeEventListener('keydown', updateActive);
      cancelled = true;
    };
  }, [SESSION_MAX_IDLE_MS, fetchMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user: userData } = res.data;
    localStorage.setItem('georise_token', token);
    setUser(userData);
    connectSocket(token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('georise_token');
    setUser(null);
    disconnectSocket();
    resetSocketGuard();
  }, []);

  const setAuth = useCallback((userData: User, token: string, refreshToken?: string) => {
    localStorage.setItem('georise_token', token);
    if (refreshToken) localStorage.setItem('georise_refresh_token', refreshToken);
    setUser(userData);
    connectSocket(token);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (user && Date.now() - lastActive > SESSION_MAX_IDLE_MS) {
        logout();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [user, lastActive, SESSION_MAX_IDLE_MS, logout]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
