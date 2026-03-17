import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { ApiUser, LoginResponse } from '@/types/api';

interface AuthContextType {
  user: ApiUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('auth_user');
    if (stored && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as ApiUser;
        setToken(stored);
        setUser(parsedUser);
        connectSocket(stored);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('auth_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
    localStorage.setItem('access_token', data.accessToken);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    setToken(data.accessToken);
    setUser(data.user);
    connectSocket(data.accessToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
