// API响应类型定义，对应后端类型
export interface ApiUser {
  id: number;
  username: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  is_super_admin: boolean;
  is_online: boolean;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiAuthResponse {
  user: ApiUser;
  token: string;
}

export interface ApiChatMember {
  user_id: number;
  role: 'admin' | 'member';
  unread_count: number;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface ApiChat {
  id: number;
  name?: string;
  type: 'direct' | 'group' | 'project';
  avatar_url?: string;
  last_message?: string | null;
  last_message_sender_name?: string | null;
  last_message_time?: string | null;
  project_id?: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  members?: ApiChatMember[];
}

export interface ApiMessage {
  id: number;
  chat_id: number;
  sender_id: number;
  content: string;
  type: 'text' | 'system' | 'ai_summary' | 'file';
  metadata?: {
    fileId?: number;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    downloadUrl?: string;
    mentions?: Array<{
      userId: number;
      username: string;
      displayName?: string;
    }>;
  } | any;
  reply_to_message_id?: number;
  created_at: string;
  updated_at: string;
}

export interface ApiProject {
  id: number;
  name: string;
  description?: string;
  goal?: string;
  content?: string;
  timeline?: string;
  milestone?: string;
  status: 'active' | 'completed' | 'on-hold';
  creator_id: number;
  owner_id: number;
  created_at: string;
  updated_at: string;
}

export interface ApiTask {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'done';
  status_note?: string;
  status_history?: Array<{
    id: number;
    task_id: number;
    from_status?: 'todo' | 'in-progress' | 'done';
    to_status: 'todo' | 'in-progress' | 'done';
    note: string;
    changed_by: number;
    created_at: string;
    changed_by_user?: {
      id: number;
      username: string;
      avatar?: string;
    };
  }>;
  priority: 'low' | 'medium' | 'high';
  progress: number;
  assignee_id?: number;
  assignee?: {
    id: number;
    username: string;
    avatar?: string;
  };
  start_date?: string;
  end_date?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
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
  status_note?: string;
  status_history?: Array<{
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
  }>;
  created_at: string;
  updated_at: string;
}

export interface ApiDocument {
  id: number;
  project_id: number;
  title: string;
  content?: string;
  format?: 'markdown' | 'richtext';
  type: import('../constants/document').DocumentType;
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

export interface ApiProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: 'owner' | 'member' | 'viewer';
  joined_at: string;
}

export interface ApiFriendship {
  id: number;
  user_id: number;
  friend_id: number;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  updated_at: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total?: number;
    totalPages?: number;
  };
}

export interface ApiAdminUserListResponse {
  users: ApiUser[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiAdminBatchCreateResponse {
  created: ApiUser[];
  failed: Array<{
    username: string;
    reason: string;
  }>;
  summary: {
    requested: number;
    created: number;
    failed: number;
  };
}
