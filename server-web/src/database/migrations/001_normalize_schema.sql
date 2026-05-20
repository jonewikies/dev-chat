-- 数据库范式优化迁移脚本
-- 将违反1NF和3NF的设计修改为符合范式的设计

-- 1. 创建 AI分析关联消息表（替代 ai_analyses.message_ids TEXT 字段）
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

-- 2. 迁移现有 ai_analyses 数据（如果有）
-- 注意：这需要在应用层处理，因为需要解析逗号分隔的字符串
-- INSERT INTO ai_analysis_messages (analysis_id, message_id)
-- SELECT id, message_id FROM ai_analyses, ...

-- 3. 删除 ai_analyses 的 message_ids 列（SQLite 不支持 ALTER TABLE DROP COLUMN）
-- 需要重建表
CREATE TABLE IF NOT EXISTS ai_analyses_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  analysis_type TEXT CHECK(analysis_type IN ('task', 'bug', 'document', 'summary')) NOT NULL,
  result TEXT NOT NULL,
  status TEXT CHECK(status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  created_at DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- 复制数据
INSERT INTO ai_analyses_new (id, chat_id, analysis_type, result, status, created_at)
SELECT id, chat_id, analysis_type, result, status, created_at FROM ai_analyses;

-- 删除旧表
DROP TABLE IF EXISTS ai_analyses;

-- 重命名新表
ALTER TABLE ai_analyses_new RENAME TO ai_analyses;

-- 重建索引
CREATE INDEX IF NOT EXISTS idx_ai_analyses_chat_id ON ai_analyses(chat_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_type ON ai_analyses(analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_status ON ai_analyses(status);

-- 4. 创建规范化的文件关联表
-- 4.1 消息附件关联表
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

-- 4.2 文档附件关联表
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

-- 4.3 用户头像关联表
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

-- 5. 迁移现有 files 数据到新的关联表
-- 这需要在应用层处理
-- INSERT INTO message_attachments (message_id, file_id)
-- SELECT related_id, id FROM files WHERE related_type = 'message';

-- INSERT INTO document_attachments (document_id, file_id)
-- SELECT related_id, id FROM files WHERE related_type = 'document';

-- INSERT INTO user_avatars (user_id, file_id, is_current)
-- SELECT related_id, id, 1 FROM files WHERE related_type = 'avatar';

-- 6. 重建 files 表（移除 related_type 和 related_id 列）
CREATE TABLE IF NOT EXISTS files_new (
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

-- 复制数据
INSERT INTO files_new (id, uploader_id, original_name, stored_name, file_path, mime_type, file_size, created_at)
SELECT id, uploader_id, original_name, stored_name, file_path, mime_type, file_size, created_at FROM files;

-- 删除旧表
DROP TABLE IF EXISTS files;

-- 重命名新表
ALTER TABLE files_new RENAME TO files;

-- 重建索引
CREATE INDEX IF NOT EXISTS idx_files_uploader_id ON files(uploader_id);

-- 完成迁移
