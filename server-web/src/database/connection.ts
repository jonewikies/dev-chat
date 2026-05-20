import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { config } from '../config/app';
import { DOCUMENT_TYPES } from '../constants/document';
import logger from '../utils/logger.util';
import { formatLocalDatabaseDateTime } from '../utils/date-time.util';
import { encryptMessageContent, getMessageEncryptionKeyVersion } from '../utils/message-encryption.util';

let db: Database | null = null;
let SQL: any = null;

// 初始化 sql.js
const initDatabase = async (): Promise<void> => {
  if (!SQL) {
    SQL = await initSqlJs();
  }
};

export const getDatabase = async (): Promise<Database> => {
  if (db) {
    return db;
  }

  try {
    // 初始化 sql.js
    await initDatabase();

    // 确保数据库目录存在
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      logger.info(`Created database directory: ${dbDir}`);
    }

    // 尝试从文件加载数据库
    if (fs.existsSync(config.database.path)) {
      const buffer = fs.readFileSync(config.database.path);
      db = new SQL.Database(buffer);
      logger.info(`Database loaded from: ${config.database.path}`);
    } else {
      // 创建新数据库
      db = new SQL.Database();
      logger.info('Created new database in memory');
    }

    // 启用外键约束
    if (db) {
      db.run('PRAGMA foreign_keys = ON');
    }

    logger.info(`Database connected: ${config.database.path}`);

    return db as Database;
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
};

// 同步获取数据库（用于已初始化的情况）
export const getDatabaseSync = (): Database => {
  if (!db) {
    throw new Error('Database not initialized. Call getDatabase() first.');
  }
  return db;
};

// 保存数据库到文件
export const saveDatabase = (): void => {
  if (!db) {
    return;
  }

  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.database.path, buffer);
    logger.debug('Database saved to disk');
  } catch (error) {
    logger.error('Failed to save database:', error);
  }
};

// 创建数据库备份
export const createBackup = (): void => {
  if (!db) {
    return;
  }

  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const backupDir = path.join(path.dirname(config.database.path), 'backups');
    
    // 确保备份目录存在
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // 创建带时间戳的备份文件
    const timestamp = formatLocalDatabaseDateTime(new Date()).replace(/[ :]/g, '-');
    const backupPath = path.join(backupDir, `devchat-${timestamp}.db`);
    fs.writeFileSync(backupPath, buffer);
    
    logger.info(`Database backup created: ${backupPath}`);
    
    // 保留最近10个备份，删除旧的
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('devchat-') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    
    // 删除超过10个的旧备份
    if (backups.length > 10) {
      backups.slice(10).forEach(backup => {
        fs.unlinkSync(backup.path);
        logger.debug(`Deleted old backup: ${backup.name}`);
      });
    }
  } catch (error) {
    logger.error('Failed to create database backup:', error);
  }
};

// 定期自动保存（每5秒）
let autoSaveInterval: NodeJS.Timeout | null = null;

export const startAutoSave = (): void => {
  if (autoSaveInterval) {
    return;
  }
  autoSaveInterval = setInterval(() => {
    saveDatabase();
  }, 5000);
  logger.info('Auto-save enabled (every 5 seconds)');
};

export const stopAutoSave = (): void => {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
    logger.info('Auto-save disabled');
  }
};

export const closeDatabase = (): void => {
  if (db) {
    stopAutoSave();
    saveDatabase();
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
};

// 检查数据库表是否已存在
export const checkTablesExist = (database: Database): boolean => {
  try {
    const result = database.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    );
    return result.length > 0 && result[0].values.length > 0;
  } catch (error) {
    return false;
  }
};

const hasColumn = (database: Database, tableName: string, columnName: string): boolean => {
  try {
    const result = database.exec(`PRAGMA table_info(${tableName})`);
    return (result[0]?.values || []).some((row) => row[1] === columnName);
  } catch (error) {
    logger.error(`Failed to inspect columns for ${tableName}:`, error);
    return false;
  }
};

