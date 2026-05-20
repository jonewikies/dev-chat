import { apiRequest } from './config';
import { ApiAuthResponse, ApiUser } from './types';

export interface RegisterData {
  username: string;
  password: string;
  email?: string;
  displayName?: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export const authApi = {
  async register(data: RegisterData): Promise<ApiAuthResponse> {
    const response = await apiRequest<ApiAuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: data.username,
        password: data.password,
        email: data.email,
        displayName: data.displayName,
      }),
    });
    
    // 保存token
    localStorage.setItem('auth_token', response.token);
    return response;
  },

  async login(data: LoginData): Promise<ApiAuthResponse> {
    const response = await apiRequest<ApiAuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    // 保存token
    localStorage.setItem('auth_token', response.token);
    return response;
  },

  async logout(): Promise<void> {
    await apiRequest('/auth/logout', {
      method: 'POST',
    });
    
    // 清除token
    localStorage.removeItem('auth_token');
  },

  async refreshToken(): Promise<{ token: string }> {
    const response = await apiRequest<{ token: string }>('/auth/refresh', {
      method: 'POST',
    });
    
    // 更新token
    localStorage.setItem('auth_token', response.token);
    return response;
  },

  async getCurrentUser(): Promise<ApiUser> {
    return apiRequest<ApiUser>('/users/me');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('auth_token');
  },
};
