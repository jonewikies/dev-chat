import { apiRequest } from './config';
import { ApiChat, ApiProject, ApiProjectMember, PaginationParams } from './types';
import type { DocumentType } from '../constants/document';

export interface ApiProjectAISummary {
  id: number;
  chat_id: number;
  analysis_type: 'summary';
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  archive_document_id?: number;
  archive_document_title?: string;
  archive_document_type?: DocumentType;
  archive_document_kept?: boolean;
  proposal_count: number;
  overview?: string;
  error_message?: string;
  can_retry?: boolean;
  summary_source?: 'gemini' | 'local';
  summary_trigger_mode?: 'manual' | 'auto';
}

export interface ApiProjectAIProposal {
  id: number;
  project_id: number;
  chat_id: number;
  ai_analysis_id: number;
  target_type: 'project' | 'task' | 'bug' | 'document';
  action: 'create' | 'update';
  target_id?: number;
  title: string;
  summary?: string;
  payload: string;
  reason?: string;
  source_message_ids?: string;
  confidence?: number;
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'failed';
  reviewer_id?: number;
  reviewer_comment?: string;
  reviewed_at?: string;
  applied_at?: string;
  created_at: string;
  updated_at: string;
  reviewer?: {
    id: number;
    username: string;
    avatar?: string;
  };
}

export interface ApiProjectAIProposalDetail extends Omit<ApiProjectAIProposal, 'payload' | 'source_message_ids'> {
  payload: Record<string, any> | string;
  original_title?: string;
  original_summary?: string;
  original_payload?: Record<string, any> | string;
  original_reason?: string;
  source_message_ids: number[];
  source_messages_preview: Array<{
    id: number;
    sender_id: number;
    content: string;
    created_at: string;
  }>;
}

export interface KeepAIProposalData {
  title?: string;
  summary?: string;
  reason?: string;
  payload?: Record<string, any>;
  reviewerComment?: string;
}

export interface CreateAISummaryData {
  chatId: number;
  messageLimit?: number;
  beforeMessageId?: number;
  startMessageId?: number;
  endMessageId?: number;
  startTime?: string;
  endTime?: string;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  goal?: string;
  content?: string;
  timeline?: string;
  milestone?: string;
  ownerId?: number;
}

export const projectApi = {
  async getProjects(params?: PaginationParams): Promise<ApiProject[]> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString());

    return apiRequest<ApiProject[]>(`/projects${query.toString() ? `?${query}` : ''}`);
  },

  async getProjectDetail(projectId: number): Promise<ApiProject> {
    return apiRequest<ApiProject>(`/projects/${projectId}`);
  },

  async createProject(data: CreateProjectData): Promise<ApiProject> {
    return apiRequest<ApiProject>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProject(projectId: number, data: Partial<CreateProjectData> & {
    status?: 'active' | 'completed' | 'on-hold';
  }): Promise<ApiProject> {
    return apiRequest<ApiProject>(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteProject(projectId: number): Promise<void> {
    await apiRequest(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  },

  async getMembers(projectId: number): Promise<ApiProjectMember[]> {
    return apiRequest<ApiProjectMember[]>(`/projects/${projectId}/members`);
  },

  async openProjectChat(projectId: number): Promise<ApiChat> {
    return apiRequest<ApiChat>(`/projects/${projectId}/chat/open`, {
      method: 'POST',
    });
  },

  async addMember(projectId: number, userId: number, role: 'member' | 'viewer' = 'member'): Promise<ApiProjectMember> {
    return apiRequest<ApiProjectMember>(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
  },

  async updateMemberRole(projectId: number, memberId: number, role: 'owner' | 'member' | 'viewer'): Promise<ApiProjectMember> {
    return apiRequest<ApiProjectMember>(`/projects/${projectId}/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  async removeMember(projectId: number, memberId: number): Promise<void> {
    await apiRequest(`/projects/${projectId}/members/${memberId}`, {
      method: 'DELETE',
    });
  },

  async searchProjects(query: string): Promise<ApiProject[]> {
    return apiRequest<ApiProject[]>(`/projects/search?q=${encodeURIComponent(query)}`);
  },

  async getAISummaries(projectId: number): Promise<ApiProjectAISummary[]> {
    return apiRequest<ApiProjectAISummary[]>(`/projects/${projectId}/ai/summaries`);
  },

  async createAISummary(projectId: number, data: CreateAISummaryData): Promise<{
    analysisId: number;
    archiveDocumentId?: number;
    archiveDocumentTitle?: string;
    proposalCount: number;
    overview: string;
  }> {
    return apiRequest(`/projects/${projectId}/ai/summaries`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async retryAISummary(projectId: number, analysisId: number): Promise<{
    analysisId: number;
    archiveDocumentId?: number;
    archiveDocumentTitle?: string;
    proposalCount: number;
    overview: string;
  }> {
    return apiRequest(`/projects/${projectId}/ai/summaries/${analysisId}/retry`, {
      method: 'POST',
    });
  },

  async keepAISummary(projectId: number, analysisId: number): Promise<{
    analysisId: number;
    archiveDocumentId: number;
    archiveDocumentTitle?: string;
  }> {
    return apiRequest(`/projects/${projectId}/ai/summaries/${analysisId}/keep`, {
      method: 'POST',
    });
  },

  async getAIProposals(projectId: number, params?: {
    status?: 'pending' | 'approved' | 'rejected' | 'applied' | 'failed';
  }): Promise<ApiProjectAIProposal[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString();
    return apiRequest<ApiProjectAIProposal[]>(`/projects/${projectId}/ai/proposals${query ? `?${query}` : ''}`);
  },

  async getAIProposalDetail(projectId: number, proposalId: number): Promise<ApiProjectAIProposalDetail> {
    return apiRequest<ApiProjectAIProposalDetail>(`/projects/${projectId}/ai/proposals/${proposalId}`);
  },

  async keepAIProposal(projectId: number, proposalId: number, data?: KeepAIProposalData): Promise<{
    proposalId: number;
    status: string;
    appliedTargetType?: string;
    appliedTargetId?: number;
  }> {
    return apiRequest(`/projects/${projectId}/ai/proposals/${proposalId}/keep`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  async undoAIProposal(projectId: number, proposalId: number): Promise<{
    proposalId: number;
    status: string;
  }> {
    return apiRequest(`/projects/${projectId}/ai/proposals/${proposalId}/undo`, {
      method: 'POST',
    });
  },
};
