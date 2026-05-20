// 数据库模型类型定义
export interface User {
  id: number;
  username: string;
  password_hash: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  is_super_admin: boolean;
  is_online: boolean;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: number;
  user_id: number;
  friend_id: number;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: number;
  name?: string;
  type: 'direct' | 'group' | 'project';
  avatar_url?: string;
  project_id?: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMember {
  id: number;
  chat_id: number;
  user_id: number;
  role: 'admin' | 'member';
  unread_count: number;
  last_read_message_id?: number;
  joined_at: string;
}

export interface Message {
  id: number;
  chat_id: number;
  sender_id: number;
  content: string;
  type: 'text' | 'system' | 'ai_summary' | 'file';
  metadata?: string; // JSON string
  reply_to_message_id?: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
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

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: 'owner' | 'member' | 'viewer';
  joined_at: string;
}

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'done';
  status_note?: string;
  priority: 'low' | 'medium' | 'high';
  progress: number;
  assignee_id?: number;
  start_date?: string;
  end_date?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface TaskStatusHistory {
  id: number;
  task_id: number;
  from_status?: 'todo' | 'in-progress' | 'done';
  to_status: 'todo' | 'in-progress' | 'done';
  note: string;
  changed_by: number;
  created_at: string;
}

export interface TaskStatusHistoryWithUser extends TaskStatusHistory {
  changed_by_user?: {
    id: number;
    username: string;
    avatar?: string;
  };
}

export interface TaskWithAssignee extends Task {
  assignee?: {
    id: number;
    username: string;
    avatar?: string;
  };
  status_history?: TaskStatusHistoryWithUser[];
}

export interface Bug {
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
  created_at: string;
  updated_at: string;
}

export interface BugStatusHistory {
  id: number;
  bug_id: number;
  from_status?: 'open' | 'in-progress' | 'fixed' | 'closed';
  to_status: 'open' | 'in-progress' | 'fixed' | 'closed';
  note: string;
  changed_by: number;
  created_at: string;
}

export interface BugStatusHistoryWithUser extends BugStatusHistory {
  changed_by_user?: {
    id: number;
    username: string;
    avatar?: string;
  };
}

export interface BugWithUsers extends Bug {
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
  status_history?: BugStatusHistoryWithUser[];
}

export interface Document {
  id: number;
  project_id: number;
  title: string;
  content?: string;
  format?: 'markdown' | 'richtext';
  type: import('../constants/document').DocumentType;
  author_id: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentWithAuthor extends Document {
  author?: {
    id: number;
    username: string;
    avatar?: string;
  };
  activity_history?: DocumentActivityWithUser[];
}

export interface DocumentActivity {
  id: number;
  document_id: number;
  project_id: number;
  activity_type: 'created' | 'updated' | 'commented' | 'comment_deleted';
  note: string;
  changed_by: number;
  related_comment_id?: number;
  created_at: string;
}

export interface DocumentActivityWithUser extends DocumentActivity {
  changed_by_user?: {
    id: number;
    username: string;
    avatar?: string;
  };
}

export interface DocumentComment {
  id: number;
  document_id: number;
  project_id: number;
  content: string;
  author_id: number;
  created_at: string;
}

export interface DocumentCommentWithAuthor extends DocumentComment {
  author?: {
    id: number;
    username: string;
    avatar?: string;
  };
}

export interface Repository {
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

export interface ProjectPrototype {
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
  uploader_id: number;
  created_at: string;
  updated_at: string;
}

export interface File {
  id: number;
  uploader_id: number;
  original_name: string;
  stored_name: string;
  file_path: string;
  mime_type?: string;
  file_size?: number;
  related_type: 'message' | 'document' | 'avatar';
  related_id?: number;
  created_at: string;
}

export interface AIAnalysis {
  id: number;
  chat_id: number;
  analysis_type: 'task' | 'bug' | 'document' | 'summary';
  result: string; // JSON object
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

export interface AIAnalysisMessage {
  id: number;
  analysis_id: number;
  message_id: number;
  created_at: string;
}

export interface AIAnalysisWithMessages extends AIAnalysis {
  message_ids?: number[];
}

export interface ProjectChangeProposal {
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
  original_title?: string;
  original_summary?: string;
  original_payload?: string;
  original_reason?: string;
  source_message_ids?: string;
  confidence?: number;
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'failed';
  reviewer_id?: number;
  reviewer_comment?: string;
  reviewed_at?: string;
  applied_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectChangeProposalWithReviewer extends ProjectChangeProposal {
  reviewer?: {
    id: number;
    username: string;
    avatar?: string;
  };
}
