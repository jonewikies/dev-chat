import { Database } from 'sql.js';
import { getDatabaseSync, saveDatabase, execQuery, execStatement } from '../database/connection';
import { Chat, ChatMember } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP } from '../utils/date-time.util';

export class ChatRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  constructor() {
    // Database will be accessed lazily via getter
  }

  private rowToChat(row: any[]): Chat | null {
    if (!row || row.length === 0) return null;
    return {
      id: row[0],
      name: row[1] || undefined,
      type: row[2] as 'direct' | 'group',
      avatar_url: row[3] || undefined,
      project_id: row[4] || undefined,
      created_by: row[5],
      created_at: normalizeDateTimeOutput(row[6])!,
      updated_at: normalizeDateTimeOutput(row[7])!,
    };
  }

  findById(id: number): Chat | null {
    const results = execQuery(this.db, `SELECT * FROM chats WHERE id = ?`, [id]);
    if (results.length === 0) return null;
    return this.rowToChat(results[0]);
  }

  findByUser(userId: number): Chat[] {
    const results = execQuery(
      this.db,
      `SELECT c.* FROM chats c
       INNER JOIN chat_members cm ON c.id = cm.chat_id
       WHERE cm.user_id = ?
       ORDER BY c.updated_at DESC`,
      [userId]
    );
    return results.map(row => this.rowToChat(row)!);
  }

  findDirectChat(userId1: number, userId2: number): Chat | null {
    const results = execQuery(
      this.db,
      `SELECT c.* FROM chats c
       WHERE c.type = 'direct'
       AND c.id IN (SELECT chat_id FROM chat_members WHERE user_id = ?)
       AND c.id IN (SELECT chat_id FROM chat_members WHERE user_id = ?)`,
      [userId1, userId2]
    );
    if (results.length === 0) return null;
    return this.rowToChat(results[0]);
  }

  findProjectChat(projectId: number): Chat | null {
    const results = execQuery(
      this.db,
      `SELECT * FROM chats
       WHERE type = 'project' AND project_id = ?
       ORDER BY id ASC
       LIMIT 1`,
      [projectId]
    );
    if (results.length === 0) return null;
    return this.rowToChat(results[0]);
  }

  create(data: {
    type: 'direct' | 'group' | 'project';
    createdBy: number;
    name?: string;
    avatarUrl?: string;
    projectId?: number;
  }): Chat {
    execStatement(
      this.db,
      `INSERT INTO chats (type, created_by, name, avatar_url, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP}, ${SQLITE_LOCAL_TIMESTAMP})`,
      [data.type, data.createdBy, data.name || null, data.avatarUrl || null, data.projectId || null]
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const chatId = result[0].values[0][0] as number;
    
    saveDatabase();
    
    return this.findById(chatId)!;
  }

  update(id: number, data: Partial<Chat>): Chat {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.avatar_url !== undefined) {
      fields.push('avatar_url = ?');
      values.push(data.avatar_url);
    }

    if (fields.length === 0) {
      return this.findById(id)!;
    }

    fields.push(`updated_at = ${SQLITE_LOCAL_TIMESTAMP}`);
    values.push(id);

    execStatement(this.db, `UPDATE chats SET ${fields.join(', ')} WHERE id = ?`, values);
    saveDatabase();
    return this.findById(id)!;
  }

  updateLastMessage(_chatId: number, _messageId: number): void {
    // last_message_id field doesn't exist in chats table, skip this update
    // This method is kept for backward compatibility but does nothing
  }

  delete(id: number): void {
    execStatement(this.db, 'DELETE FROM chats WHERE id = ?', [id]);
    saveDatabase();
  }
}

export class ChatMemberRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  constructor() {
    // Database will be accessed lazily via getter
  }

  private rowToChatMember(row: any[]): ChatMember | null {
    if (!row || row.length === 0) return null;
    return {
      id: row[0],
      chat_id: row[1],
      user_id: row[2],
      role: row[3] as 'admin' | 'member',
      unread_count: row[4],
      last_read_message_id: row[5] || undefined,
      joined_at: normalizeDateTimeOutput(row[6])!,
    };
  }

  findByChatId(chatId: number): ChatMember[] {
    const results = execQuery(this.db, `SELECT * FROM chat_members WHERE chat_id = ?`, [chatId]);
    return results.map(row => this.rowToChatMember(row)!);
  }

  findByChatAndUser(chatId: number, userId: number): ChatMember | null {
    const results = execQuery(
      this.db,
      `SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?`,
      [chatId, userId]
    );
    if (results.length === 0) return null;
    return this.rowToChatMember(results[0]);
  }

  addMember(chatId: number, userId: number, role: 'admin' | 'member' = 'member'): ChatMember {
    execStatement(
      this.db,
      `INSERT INTO chat_members (chat_id, user_id, role, joined_at) VALUES (?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP})`,
      [chatId, userId, role]
    );
    
    saveDatabase();
    
    return this.findByChatAndUser(chatId, userId)!;
  }

  updateRole(chatId: number, userId: number, role: 'admin' | 'member'): ChatMember | null {
    execStatement(
      this.db,
      `UPDATE chat_members SET role = ? WHERE chat_id = ? AND user_id = ?`,
      [role, chatId, userId]
    );
    saveDatabase();

    return this.findByChatAndUser(chatId, userId);
  }

  updateLastRead(chatId: number, userId: number, messageId: number): void {
    execStatement(
      this.db,
      `UPDATE chat_members SET last_read_message_id = ?, unread_count = 0
       WHERE chat_id = ? AND user_id = ?`,
      [messageId, chatId, userId]
    );
    saveDatabase();
  }

  incrementUnreadCount(chatId: number, excludeUserId: number): void {
    execStatement(
      this.db,
      `UPDATE chat_members 
       SET unread_count = unread_count + 1
       WHERE chat_id = ? AND user_id != ?`,
      [chatId, excludeUserId]
    );
    saveDatabase();
  }

  removeMember(chatId: number, userId: number): void {
    execStatement(
      this.db,
      `DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?`,
      [chatId, userId]
    );
    saveDatabase();
  }
}
