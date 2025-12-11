'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, logout as apiLogout, getCurrentUser } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'HOLDING' | 'BANK' | 'CLIENT';
  department?: string;
  company?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 페이지 로드 시 토큰이 있으면 사용자 정보 가져오기
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await getCurrentUser();
          setUser(response.data);
        } catch (error) {
          console.error('사용자 정보 로드 실패:', error);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    setUser(response.data.user);
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
