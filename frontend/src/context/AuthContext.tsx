import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { socket } from '@/lib/socket';

export type UserRole = 'admin' | 'complainant' | 'committee_member' | 'manager';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  department?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const isInitialMount = useRef(true);

  useEffect(() => {
    const initAuth = async () => {
      if (token && !user) {
        try {
          const userData = await apiFetch<User>('/auth/profile');
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (error) {
          console.error('Failed to verify session:', error);
          logout();
        }
      }
      
      if (isInitialMount.current) {
        setIsLoading(false);
        isInitialMount.current = false;
      }
    };
    
    initAuth();
  }, [token]);

  useEffect(() => {
    if (token) {
      socket.connect();
      return () => {
        socket.disconnect();
      };
    }
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setIsLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsLoading(false);
    socket.disconnect();
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
