import { apiRequest } from './config';
import { ApiChat } from './types';

export const chatApi = {
  async getChats(): Promise<ApiChat[]> {
    return apiRequest<ApiChat[]>('/chats');
  },

  async getChatDetail(chatId: number): Promise<ApiChat> {
    return apiRequest<ApiChat>(`/chats/${chatId}`);
  },

  async createDirectChat(targetUserId: number): Promise<ApiChat> {
    return apiRequest<ApiChat>('/chats/direct', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  },

  async createGroupChat(data: {
    name: string;
    memberIds: number[];
  }): Promise<ApiChat> {
    return apiRequest<ApiChat>('/chats/group', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateChat(chatId: number, data: {
    name?: string;
    avatarUrl?: string;
  }): Promise<ApiChat> {
    return apiRequest<ApiChat>(`/chats/${chatId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async addMember(chatId: number, userId: number): Promise<void> {
    await apiRequest(`/chats/${chatId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  async leaveChat(chatId: number): Promise<void> {
    await apiRequest(`/chats/${chatId}/leave`, {
      method: 'POST',
    });
  },

  async deleteDirectChat(chatId: number): Promise<void> {
    await apiRequest(`/chats/${chatId}`, {
      method: 'DELETE',
    });
  },

  async removeMember(chatId: number, userId: number): Promise<void> {
    await apiRequest(`/chats/${chatId}/members/${userId}`, {
      method: 'DELETE',
    });
  },

  async markAsRead(chatId: number, messageId: number): Promise<void> {
    await apiRequest(`/chats/${chatId}/read`, {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    });
  },
};
