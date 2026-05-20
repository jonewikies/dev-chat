-- DevChat 数据库Schema
-- SQLite 3

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  display_name VARCHAR(100),
  avatar_url VARCHAR(500),
  is_super_admin BOOLEAN DEFAULT 0,
  is_online BOOLEAN DEFAULT 0,
  last_seen_at DATETIME,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  updated_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON users(is_super_admin);
CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online);

-- 2. 好友关系表
CREATE TABLE IF NOT EXISTS friendships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  status TEXT CHECK(status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  updated_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- 3. 项目表
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  goal TEXT,
  content TEXT,
  timeline VARCHAR(100),
  status TEXT CHECK(status IN ('active', 'completed', 'on-hold')) DEFAULT 'active',
  creator_id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  updated_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  milestone TEXT,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_creator_id ON projects(creator_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);

-- 4. 项目成员表
CREATE TABLE IF NOT EXISTS project_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT CHECK(role IN ('owner', 'member', 'viewer')) DEFAULT 'member',
  joined_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);

-- 5. 会话表
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100),
  type TEXT CHECK(type IN ('direct', 'group', 'project')) NOT NULL,
  avatar_url VARCHAR(500),
  project_id INTEGER,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  updated_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chats_type ON chats(type);
CREATE INDEX IF NOT EXISTS idx_chats_project_id ON chats(project_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_by ON chats(created_by);

-- 6. 会话成员表
CREATE TABLE IF NOT EXISTS chat_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT CHECK(role IN ('admin', 'member')) DEFAULT 'member',
  unread_count INTEGER DEFAULT 0,
  last_read_message_id INTEGER,
  joined_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (last_read_message_id) REFERENCES messages(id) ON DELETE SET NULL,
  UNIQUE(chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_unread ON chat_members(unread_count);

-- 7. 消息表
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_iv TEXT,
  content_tag TEXT,
  content_key_version INTEGER,
  type TEXT CHECK(type IN ('text', 'system', 'ai_summary', 'file')) DEFAULT 'text',
  metadata TEXT,
  reply_to_message_id INTEGER,
  is_deleted BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  updated_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);

-- 8. 任务表
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status TEXT CHECK(status IN ('todo', 'in-progress', 'done')) DEFAULT 'todo',
  status_note TEXT,
  priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
  assignee_id INTEGER,
  start_date DATE,
  end_date DATE,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  updated_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

CREATE TABLE IF NOT EXISTS task_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL CHECK(to_status IN ('todo', 'in-progress', 'done')),
  note TEXT NOT NULL,
  changed_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_status_history_task_id ON task_status_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_status_history_changed_by ON task_status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_task_status_history_created_at ON task_status_history(created_at);

-- 9. 缺陷表
CREATE TABLE IF NOT EXISTS bugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status TEXT CHECK(status IN ('open', 'in-progress', 'fixed', 'closed')) DEFAULT 'open',
  reporter_id INTEGER NOT NULL,
  assignee_id INTEGER,
  images TEXT,  -- JSON array of base64 encoded images
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  updated_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  status_note TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bugs_project_id ON bugs(project_id);
CREATE INDEX IF NOT EXISTS idx_bugs_severity ON bugs(severity);
CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(status);
CREATE INDEX IF NOT EXISTS idx_bugs_reporter_id ON bugs(reporter_id);
CREATE INDEX IF NOT EXISTS idx_bugs_assignee_id ON bugs(assignee_id);

CREATE TABLE IF NOT EXISTS bug_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bug_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL CHECK(to_status IN ('open', 'in-progress', 'fixed', 'closed')),
  note TEXT NOT NULL,
  changed_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (bug_id) REFERENCES bugs(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bug_status_history_bug_id ON bug_status_history(bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_status_history_changed_by ON bug_status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_bug_status_history_created_at ON bug_status_history(created_at);

-- 10. 文档表
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  format TEXT CHECK(format IN ('markdown', 'richtext')) DEFAULT 'markdown',
  type TEXT CHECK(type IN ('requirements_design', 'api', 'development_design', 'test_cases', 'deployment', 'meeting_minutes', 'other')) DEFAULT 'other',
  author_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  updated_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_author_id ON documents(author_id);

CREATE TABLE IF NOT EXISTS document_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  author_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_comments_document_id ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_project_id ON document_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_author_id ON document_comments(author_id);

CREATE TABLE IF NOT EXISTS document_activity_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL CHECK(activity_type IN ('created', 'updated', 'commented', 'comment_deleted')),
  note TEXT NOT NULL,
  changed_by INTEGER NOT NULL,
  related_comment_id INTEGER,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (related_comment_id) REFERENCES document_comments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_document_activity_history_document_id ON document_activity_history(document_id);
CREATE INDEX IF NOT EXISTS idx_document_activity_history_project_id ON document_activity_history(project_id);
CREATE INDEX IF NOT EXISTS idx_document_activity_history_changed_by ON document_activity_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_document_activity_history_created_at ON document_activity_history(created_at);

-- 11. 代码仓库表
CREATE TABLE IF NOT EXISTS repositories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  url VARCHAR(500) NOT NULL,
  platform TEXT CHECK(platform IN ('gitlab', 'github', 'gitea')) DEFAULT 'gitlab',
  access_token TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  updated_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_repositories_project_id ON repositories(project_id);
CREATE INDEX IF NOT EXISTS idx_repositories_platform ON repositories(platform);

-- 12. AI分析记录表
CREATE TABLE IF NOT EXISTS ai_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  analysis_type TEXT CHECK(analysis_type IN ('task', 'bug', 'document', 'summary')) NOT NULL,
  result TEXT NOT NULL,
  status TEXT CHECK(status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_chat_id ON ai_analyses(chat_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_type ON ai_analyses(analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_status ON ai_analyses(status);

-- 12.1 AI分析关联消息表（遵守1NF，避免存储逗号分隔的ID列表）
CREATE TABLE IF NOT EXISTS ai_analysis_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (analysis_id) REFERENCES ai_analyses(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  UNIQUE(analysis_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_messages_analysis_id ON ai_analysis_messages(analysis_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_messages_message_id ON ai_analysis_messages(message_id);

-- 12.2 AI项目变更提案表
CREATE TABLE IF NOT EXISTS project_change_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  chat_id INTEGER NOT NULL,
  ai_analysis_id INTEGER NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('project', 'task', 'bug', 'document')),
  action TEXT NOT NULL CHECK(action IN ('create', 'update')),
  target_id INTEGER,
  title VARCHAR(200) NOT NULL,
  summary TEXT,
  payload TEXT NOT NULL,
  reason TEXT,
  original_title VARCHAR(200),
  original_summary TEXT,
  original_payload TEXT,
  original_reason TEXT,
  source_message_ids TEXT,
  confidence REAL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'applied', 'failed')) DEFAULT 'pending',
  reviewer_id INTEGER,
  reviewer_comment TEXT,
  reviewed_at DATETIME,
  applied_at DATETIME,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  updated_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (ai_analysis_id) REFERENCES ai_analyses(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_project_change_proposals_project_id ON project_change_proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_project_change_proposals_chat_id ON project_change_proposals(chat_id);
CREATE INDEX IF NOT EXISTS idx_project_change_proposals_ai_analysis_id ON project_change_proposals(ai_analysis_id);
CREATE INDEX IF NOT EXISTS idx_project_change_proposals_status ON project_change_proposals(status);
CREATE INDEX IF NOT EXISTS idx_project_change_proposals_target_type ON project_change_proposals(target_type);
CREATE INDEX IF NOT EXISTS idx_project_change_proposals_created_at ON project_change_proposals(created_at);

-- 13. 文件表
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uploader_id INTEGER NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  file_size INTEGER,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_files_uploader_id ON files(uploader_id);

-- 13.1 消息附件关联表（遵守3NF，避免多态关联）
CREATE TABLE IF NOT EXISTS message_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE(message_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_file_id ON message_attachments(file_id);

-- 13.2 文档附件关联表
CREATE TABLE IF NOT EXISTS document_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE(document_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_document_attachments_document_id ON document_attachments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_attachments_file_id ON document_attachments(file_id);

-- 13.3 缺陷附件关联表
CREATE TABLE IF NOT EXISTS bug_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bug_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (bug_id) REFERENCES bugs(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE(bug_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_bug_attachments_bug_id ON bug_attachments(bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_attachments_file_id ON bug_attachments(file_id);

-- 13.4 项目原型稿表
CREATE TABLE IF NOT EXISTS project_prototypes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  archive_file_name VARCHAR(255) NOT NULL,
  archive_file_path VARCHAR(500) NOT NULL,
  archive_size INTEGER NOT NULL DEFAULT 0,
  extracted_dir VARCHAR(500) NOT NULL,
  entry_file VARCHAR(500) NOT NULL,
  preview_key VARCHAR(128) NOT NULL UNIQUE,
  uploader_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  updated_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_prototypes_project_id ON project_prototypes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_prototypes_preview_key ON project_prototypes(preview_key);

-- 13.5 用户头像关联表（如果需要支持多个历史头像）
CREATE TABLE IF NOT EXISTS user_avatars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  is_current BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_avatars_user_id ON user_avatars(user_id);
CREATE INDEX IF NOT EXISTS idx_user_avatars_file_id ON user_avatars(file_id);
CREATE INDEX IF NOT EXISTS idx_user_avatars_is_current ON user_avatars(is_current);
