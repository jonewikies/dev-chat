import { apiRequest } from './config';
import { ApiUser, ApiFriendship, PaginationParams, ApiAdminUserListResponse, ApiAdminBatchCreateResponse } from './types';

export const userApi = {
  async getUser(userId: number): Promise<ApiUser> {
    return apiRequest<ApiUser>(`/users/${userId}`);
  },

  async updateUser(data: {
    displayName?: string;
    email?: string;
    avatarUrl?: string;
  }): Promise<ApiUser> {
    return apiRequest<ApiUser>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    await apiRequest('/users/me/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async searchUsers(query: string, params?: PaginationParams): Promise<ApiUser[]> {
    const queryParams = new URLSearchParams({ q: query });
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());

    return apiRequest<ApiUser[]>(`/users?${queryParams}`);
  },

  async getFriends(): Promise<ApiFriendship[]> {
    return apiRequest<ApiFriendship[]>('/users/me/friends');
  },

  async sendFriendRequest(userId: number): Promise<ApiFriendship> {
    return apiRequest<ApiFriendship>('/users/me/friends', {
      method: 'POST',
      body: JSON.stringify({ friendId: userId }),
    });
  },

  async acceptFriendRequest(friendshipId: number): Promise<void> {
    await apiRequest(`/users/me/friends/${friendshipId}`, {
      method: 'PUT',
      body: JSON.stringify({ action: 'accept' }),
    });
  },

  async deleteFriend(friendshipId: number): Promise<void> {
    await apiRequest(`/users/me/friends/${friendshipId}`, {
      method: 'DELETE',
    });
  },

  async adminListUsers(query?: string, params?: PaginationParams): Promise<ApiAdminUserListResponse> {
    const queryParams = new URLSearchParams();
    if (query) queryParams.append('q', query);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());

    const suffix = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return apiRequest<ApiAdminUserListResponse>(`/users/admin/users${suffix}`);
  },

  async adminCreateUser(data: {
    username: string;
    password: string;
    email?: string;
    displayName?: string;
    isSuperAdmin?: boolean;
  }): Promise<ApiUser> {
    return apiRequest<ApiUser>('/users/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async adminBatchCreateUsers(data: {
    users: Array<{
      username: string;
      password?: string;
      email?: string;
      displayName?: string;
      isSuperAdmin?: boolean;
    }>;
    defaultPassword?: string;
  }): Promise<ApiAdminBatchCreateResponse> {
    return apiRequest<ApiAdminBatchCreateResponse>('/users/admin/users/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async adminResetPassword(userId: number, newPassword: string): Promise<void> {
    await apiRequest(`/users/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  },
};
