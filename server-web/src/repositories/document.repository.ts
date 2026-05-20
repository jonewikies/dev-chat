import { Database } from 'sql.js';
import { getDatabaseSync, saveDatabase, execQuery, execStatement } from '../database/connection';
import { DEFAULT_DOCUMENT_TYPE, normalizeDocumentType, type DocumentType } from '../constants/document';
import { Document, DocumentActivityWithUser, DocumentWithAuthor } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP } from '../utils/date-time.util';

export class DocumentRepository {
  private hasFormatColumnCache: boolean | null = null;

  private get db(): Database {
    return getDatabaseSync();
  }

  constructor() {
    // Database will be accessed lazily via getter
  }

  private hasFormatColumn(): boolean {
    if (this.hasFormatColumnCache !== null) {
      return this.hasFormatColumnCache;
    }

    const tableInfo = this.db.exec('PRAGMA table_info(documents)');
    const columns = tableInfo[0]?.values?.map((row) => String(row[1])) || [];
    this.hasFormatColumnCache = columns.includes('format');
    return this.hasFormatColumnCache;
  }

  private rowToDocument(row: any[]): Document | null {
    if (!row || row.length === 0) return null;
    return {
      id: row[0],
      project_id: row[1],
      title: row[2],
      content: row[3] || null,
      format: (row[4] || 'markdown') as any,
      type: row[5] as any,
      author_id: row[6],
      created_at: normalizeDateTimeOutput(row[7])!,
      updated_at: normalizeDateTimeOutput(row[8])!,
    } as Document;
  }

  private rowToDocumentWithAuthor(row: any[]): DocumentWithAuthor | null {
    if (!row || row.length === 0) return null;
    const doc: any = {
      id: row[0],
      project_id: row[1],
      title: row[2],
      content: row[3] || null,
      format: (row[4] || 'markdown') as any,
      type: row[5] as any,
      author_id: row[6],
      created_at: normalizeDateTimeOutput(row[7])!,
      updated_at: normalizeDateTimeOutput(row[8])!,
    };
    
    // Author info (from JOIN)
    if (row[9] !== null && row[9] !== undefined) {
      doc.author = {
        id: row[9],
        username: row[10],
        avatar: row[11] || null,
      };
    }
    
    return doc as DocumentWithAuthor;
  }

  private rowToDocumentActivity(row: any[]): DocumentActivityWithUser | null {
    if (!row || row.length === 0) return null;

    const activity: DocumentActivityWithUser = {
      id: row[0],
      document_id: row[1],
      project_id: row[2],
      activity_type: row[3],
      note: row[4],
      changed_by: row[5],
      related_comment_id: row[6] || null,
      created_at: normalizeDateTimeOutput(row[7])!,
    };

    if (row[8] !== null && row[8] !== undefined) {
      activity.changed_by_user = {
        id: row[8],
        username: row[9],
        avatar: row[10] || null,
      };
    }

    return activity;
  }

  private buildFilterClause(
    projectId: number,
    filters?: {
      type?: string;
      keyword?: string;
    }
  ): { whereClause: string; params: any[] } {
    let whereClause = ` WHERE d.project_id = ?`;
    const params: any[] = [projectId];

    if (filters?.type) {
      whereClause += ` AND d.type = ?`;
      params.push(normalizeDocumentType(filters.type));
    }

    if (filters?.keyword) {
      whereClause += ` AND d.title LIKE ?`;
      params.push(`%${filters.keyword.trim()}%`);
    }

    return { whereClause, params };
  }

  findById(id: number): Document | null {
    const hasFormatColumn = this.hasFormatColumn();
    const sql = hasFormatColumn
      ? `
        SELECT
          id,
          project_id,
          title,
          content,
          format,
          type,
          author_id,
          created_at,
          updated_at
        FROM documents
        WHERE id = ?`
      : `
        SELECT
          id,
          project_id,
          title,
          content,
          'markdown' as format,
          type,
          author_id,
          created_at,
          updated_at
        FROM documents
        WHERE id = ?`;

    const results = execQuery(this.db, sql, [id]);
    if (results.length === 0) return null;
    return this.rowToDocument(results[0]);
  }

  findWithAuthorById(id: number): DocumentWithAuthor | null {
    const hasFormatColumn = this.hasFormatColumn();
    const results = execQuery(
      this.db,
      `SELECT
        d.id,
        d.project_id,
        d.title,
        d.content,
        ${hasFormatColumn ? 'd.format' : "'markdown'"} as format,
        d.type,
        d.author_id,
        d.created_at,
        d.updated_at,
        u.id as author_user_id,
        u.username as author_username,
        u.avatar_url as author_avatar
      FROM documents d
      LEFT JOIN users u ON d.author_id = u.id
      WHERE d.id = ?`,
      [id]
    );

    if (results.length === 0) return null;

    const document = this.rowToDocumentWithAuthor(results[0]);
    if (!document) return null;
    document.activity_history = this.getActivityHistory(id);
    return document;
  }

  getActivityHistory(documentId: number): DocumentActivityWithUser[] {
    const results = execQuery(
      this.db,
      `SELECT
        h.id,
        h.document_id,
        h.project_id,
        h.activity_type,
        h.note,
        h.changed_by,
        h.related_comment_id,
        h.created_at,
        u.id as changed_by_user_id,
        u.username as changed_by_username,
        u.avatar_url as changed_by_avatar
      FROM document_activity_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.document_id = ?
      ORDER BY h.created_at ASC, h.id ASC`,
      [documentId]
    );

    return results
      .map((row) => this.rowToDocumentActivity(row))
      .filter((activity) => activity !== null) as DocumentActivityWithUser[];
  }