const getTableSql = (database: Database, tableName: string): string => {
  try {
    const result = execQuery(
      database,
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
      [tableName]
    );
    return String(result[0]?.[0] || '');
  } catch (error) {
    logger.error(`Failed to inspect schema for ${tableName}:`, error);
    return '';
  }
};

const ensureDocumentTypeSchema = (database: Database): void => {
  const documentsTableSql = getTableSql(database, 'documents');
  const expectedTypeConstraint = DOCUMENT_TYPES.map((type) => `'${type}'`).join(', ');

  if (!documentsTableSql || documentsTableSql.includes(expectedTypeConstraint)) {
    return;
  }

  database.exec('PRAGMA foreign_keys = OFF');
  database.exec('BEGIN TRANSACTION');

  try {
    database.exec('ALTER TABLE documents RENAME TO documents_legacy');
    database.exec(`
      CREATE TABLE documents (
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
    `);
    database.exec(`
      INSERT INTO documents (id, project_id, title, content, format, type, author_id, created_at, updated_at)
      SELECT
        id,
        project_id,
        title,
        content,
        COALESCE(format, 'markdown'),
        CASE
          WHEN type = 'product' THEN 'requirements_design'
          WHEN type = 'design' THEN 'development_design'
          WHEN type = 'meeting' THEN 'meeting_minutes'
          WHEN type = 'general' THEN 'other'
          WHEN type IN ('requirements_design', 'api', 'development_design', 'test_cases', 'deployment', 'meeting_minutes', 'other') THEN type
          ELSE 'other'
        END,
        author_id,
        created_at,
        updated_at
      FROM documents_legacy
    `);
    database.exec('DROP TABLE documents_legacy');
    database.exec('CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_documents_author_id ON documents(author_id)');
    database.exec('COMMIT');
    database.exec('PRAGMA foreign_keys = ON');
    saveDatabase();
    logger.info('Database schema updated: migrated documents.type to new category set');
  } catch (error) {
    database.exec('ROLLBACK');
    database.exec('PRAGMA foreign_keys = ON');
    throw error;
  }
};

