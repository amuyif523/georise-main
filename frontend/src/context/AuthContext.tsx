/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";

type Role = "CITIZEN" | "AGENCY_STAFF" | "ADMIN";

interface User {
  id: number;
  fullName: string;
  email: string;
  role: Role;
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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastActive, setLastActive] = useState<number>(() => Date.now());
  const SESSION_MAX_IDLE_MS = 30 * 60 * 1000; // 30 minutes

  const fetchMe = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("georise_token");
    if (token) {
      (async () => {
        await fetchMe();
        connectSocket(token);
      })();
    } else {
      setLoading(false);
    }

    const updateActive = () => setLastActive(Date.now());
    window.addEventListener("mousemove", updateActive);
    window.addEventListener("keydown", updateActive);
    return () => {
      window.removeEventListener("mousemove", updateActive);
      window.removeEventListener("keydown", updateActive);
    };
  }, [SESSION_MAX_IDLE_MS, fetchMe]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (user && Date.now() - lastActive > SESSION_MAX_IDLE_MS) {
        logout();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [user, lastActive, SESSION_MAX_IDLE_MS]);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    const { token, user: userData } = res.data;
    localStorage.setItem("georise_token", token);
    setUser(userData);
    connectSocket(token);
  };

  const logout = () => {
    localStorage.removeItem("georise_token");
    setUser(null);
    disconnectSocket();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

