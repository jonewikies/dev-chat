import { API_BASE_URL, ApiError, apiRequest, getAuthToken } from './config';
import { ApiMessage, PaginationParams } from './types';

export interface SendMessageData {
  content: string;
  type?: 'text' | 'system' | 'ai_summary' | 'file';
  replyToMessageId?: number;
  metadata?: {
    mentions?: Array<{
      userId: number;
      username?: string;
      displayName?: string;
    }>;
  };
}

export const messageApi = {
  async getMessages(
    chatId: number,
    params?: PaginationParams & { before?: number; beforeId?: number; limit?: number }
  ): Promise<{ messages: ApiMessage[] }> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.pageSize) query.append('limit', params.pageSize.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.before !== undefined) query.append('beforeId', params.before.toString());
    if (params?.beforeId !== undefined) query.append('beforeId', params.beforeId.toString());

    const endpoint = `/chats/${chatId}/messages${query.toString() ? `?${query}` : ''}`;
    return apiRequest<{ messages: ApiMessage[] }>(endpoint);
  },

  async sendMessage(chatId: number, data: SendMessageData): Promise<{ message: ApiMessage }> {
    const body = {
      ...data,
      replyToId: data.replyToMessageId,
    };
    return apiRequest<{ message: ApiMessage }>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async forwardMessage(messageId: number, targetChatId: number): Promise<{ message: ApiMessage }> {
    return apiRequest<{ message: ApiMessage }>(`/chats/messages/${messageId}/forward`, {
      method: 'POST',
      body: JSON.stringify({ targetChatId }),
    });
  },

  async uploadAttachment(chatId: number, file: File): Promise<{ message: ApiMessage }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new ApiError(
        response.status,
        payload.error?.code || 'UNKNOWN_ERROR',
        payload.error?.message || '附件上传失败',
        payload.error?.details
      );
    }

    return payload.data;
  },

  async downloadAttachment(fileId: number): Promise<{ blob: Blob; fileName?: string }> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/chats/attachments/${fileId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!response.ok) {
      let errorMessage = '附件下载失败';
      try {
        const payload = await response.json();
        errorMessage = payload.error?.message || errorMessage;
      } catch {
        // Ignore JSON parse failures for binary responses.
      }
      throw new ApiError(response.status, 'DOWNLOAD_FAILED', errorMessage);
    }

    const disposition = response.headers.get('content-disposition') || '';
    const fileNameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const fileName = fileNameMatch ? decodeURIComponent(fileNameMatch[1]) : undefined;
    const blob = await response.blob();
    return { blob, fileName };
  },

  async deleteMessage(messageId: number): Promise<void> {
    await apiRequest(`/chats/messages/${messageId}`, {
      method: 'DELETE',
    });
  },
};
