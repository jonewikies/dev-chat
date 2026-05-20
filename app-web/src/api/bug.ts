import { apiRequest } from './config';

export interface ApiBugStatusHistory {
  id: number;
  bug_id: number;
  from_status?: 'open' | 'in-progress' | 'fixed' | 'closed';
  to_status: 'open' | 'in-progress' | 'fixed' | 'closed';
  note: string;
  changed_by: number;
  created_at: string;
  changed_by_user?: {
    id: number;
    username: string;
    avatar?: string;
  };
}

export interface ApiBug {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'fixed' | 'closed';
  reporter_id: number;
  assignee_id?: number;
  images?: string; // JSON string array of base64 images
  status_note?: string;
  reporter?: {
    id: number;
    username: string;
    avatar?: string;
  };
  assignee?: {
    id: number;
    username: string;
    avatar?: string;
  };
  status_history?: ApiBugStatusHistory[];
  created_at: string;
  updated_at: string;
}

export interface CreateBugData {
  title: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'open' | 'in-progress' | 'fixed' | 'closed';
  assigneeId?: number;
  images?: string;
}

export interface UpdateBugData {
  title?: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'open' | 'in-progress' | 'fixed' | 'closed';
  assigneeId?: number;
  images?: string;
  statusNote?: string;
}

export interface BugListParams {
  status?: string;
  assigneeId?: number;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface BugListResponse {
  items: ApiBug[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const bugApi = {
  list: async (projectId: number, params?: BugListParams): Promise<BugListResponse> => {
    const searchParams = new URLSearchParams();

    if (params?.status) searchParams.set('status', params.status);
    if (params?.assigneeId) searchParams.set('assigneeId', String(params.assigneeId));
    if (params?.q) searchParams.set('q', params.q);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));

    const query = searchParams.toString();
    return apiRequest<BugListResponse>(`/projects/${projectId}/bugs${query ? `?${query}` : ''}`);
  },

  get: async (projectId: number, bugId: number): Promise<ApiBug> => {
    return apiRequest<ApiBug>(`/projects/${projectId}/bugs/${bugId}`);
  },

  create: async (projectId: number, data: CreateBugData): Promise<ApiBug> => {
    return apiRequest<ApiBug>(`/projects/${projectId}/bugs`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (projectId: number, bugId: number, data: UpdateBugData): Promise<ApiBug> => {
    return apiRequest<ApiBug>(`/projects/${projectId}/bugs/${bugId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (projectId: number, bugId: number): Promise<void> => {
    await apiRequest(`/projects/${projectId}/bugs/${bugId}`, {
      method: 'DELETE',
    });
  },
};