  createActivity(data: {
    documentId: number;
    projectId: number;
    activityType: 'created' | 'updated' | 'commented' | 'comment_deleted';
    note: string;
    changedBy: number;
    relatedCommentId?: number;
  }): void {
    execStatement(
      this.db,
      `INSERT INTO document_activity_history (document_id, project_id, activity_type, note, changed_by, related_comment_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP})`,
      [
        data.documentId,
        data.projectId,
        data.activityType,
        data.note,
        data.changedBy,
        data.relatedCommentId || null,
      ]
    );

    saveDatabase();
  }

  findByProject(projectId: number, filters?: {
    type?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): { documents: DocumentWithAuthor[]; total: number } {
    const { whereClause, params } = this.buildFilterClause(projectId, filters);
    const hasFormatColumn = this.hasFormatColumn();
    const page = Math.max(1, filters?.page || 1);
    const pageSize = Math.max(1, filters?.pageSize || 10);
    const offset = (page - 1) * pageSize;

    const countSql = `SELECT COUNT(*) FROM documents d${whereClause}`;
    const countResults = execQuery(this.db, countSql, params);
    const total = (countResults[0]?.[0] as number) || 0;

    const sql = `
      SELECT 
        d.id,
        d.project_id,
        d.title,
        d.content,
        ${hasFormatColumn ? 'd.format' : "'markdown'"} as format,
        d.type,
        d.author_id,
        d.created_at,
        d.updated_at,
        u.id as author_user_id,
        u.username as author_username,
        u.avatar_url as author_avatar
      FROM documents d
      LEFT JOIN users u ON d.author_id = u.id
      ${whereClause}
      ORDER BY d.updated_at DESC
      LIMIT ? OFFSET ?`;

    const results = execQuery(this.db, sql, [...params, pageSize, offset]);
    return {
      documents: results.map(row => this.rowToDocumentWithAuthor(row)).filter(doc => doc !== null) as DocumentWithAuthor[],
      total,
    };
  }

  create(data: {
    projectId: number;
    title: string;
    content?: string;
    format?: 'markdown' | 'richtext';
    type?: DocumentType;
    authorId: number;
  }): Document {
    if (this.hasFormatColumn()) {
      execStatement(
        this.db,
        `INSERT INTO documents (project_id, title, content, format, type, author_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP}, ${SQLITE_LOCAL_TIMESTAMP})`,
        [
          data.projectId,
          data.title,
          data.content || null,
          data.format || 'markdown',
          normalizeDocumentType(data.type || DEFAULT_DOCUMENT_TYPE),
          data.authorId,
        ]
      );
    } else {
      execStatement(
        this.db,
        `INSERT INTO documents (project_id, title, content, type, author_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP}, ${SQLITE_LOCAL_TIMESTAMP})`,
        [
          data.projectId,
          data.title,
          data.content || null,
          normalizeDocumentType(data.type || DEFAULT_DOCUMENT_TYPE),
          data.authorId,
        ]
      );
    }

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const docId = result[0].values[0][0] as number;

    this.createActivity({
      documentId: docId,
      projectId: data.projectId,
      activityType: 'created',
      note: '创建文档',
      changedBy: data.authorId,
    });
    
    saveDatabase();
    const doc = this.findById(docId);
    if (!doc) throw new Error('Failed to create document');
    return doc;
  }

  update(id: number, data: {
    title?: string;
    content?: string;
    format?: 'markdown' | 'richtext';
    type?: DocumentType;
    updatedBy?: number;
  }): Document {
    const doc = this.findById(id);
    if (!doc) throw new Error('Document not found');

    const updates: string[] = [];
    const params: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }

    if (data.content !== undefined) {
      updates.push('content = ?');
      params.push(data.content);
    }

    if (this.hasFormatColumn() && data.format !== undefined) {
      updates.push('format = ?');
      params.push(data.format);
    }

    if (data.type !== undefined) {
      updates.push('type = ?');
      params.push(normalizeDocumentType(data.type));
    }

    if (updates.length > 0) {
      const changeLabels: string[] = [];
      if (data.title !== undefined && data.title !== doc.title) {
        changeLabels.push('标题');
      }
      if (data.content !== undefined && data.content !== doc.content) {
        changeLabels.push('内容');
      }
      if (data.format !== undefined && data.format !== doc.format) {
        changeLabels.push('格式');
      }
      if (data.type !== undefined && data.type !== doc.type) {
        changeLabels.push('类型');
      }

      updates.push(`updated_at = ${SQLITE_LOCAL_TIMESTAMP}`);
      params.push(id);

      execStatement(
        this.db,
        `UPDATE documents SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      if (data.updatedBy) {
        this.createActivity({
          documentId: id,
          projectId: doc.project_id,
          activityType: 'updated',
          note: changeLabels.length > 0 ? `更新${changeLabels.join('、')}` : '更新文档',
          changedBy: data.updatedBy,
        });
      }

      saveDatabase();
    }

    const updatedDoc = this.findById(id);
    if (!updatedDoc) throw new Error('Failed to update document');
    return updatedDoc;
  }

  delete(id: number): boolean {
    const doc = this.findById(id);
    if (!doc) return false;

    execStatement(this.db, `DELETE FROM documents WHERE id = ?`, [id]);
    saveDatabase();
    return true;
  }

  countByProject(projectId: number, filters?: {
    type?: string;
    keyword?: string;
  }): number {
    const { whereClause, params } = this.buildFilterClause(projectId, filters);
    const sql = `SELECT COUNT(*) as count FROM documents d${whereClause}`;
    const results = execQuery(this.db, sql, params);
    return results[0]?.[0] || 0;
  }
}
