import { apiRequest } from './config';
import type { DocumentType } from '../constants/document';

export interface ApiDocument {
  id: number;
  project_id: number;
  title: string;
  content?: string;
  format?: 'markdown' | 'richtext';
  type: DocumentType;
  author_id: number;
  author?: {
    id: number;
    username: string;
    avatar?: string;
  };
  activity_history?: Array<{
    id: number;
    document_id: number;
    project_id: number;
    activity_type: 'created' | 'updated' | 'commented' | 'comment_deleted';
    note: string;
    changed_by: number;
    related_comment_id?: number;
    created_at: string;
    changed_by_user?: {
      id: number;
      username: string;
      avatar?: string;
    };
  }>;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentData {
  title: string;
  content?: string;
  format?: 'markdown' | 'richtext';
  type?: DocumentType;
}

export interface UpdateDocumentData {
  title?: string;
  content?: string;
  format?: 'markdown' | 'richtext';
  type?: DocumentType;
}

export interface ApiDocumentComment {
  id: number;
  document_id: number;
  project_id: number;
  content: string;
  author_id: number;
  author?: {
    id: number;
    username: string;
    avatar?: string;
  };
  created_at: string;
}

export interface DocumentListParams {
  type?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface DocumentListResponse {
  items: ApiDocument[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const documentApi = {
  list: async (projectId: number, params?: DocumentListParams): Promise<DocumentListResponse> => {
    const searchParams = new URLSearchParams();

    if (params?.type) searchParams.set('type', params.type);
    if (params?.q) searchParams.set('q', params.q);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));

    const query = searchParams.toString();
    return apiRequest<DocumentListResponse>(`/projects/${projectId}/documents${query ? `?${query}` : ''}`);
  },

  get: async (projectId: number, documentId: number): Promise<ApiDocument> => {
    return apiRequest<ApiDocument>(`/projects/${projectId}/documents/${documentId}`);
  },

  create: async (projectId: number, data: CreateDocumentData): Promise<ApiDocument> => {
    return apiRequest<ApiDocument>(`/projects/${projectId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (projectId: number, documentId: number, data: UpdateDocumentData): Promise<ApiDocument> => {
    return apiRequest<ApiDocument>(`/projects/${projectId}/documents/${documentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (projectId: number, documentId: number): Promise<void> => {
    await apiRequest(`/projects/${projectId}/documents/${documentId}`, {
      method: 'DELETE',
    });
  },

  listComments: async (projectId: number, documentId: number): Promise<ApiDocumentComment[]> => {
    return apiRequest<ApiDocumentComment[]>(`/projects/${projectId}/documents/${documentId}/comments`);
  },

  createComment: async (projectId: number, documentId: number, content: string): Promise<ApiDocumentComment> => {
    return apiRequest<ApiDocumentComment>(`/projects/${projectId}/documents/${documentId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  deleteComment: async (projectId: number, documentId: number, commentId: number): Promise<void> => {
    await apiRequest(`/projects/${projectId}/documents/${documentId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  },
};
