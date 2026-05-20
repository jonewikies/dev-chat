import { Database } from 'sql.js';
import { execQuery, execStatement, getDatabaseSync, saveDatabase } from '../database/connection';
import { File } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP } from '../utils/date-time.util';

export class FileRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  private readonly selectColumns = `
    id,
    uploader_id,
    original_name,
    stored_name,
    file_path,
    mime_type,
    file_size,
    created_at
  `;

  private rowToFile(row: any[]): File | null {
    if (!row || row.length === 0) return null;
    return {
      id: row[0],
      uploader_id: row[1],
      original_name: row[2],
      stored_name: row[3],
      file_path: row[4],
      mime_type: row[5] || undefined,
      file_size: row[6] || undefined,
      related_type: 'message',
      related_id: undefined,
      created_at: normalizeDateTimeOutput(row[7])!,
    };
  }

  create(data: {
    uploaderId: number;
    originalName: string;
    storedName: string;
    filePath: string;
    mimeType?: string;
    fileSize?: number;
  }): File {
    execStatement(
      this.db,
      `INSERT INTO files (uploader_id, original_name, stored_name, file_path, mime_type, file_size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP})`,
      [
        data.uploaderId,
        data.originalName,
        data.storedName,
        data.filePath,
        data.mimeType || null,
        data.fileSize || null,
      ]
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const fileId = result[0].values[0][0] as number;
    saveDatabase();
    return this.findById(fileId)!;
  }

  findById(fileId: number): File | null {
    const results = execQuery(this.db, `SELECT ${this.selectColumns} FROM files WHERE id = ?`, [fileId]);
    if (results.length === 0) return null;
    return this.rowToFile(results[0]);
  }
}

export class MessageAttachmentRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  create(messageId: number, fileId: number): void {
    execStatement(
      this.db,
      'INSERT INTO message_attachments (message_id, file_id) VALUES (?, ?)',
      [messageId, fileId]
    );
    saveDatabase();
  }

  findFileIdsByMessageId(messageId: number): number[] {
    const results = execQuery(
      this.db,
      'SELECT file_id FROM message_attachments WHERE message_id = ? ORDER BY id ASC',
      [messageId]
    );
    return results.map((row) => row[0] as number);
  }

  findMessageIdByFileId(fileId: number): number | null {
    const results = execQuery(
      this.db,
      'SELECT message_id FROM message_attachments WHERE file_id = ? LIMIT 1',
      [fileId]
    );
    if (results.length === 0) return null;
    return results[0][0] as number;
  }
}