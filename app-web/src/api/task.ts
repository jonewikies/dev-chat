import { apiRequest } from './config';
import { ApiTask } from './types';

export interface CreateTaskData {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'todo' | 'in-progress' | 'done';
  statusNote?: string;
  assigneeId?: number;
  startDate?: string;
  endDate?: string;
}

export interface TaskListParams {
  status?: string;
  assigneeId?: number;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface TaskListResponse {
  items: ApiTask[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const taskApi = {
  async getTasks(projectId: number, params?: TaskListParams): Promise<TaskListResponse> {
    const searchParams = new URLSearchParams();

    if (params?.status) searchParams.set('status', params.status);
    if (params?.assigneeId) searchParams.set('assigneeId', String(params.assigneeId));
    if (params?.q) searchParams.set('q', params.q);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));

    const query = searchParams.toString();
    return apiRequest<TaskListResponse>(`/projects/${projectId}/tasks${query ? `?${query}` : ''}`);
  },

  async getTask(projectId: number, taskId: number): Promise<ApiTask> {
    return apiRequest<ApiTask>(`/projects/${projectId}/tasks/${taskId}`);
  },

  async createTask(projectId: number, data: CreateTaskData): Promise<ApiTask> {
    return apiRequest<ApiTask>(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateTask(projectId: number, taskId: number, data: Partial<CreateTaskData> & {
    progress?: number;
  }): Promise<ApiTask> {
    return apiRequest<ApiTask>(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteTask(projectId: number, taskId: number): Promise<void> {
    await apiRequest(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'DELETE',
    });
  },
};
