import { Database } from 'sql.js';
import { getDatabaseSync, saveDatabase, execQuery, execStatement } from '../database/connection';
import { Message } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP, toDatabaseDateTime } from '../utils/date-time.util';
import logger from '../utils/logger.util';
import {
  decryptMessageContent,
  encryptMessageContent,
  getMessageEncryptionKeyVersion,
} from '../utils/message-encryption.util';

export class MessageRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  constructor() {
    // Database will be accessed lazily via getter
  }

  private readonly selectColumns = `
    id,
    chat_id,
    sender_id,
    content,
    content_iv,
    content_tag,
    content_key_version,
    type,
    metadata,
    reply_to_message_id,
    is_deleted,
    created_at,
    updated_at
  `;

  private rowToMessage(row: any[]): Message | null {
    if (!row || row.length === 0) return null;

    let content = row[3];
    const contentIv = row[4] || undefined;
    const contentTag = row[5] || undefined;

    if (contentIv && contentTag) {
      try {
        content = decryptMessageContent({
          ciphertext: String(row[3] || ''),
          iv: String(contentIv),
          tag: String(contentTag),
        });
      } catch (error) {
        logger.error('Failed to decrypt message content', {
          messageId: row[0],
          error: error instanceof Error ? error.message : String(error),
        });
        content = '[消息解密失败]';
      }
    }

    return {
      id: row[0],
      chat_id: row[1],
      sender_id: row[2],
      content: String(content || ''),
      type: row[7] as any,
      metadata: row[8] || undefined,
      reply_to_message_id: row[9] || undefined,
      is_deleted: Boolean(row[10]),
      created_at: normalizeDateTimeOutput(row[11])!,
      updated_at: normalizeDateTimeOutput(row[12])!,
    };
  }

  findById(id: number): Message | null {
    const results = execQuery(this.db, `SELECT ${this.selectColumns} FROM messages WHERE id = ?`, [id]);
    if (results.length === 0) return null;
    return this.rowToMessage(results[0]);
  }

  findByChatId(chatId: number, limit: number = 50, beforeId?: number): Message[] {
    let sql = `SELECT ${this.selectColumns} FROM messages WHERE chat_id = ?`;
    const params: any[] = [chatId];

    if (beforeId) {
      sql += ` AND id < ?`;
      params.push(beforeId);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const results = execQuery(this.db, sql, params);
    
    // 返回时恢复正序
    return results.map(row => this.rowToMessage(row)!).reverse();
  }

  findByChatIdInRange(
    chatId: number,
    filters?: {
      limit?: number;
      beforeId?: number;
      startMessageId?: number;
      endMessageId?: number;
      startTime?: string;
      endTime?: string;
    }
  ): Message[] {
    let baseSql = `SELECT ${this.selectColumns} FROM messages WHERE chat_id = ?`;
    const params: any[] = [chatId];
    const normalizedStartTime = filters?.startTime ? toDatabaseDateTime(filters.startTime) || filters.startTime : undefined;
    const normalizedEndTime = filters?.endTime ? toDatabaseDateTime(filters.endTime) || filters.endTime : undefined;

    if (filters?.beforeId) {
      baseSql += ` AND id < ?`;
      params.push(filters.beforeId);
    }

    if (filters?.startMessageId) {
      baseSql += ` AND id >= ?`;
      params.push(filters.startMessageId);
    }

    if (filters?.endMessageId) {
      baseSql += ` AND id <= ?`;
      params.push(filters.endMessageId);
    }

    if (normalizedStartTime) {
      baseSql += ` AND created_at >= ?`;
      params.push(normalizedStartTime);
    }

    if (normalizedEndTime) {
      baseSql += ` AND created_at <= ?`;
      params.push(normalizedEndTime);
    }

    let sql = `${baseSql} ORDER BY created_at ASC, id ASC`;

    if (filters?.limit && filters.limit > 0) {
      sql = `SELECT * FROM (${baseSql} ORDER BY created_at DESC, id DESC LIMIT ?) scoped_messages ORDER BY created_at ASC, id ASC`;
      params.push(filters.limit);
    }

    const results = execQuery(this.db, sql, params);
    return results.map((row) => this.rowToMessage(row)!).filter(Boolean);
  }

  create(data: {
    chatId: number;
    senderId: number;
    content: string;
    type?: 'text' | 'image' | 'file' | 'code' | 'system' | 'ai_summary';
    metadata?: string;
    replyToId?: number;
  }): Message {
    const encrypted = encryptMessageContent(data.content);
    execStatement(
      this.db,
      `INSERT INTO messages (
         chat_id,
         sender_id,
         content,
         content_iv,
         content_tag,
         content_key_version,
         type,
         metadata,
         reply_to_message_id,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP}, ${SQLITE_LOCAL_TIMESTAMP})`,
      [
        data.chatId,
        data.senderId,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
        getMessageEncryptionKeyVersion(),
        data.type || 'text',
        data.metadata || null,
        data.replyToId || null,
      ]
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const messageId = result[0].values[0][0] as number;
    
    saveDatabase();
    
    return this.findById(messageId)!;
  }

  update(id: number, content: string): Message {
    const encrypted = encryptMessageContent(content);
    execStatement(
      this.db,
      `UPDATE messages 
       SET content = ?, content_iv = ?, content_tag = ?, content_key_version = ?, is_edited = 1, updated_at = ${SQLITE_LOCAL_TIMESTAMP}
       WHERE id = ?`,
      [encrypted.ciphertext, encrypted.iv, encrypted.tag, getMessageEncryptionKeyVersion(), id]
    );
    saveDatabase();
    return this.findById(id)!;
  }

  delete(id: number): void {
    execStatement(
      this.db,
      `UPDATE messages SET is_deleted = 1, updated_at = ${SQLITE_LOCAL_TIMESTAMP} WHERE id = ?`,
      [id]
    );
    saveDatabase();
  }

  search(chatId: number, query: string, limit: number = 20): Message[] {
    const results = execQuery(
      this.db,
      `SELECT ${this.selectColumns}
       FROM messages
       WHERE chat_id = ? AND is_deleted = 0
       ORDER BY created_at DESC`,
      [chatId]
    );

    return results
      .map((row) => this.rowToMessage(row)!)
      .filter((message) => message.content.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit);
  }

  countUnread(chatId: number, userId: number, lastReadAt: string | null): number {
    let sql = `
      SELECT COUNT(*) as count FROM messages 
      WHERE chat_id = ? AND sender_id != ? AND is_deleted = 0
    `;
    const params: any[] = [chatId, userId];

    if (lastReadAt) {
      sql += ` AND created_at > ?`;
      params.push(lastReadAt);
    }

    const results = execQuery(this.db, sql, params);
    if (results.length === 0) return 0;
    return results[0][0] as number;
  }
}
