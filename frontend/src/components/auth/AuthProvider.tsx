'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import auth from '@/lib/auth';
import { User, LoginCredentials, AuthContextType } from '@/types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const initAuth = async () => {
      if (auth.isAuthenticated()) {
        try {
          const userData = await auth.getCurrentUser();
          setUser(userData);
        } catch (error) {
          // Token invalid, clear it
          await auth.logout();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      await auth.login(credentials);
      const userData = await auth.getCurrentUser();
      setUser(userData);
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await auth.logout();
      setUser(null);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await auth.getCurrentUser();
      setUser(userData);
    } catch (error) {
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