const ensureSchemaCompatibility = (database: Database): void => {
  database.exec(`
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
  `);

  ensureDocumentTypeSchema(database);

  if (checkTablesExist(database) && !hasColumn(database, 'tasks', 'status_note')) {
    database.exec('ALTER TABLE tasks ADD COLUMN status_note TEXT');
    saveDatabase();
    logger.info('Database schema updated: added tasks.status_note');
  }

  if (checkTablesExist(database) && !hasColumn(database, 'users', 'is_super_admin')) {
    database.exec('ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT 0');
    database.exec('CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON users(is_super_admin)');
    saveDatabase();
    logger.info('Database schema updated: added users.is_super_admin');
  }

  if (checkTablesExist(database) && !hasColumn(database, 'bugs', 'status_note')) {
    database.exec('ALTER TABLE bugs ADD COLUMN status_note TEXT');
    saveDatabase();
    logger.info('Database schema updated: added bugs.status_note');
  }

  if (checkTablesExist(database) && !hasColumn(database, 'messages', 'content_iv')) {
    database.exec('ALTER TABLE messages ADD COLUMN content_iv TEXT');
    saveDatabase();
    logger.info('Database schema updated: added messages.content_iv');
  }

  if (checkTablesExist(database) && !hasColumn(database, 'messages', 'content_tag')) {
    database.exec('ALTER TABLE messages ADD COLUMN content_tag TEXT');
    saveDatabase();
    logger.info('Database schema updated: added messages.content_tag');
  }

  if (checkTablesExist(database) && !hasColumn(database, 'messages', 'content_key_version')) {
    database.exec('ALTER TABLE messages ADD COLUMN content_key_version INTEGER');
    saveDatabase();
    logger.info('Database schema updated: added messages.content_key_version');
  }

  if (checkTablesExist(database) && !hasColumn(database, 'project_change_proposals', 'original_title')) {
    database.exec('ALTER TABLE project_change_proposals ADD COLUMN original_title VARCHAR(200)');
    database.exec('UPDATE project_change_proposals SET original_title = title WHERE original_title IS NULL');
    saveDatabase();
    logger.info('Database schema updated: added project_change_proposals.original_title');
  }

  if (checkTablesExist(database) && !hasColumn(database, 'project_change_proposals', 'original_summary')) {
    database.exec('ALTER TABLE project_change_proposals ADD COLUMN original_summary TEXT');
    database.exec('UPDATE project_change_proposals SET original_summary = summary WHERE original_summary IS NULL');
    saveDatabase();
    logger.info('Database schema updated: added project_change_proposals.original_summary');
  }

  if (checkTablesExist(database) && !hasColumn(database, 'project_change_proposals', 'original_payload')) {
    database.exec('ALTER TABLE project_change_proposals ADD COLUMN original_payload TEXT');
    database.exec('UPDATE project_change_proposals SET original_payload = payload WHERE original_payload IS NULL');
    saveDatabase();
    logger.info('Database schema updated: added project_change_proposals.original_payload');
  }

  if (checkTablesExist(database) && !hasColumn(database, 'project_change_proposals', 'original_reason')) {
    database.exec('ALTER TABLE project_change_proposals ADD COLUMN original_reason TEXT');
    database.exec('UPDATE project_change_proposals SET original_reason = reason WHERE original_reason IS NULL');
    saveDatabase();
    logger.info('Database schema updated: added project_change_proposals.original_reason');
  }

  if (checkTablesExist(database) && hasColumn(database, 'messages', 'content_iv') && hasColumn(database, 'messages', 'content_tag')) {
    const legacyMessages = execQuery(
      database,
      `SELECT id, content
       FROM messages
       WHERE (content_iv IS NULL OR content_iv = '')
         OR (content_tag IS NULL OR content_tag = '')`
    );

    if (legacyMessages.length > 0) {
      legacyMessages.forEach(([id, content]) => {
        const encrypted = encryptMessageContent(String(content || ''));
        execStatement(
          database,
          `UPDATE messages
           SET content = ?, content_iv = ?, content_tag = ?, content_key_version = ?
           WHERE id = ?`,
          [encrypted.ciphertext, encrypted.iv, encrypted.tag, getMessageEncryptionKeyVersion(), id]
        );
      });
      saveDatabase();
      logger.info(`Database schema updated: encrypted ${legacyMessages.length} legacy messages`);
    }
  }
};

// 初始化数据库Schema
export const initializeSchema = async (force: boolean = false): Promise<void> => {
  const database = await getDatabase();
  
  // 如果不是强制初始化，且表已存在，则跳过
  if (!force && checkTablesExist(database)) {
    ensureSchemaCompatibility(database);
    saveDatabase();
    logger.info('Database schema already exists, skipping initialization');
    return;
  }

  // 从dist目录读取schema.sql（编译后的位置）
  const schemaPath = path.join(__dirname, 'schema.sql');

  try {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    database.exec(schema);
    ensureSchemaCompatibility(database);
    saveDatabase(); // 立即保存
    logger.info(force ? 'Database schema reinitialized from latest schema.sql' : 'Database schema initialized from latest schema.sql');
  } catch (error) {
    logger.error('Failed to initialize database schema:', error);
    throw error;
  }
};

export default getDatabase;

// Helper functions for sql.js prepared statements
export const execQuery = (db: Database, sql: string, params?: any[]): any[][] => {
  if (!params || params.length === 0) {
    const result = db.exec(sql);
    return result.length > 0 ? result[0].values : [];
  }

  const stmt = db.prepare(sql);
  stmt.bind(params);
  
  const results: any[][] = [];
  while (stmt.step()) {
    results.push(stmt.get());
  }
  stmt.free();
  
  return results;
};

export const execStatement = (db: Database, sql: string, params?: any[]): void => {
  if (!params || params.length === 0) {
    db.exec(sql);
    return;
  }

  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
};
