import axios from 'axios';
import { ValidationError } from '../utils/error.util';
import { Repository } from '../types/db.types';

export interface GitLabBranchSummary {
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
}

export interface GitLabMergeRequestSummary {
  id: number;
  iid: number;
  title: string;
  state: string;
  webUrl?: string;
  authorName?: string;
  sourceBranch: string;
  targetBranch: string;
  updatedAt?: string;
}

export interface GitLabReadmeSummary {
  fileName: string;
  content: string;
  ref: string;
}

export interface RepositoryDetailPayload {
  repository: Repository;
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
  readme?: GitLabReadmeSummary;
  branches: GitLabBranchSummary[];
  mergeRequests: GitLabMergeRequestSummary[];
}

interface GitLabProjectResponse {
  id: number;
  name: string;
  path_with_namespace: string;
  description?: string;
  web_url?: string;
  default_branch?: string;
  visibility?: string;
  last_activity_at?: string;
}

interface GitLabBranchResponse {
  name: string;
  merged: boolean;
  protected: boolean;
  default: boolean;
  web_url?: string;
  commit?: {
    id: string;
    short_id: string;
    title: string;
    authored_date?: string;
  };
}

interface GitLabMergeRequestResponse {
  id: number;
  iid: number;
  title: string;
  state: string;
  web_url?: string;
  source_branch: string;
  target_branch: string;
  updated_at?: string;
  author?: {
    name?: string;
  };
}

interface GitLabTreeEntryResponse {
  name: string;
  type: string;
}

export class GitLabService {
  private buildApiBase(repositoryUrl: string): { apiBaseUrl: string; projectPath: string } {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(repositoryUrl);
    } catch {
      throw new ValidationError('GitLab 仓库 URL 格式不正确');
    }

    const projectPath = parsedUrl.pathname.replace(/^\//, '').replace(/\.git$/, '');
    if (!projectPath) {
      throw new ValidationError('GitLab 仓库 URL 缺少项目路径');
    }

    return {
      apiBaseUrl: `${parsedUrl.origin}/api/v4`,
      projectPath,
    };
  }

  private getHeaders(accessToken: string) {
    return {
      'PRIVATE-TOKEN': accessToken,
    };
  }

  private getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const responseMessage = (error.response?.data as { message?: string } | undefined)?.message;
      if (typeof responseMessage === 'string' && responseMessage.trim()) {
        return responseMessage;
      }
      if (error.response?.status === 401) {
        return 'GitLab 访问令牌无效或已过期';
      }
      if (error.response?.status === 404) {
        return 'GitLab 仓库不存在或当前令牌无权访问';
      }
      return error.message;
    }

    return error instanceof Error ? error.message : '获取 GitLab 仓库详情失败';
  }

  private async fetchReadme(apiBaseUrl: string, projectId: number, defaultBranch: string, accessToken: string): Promise<GitLabReadmeSummary | undefined> {
    const treeResponse = await axios.get<GitLabTreeEntryResponse[]>(
      `${apiBaseUrl}/projects/${projectId}/repository/tree`,
      {
        params: {
          path: '',
          per_page: 100,
          ref: defaultBranch,
        },
        headers: this.getHeaders(accessToken),
      }
    );

    const readmeFile = treeResponse.data.find((entry) => entry.type === 'blob' && /^readme(\..+)?$/i.test(entry.name));
    if (!readmeFile) {
      return undefined;
    }

    const readmeResponse = await axios.get<string>(
      `${apiBaseUrl}/projects/${projectId}/repository/files/${encodeURIComponent(readmeFile.name)}/raw`,
      {
        params: {
          ref: defaultBranch,
        },
        headers: this.getHeaders(accessToken),
        responseType: 'text',
      }
    );

    return {
      fileName: readmeFile.name,
      content: readmeResponse.data,
      ref: defaultBranch,
    };
  }

  async getRepositoryDetail(repository: Repository): Promise<RepositoryDetailPayload> {
    if (repository.platform !== 'gitlab') {
      return {
        repository,
        integrationStatus: 'unsupported',
        message: '当前仅支持 GitLab 仓库详情展示',
        branches: [],
        mergeRequests: [],
      };
    }

    if (!repository.access_token) {
      return {
        repository,
        integrationStatus: 'missing-token',
        message: '请先配置 GitLab 访问令牌后再查看仓库详情',
        branches: [],
        mergeRequests: [],
      };
    }

    try {
      const { apiBaseUrl, projectPath } = this.buildApiBase(repository.url);
      const projectResponse = await axios.get<GitLabProjectResponse>(
        `${apiBaseUrl}/projects/${encodeURIComponent(projectPath)}`,
        {
          headers: this.getHeaders(repository.access_token),
        }
      );

      const project = projectResponse.data;
      const defaultBranch = project.default_branch || 'main';

      const [branchesResponse, mergeRequestsResponse, readme] = await Promise.all([
        axios.get<GitLabBranchResponse[]>(`${apiBaseUrl}/projects/${project.id}/repository/branches`, {
          params: { per_page: 20 },
          headers: this.getHeaders(repository.access_token),
        }),
        axios.get<GitLabMergeRequestResponse[]>(`${apiBaseUrl}/projects/${project.id}/merge_requests`, {
          params: {
            state: 'opened',
            per_page: 20,
            order_by: 'updated_at',
            sort: 'desc',
          },
          headers: this.getHeaders(repository.access_token),
        }),
        this.fetchReadme(apiBaseUrl, project.id, defaultBranch, repository.access_token).catch(() => undefined),
      ]);

      return {
        repository,
        integrationStatus: 'configured',
        summary: {
          id: project.id,
          name: project.name,
          pathWithNamespace: project.path_with_namespace,
          description: project.description,
          webUrl: project.web_url,
          defaultBranch: project.default_branch,
          visibility: project.visibility,
          lastActivityAt: project.last_activity_at,
        },
        readme,
        branches: branchesResponse.data.map((branch) => ({
          name: branch.name,
          merged: branch.merged,
          protected: branch.protected,
          default: branch.default,
          webUrl: branch.web_url,
          lastCommit: branch.commit
            ? {
                id: branch.commit.id,
                shortId: branch.commit.short_id,
                title: branch.commit.title,
                authoredDate: branch.commit.authored_date,
              }
            : undefined,
        })),
        mergeRequests: mergeRequestsResponse.data.map((mergeRequest) => ({
          id: mergeRequest.id,
          iid: mergeRequest.iid,
          title: mergeRequest.title,
          state: mergeRequest.state,
          webUrl: mergeRequest.web_url,
          authorName: mergeRequest.author?.name,
          sourceBranch: mergeRequest.source_branch,
          targetBranch: mergeRequest.target_branch,
          updatedAt: mergeRequest.updated_at,
        })),
      };
    } catch (error) {
      return {
        repository,
        integrationStatus: 'error',
        message: this.getErrorMessage(error),
        branches: [],
        mergeRequests: [],
      };
    }
  }
}