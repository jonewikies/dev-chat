import { apiRequest } from './config';

export interface ApiRepository {
  id: number;
  project_id: number;
  name: string;
  url: string;
  platform: 'gitlab' | 'github' | 'gitea';
  access_token?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiRepositoryDetail {
  repository: ApiRepository;
  integrationStatus: 'configured' | 'missing-token' | 'unsupported' | 'error';
  message?: string;
  summary?: {
    id: number;
    name: string;
    pathWithNamespace: string;
    description?: string;
    webUrl?: string;
    defaultBranch?: string;
    visibility?: string;
    lastActivityAt?: string;
  };
  readme?: {
    fileName: string;
    content: string;
    ref: string;
  };
  branches: Array<{
    name: string;
    merged: boolean;
    protected: boolean;
    default: boolean;
    webUrl?: string;
    lastCommit?: {
      id: string;
      shortId: string;
      title: string;
      authoredDate?: string;
    };
  }>;
  mergeRequests: Array<{
    id: number;
    iid: number;
    title: string;
    state: string;
    webUrl?: string;
    authorName?: string;
    sourceBranch: string;
    targetBranch: string;
    updatedAt?: string;
  }>;
}

export interface CreateRepositoryData {
  name: string;
  url: string;
  platform?: 'gitlab' | 'github' | 'gitea';
  accessToken?: string;
  isActive?: boolean;
}

export interface UpdateRepositoryData {
  name?: string;
  url?: string;
  platform?: 'gitlab' | 'github' | 'gitea';
  accessToken?: string;
  isActive?: boolean;
}

export const repositoryApi = {
  list: async (projectId: number): Promise<ApiRepository[]> => {
    return apiRequest<ApiRepository[]>(`/projects/${projectId}/repositories`);
  },

  getDetail: async (projectId: number, repositoryId: number): Promise<ApiRepositoryDetail> => {
    return apiRequest<ApiRepositoryDetail>(`/projects/${projectId}/repositories/${repositoryId}/details`);
  },

  create: async (projectId: number, data: CreateRepositoryData): Promise<ApiRepository> => {
    return apiRequest<ApiRepository>(`/projects/${projectId}/repositories`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (projectId: number, repositoryId: number, data: UpdateRepositoryData): Promise<ApiRepository> => {
    return apiRequest<ApiRepository>(`/projects/${projectId}/repositories/${repositoryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (projectId: number, repositoryId: number): Promise<void> => {
    await apiRequest(`/projects/${projectId}/repositories/${repositoryId}`, {
      method: 'DELETE',
    });
  },
};
