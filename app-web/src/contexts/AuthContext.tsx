import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, ApiUser } from '../api';
import { wsService } from '../services/websocket';
import { notificationService } from '../services/notification';

interface AuthContextType {
  user: ApiUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentUser: (user: ApiUser | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // 检查是否已登录
    let isMounted = true;
    let isCheckingAuth = false;
    
    const checkAuth = async () => {
      // 防止并发调用
      if (isCheckingAuth) {
        console.log('[AuthContext] Already checking auth, skipping...');
        return;
      }
      isCheckingAuth = true;
      
      console.log('[AuthContext] Checking authentication...');
      
      try {
        if (authApi.isAuthenticated()) {
          console.log('[AuthContext] Token found, fetching user...');
          const currentUser = await authApi.getCurrentUser();
          const authToken = localStorage.getItem('auth_token');
          
          if (isMounted) {
            console.log('[AuthContext] User loaded:', currentUser.username);
            setUser(currentUser);
            setToken(authToken);
            
            // 连接 WebSocket
            if (authToken) {
              console.log('[AuthContext] Connecting WebSocket...');
              wsService.connect(authToken);
            }
            
            // 请求通知权限
            notificationService.requestPermission().then((permission) => {
              console.log('[AuthContext] Notification permission:', permission);
            });
            notificationService.setCurrentUserId(currentUser.id);
          }
        } else {
          console.log('[AuthContext] No token found');
        }
      } catch (error) {
        console.error('[AuthContext] Failed to get current user:', error);
        if (isMounted) {
          localStorage.removeItem('auth_token');
          setUser(null);
          setToken(null);
          notificationService.setCurrentUserId(null);
          wsService.disconnect();
        }
      } finally {
        if (isMounted) {
          console.log('[AuthContext] Setting isLoading to false');
          setIsLoading(false);
        }
        isCheckingAuth = false;
      }
    };

    checkAuth();
    
    return () => {
      console.log('[AuthContext] Cleanup - component unmounting');
      isMounted = false;
      wsService.disconnect();
    };
  }, []);

  const login = async (username: string, password: string) => {
    const response = await authApi.login({ username, password });
    const authToken = localStorage.getItem('auth_token');
    setUser(response.user);
    setToken(authToken);
    
    // 连接 WebSocket
    if (authToken) {
      console.log('[AuthContext] Connecting WebSocket after login...');
      wsService.connect(authToken);
    }
    
    // 请求通知权限
    notificationService.requestPermission().then((permission) => {
      console.log('[AuthContext] Notification permission:', permission);
    });
    notificationService.setCurrentUserId(response.user.id);
  };

  const register = async (
    username: string,
    password: string,
    email?: string,
    displayName?: string
  ) => {
    const response = await authApi.register({
      username,
      password,
      email,
      displayName,
    });
    const authToken = localStorage.getItem('auth_token');
    setUser(response.user);
    setToken(authToken);
    
    // 连接 WebSocket
    if (authToken) {
      console.log('[AuthContext] Connecting WebSocket after register...');
      wsService.connect(authToken);
    }
    
    // 请求通知权限
    notificationService.requestPermission().then((permission) => {
      console.log('[AuthContext] Notification permission:', permission);
    });
    notificationService.setCurrentUserId(response.user.id);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    setToken(null);
    notificationService.setCurrentUserId(null);
    wsService.disconnect();
  };

  const refreshUser = async () => {
    if (!authApi.isAuthenticated()) {
      setUser(null);
      setToken(null);
      notificationService.setCurrentUserId(null);
      return;
    }

    const currentUser = await authApi.getCurrentUser();
    setUser(currentUser);
    notificationService.setCurrentUserId(currentUser.id);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    token,
    login,
    register,
    logout,
    setCurrentUser: setUser,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
