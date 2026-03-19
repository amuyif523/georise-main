/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { connectSocket, disconnectSocket, resetSocketGuard } from '../lib/socket';

type Role = 'CITIZEN' | 'AGENCY_STAFF' | 'AGENCY_MANAGER' | 'ADMIN';

interface VerificationRequest {
  id: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  agencyId?: number | null;
  trustScore?: number;
  totalReports?: number;
  validReports?: number;
  rejectedReports?: number;
  isVerified?: boolean;
  verificationRequest?: VerificationRequest | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getInitialToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('georise_token');
};

const normalizeUserPayload = (payload: unknown): User | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as { user?: User } & User;
  return data.user || data;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialToken = getInitialToken();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!initialToken);
  const [lastActive, setLastActive] = useState<number>(() => Date.now());
  const SESSION_MAX_IDLE_MS = 30 * 60 * 1000;
  const meInFlight = useRef<Promise<User | null> | null>(null);
  const meCacheRef = useRef<{ user: User | null; ts: number } | null>(null);
  const ME_CACHE_TTL_MS = 60_000;

  const fetchMe = useCallback(async (bustCache = false) => {
    const now = Date.now();

    // 1. If we aren't forcing a refresh and have a valid cache, return it
    if (!bustCache && meCacheRef.current && now - meCacheRef.current.ts < ME_CACHE_TTL_MS) {
      setUser(meCacheRef.current.user);
      return meCacheRef.current.user;
    }

    // 2. If busting cache, clear the reference immediately
    if (bustCache) {
      meCacheRef.current = null;
    }

    if (!meInFlight.current) {
      meInFlight.current = api
        .get('/auth/me')
        .then((res) => {
          const userData = res.data?.user || res.data;
          if (!userData) {
            throw new Error('Invalid /auth/me payload');
          }

          // Debug logs for Fedora Console (F12)
          console.log('🔐 Auth Handshake:', {
            id: userData.id,
            isVerified: userData.isVerified,
            verificationRequestStatus: userData.verificationRequest?.status,
          });

          meCacheRef.current = { user: userData, ts: Date.now() };
          setUser(userData);
          return userData;
        })
        .catch((err) => {
          console.error('Auth sync failed:', err);
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
        if (!cancelled) setLoading(false);
        if (!cancelled) {
          connectSocket(token);
        }
      } else {
        setUser(null);
        if (!cancelled) setLoading(false);
      }
    };

    if (token) {
      run();

      const socket = connectSocket(token);

      // FIX: Ensure socket trigger actually forces a fresh fetch
      socket.on('identity_verified', (payload: any) => {
        console.log('⚡ Real-time Identity Update Signal:', payload);
        fetchMe(true);
      });

      return () => {
        socket.off('identity_verified');
        cancelled = true;
      };
    } else {
      setLoading(false);
    }

    const updateActive = () => setLastActive(Date.now());
    window.addEventListener('mousemove', updateActive);
    window.addEventListener('keydown', updateActive);
    return () => {
      window.removeEventListener('mousemove', updateActive);
      window.removeEventListener('keydown', updateActive);
      cancelled = true;
    };
  }, [fetchMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { token } = res.data;
    const userData = normalizeUserPayload(res.data);
    if (!userData) {
      throw new Error('Invalid /auth/login payload');
    }
    localStorage.setItem('georise_token', token);

    // Clear cache immediately on login to prevent leftovers
    meCacheRef.current = null;
    setUser(userData);
    connectSocket(token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('georise_token');
    localStorage.removeItem('georise_refresh_token');
    setUser(null);
    meCacheRef.current = null;
    disconnectSocket();
    resetSocketGuard();
  }, []);

  const setAuth = useCallback((userData: User, token: string, refreshToken?: string) => {
    localStorage.setItem('georise_token', token);
    if (refreshToken) localStorage.setItem('georise_refresh_token', refreshToken);
    setUser(normalizeUserPayload(userData));
    connectSocket(token);
  }, []);

  const refreshUser = useCallback(async () => {
    // Explicitly pass true to bust the 60s cache
    await fetchMe(true);
  }, [fetchMe]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (user && Date.now() - lastActive > SESSION_MAX_IDLE_MS) {
        logout();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [user, lastActive, SESSION_MAX_IDLE_MS, logout]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setAuth, refreshUser }}>
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
