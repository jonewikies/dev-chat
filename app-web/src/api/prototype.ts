import { API_BASE_URL, ApiError, getAuthToken, apiRequest } from './config';

export interface ApiProjectPrototype {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  archive_file_name: string;
  archive_file_path: string;
  archive_size: number;
  extracted_dir: string;
  entry_file: string;
  preview_key: string;
  preview_url: string;
  uploader_id: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePrototypeData {
  name: string;
  description?: string;
  archive: File;
}

export interface UpdatePrototypeData {
  name?: string;
  description?: string;
  archive?: File;
}

async function multipartRequest<T>(endpoint: string, method: 'POST' | 'PUT', data: CreatePrototypeData | UpdatePrototypeData): Promise<T> {
  const formData = new FormData();
  if (data.name !== undefined) {
    formData.append('name', data.name);
  }
  if (data.description !== undefined) {
    formData.append('description', data.description);
  }
  if ('archive' in data && data.archive) {
    formData.append('archive', data.archive);
  }

  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.error?.code || 'UNKNOWN_ERROR',
      payload.error?.message || 'An error occurred',
      payload.error?.details
    );
  }

  return payload.data;
}

export const prototypeApi = {
  list: async (projectId: number): Promise<ApiProjectPrototype[]> => {
    return apiRequest<ApiProjectPrototype[]>(`/projects/${projectId}/prototypes`);
  },

  get: async (projectId: number, prototypeId: number): Promise<ApiProjectPrototype> => {
    return apiRequest<ApiProjectPrototype>(`/projects/${projectId}/prototypes/${prototypeId}`);
  },

  create: async (projectId: number, data: CreatePrototypeData): Promise<ApiProjectPrototype> => {
    return multipartRequest<ApiProjectPrototype>(`/projects/${projectId}/prototypes`, 'POST', data);
  },

  update: async (projectId: number, prototypeId: number, data: UpdatePrototypeData): Promise<ApiProjectPrototype> => {
    return multipartRequest<ApiProjectPrototype>(`/projects/${projectId}/prototypes/${prototypeId}`, 'PUT', data);
  },

  delete: async (projectId: number, prototypeId: number): Promise<void> => {
    await apiRequest(`/projects/${projectId}/prototypes/${prototypeId}`, {
      method: 'DELETE',
    });
  },
};