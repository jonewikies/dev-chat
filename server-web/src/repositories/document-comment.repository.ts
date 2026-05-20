import { Database } from 'sql.js';
import { getDatabaseSync, saveDatabase, execQuery, execStatement } from '../database/connection';
import { DocumentComment, DocumentCommentWithAuthor } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP } from '../utils/date-time.util';

export class DocumentCommentRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  private rowToComment(row: any[]): DocumentComment | null {
    if (!row || row.length === 0) return null;
    return {
      id: row[0],
      document_id: row[1],
      project_id: row[2],
      content: row[3],
      author_id: row[4],
      created_at: normalizeDateTimeOutput(row[5])!,
    } as DocumentComment;
  }

  private rowToCommentWithAuthor(row: any[]): DocumentCommentWithAuthor | null {
    if (!row || row.length === 0) return null;
    const comment: any = {
      id: row[0],
      document_id: row[1],
      project_id: row[2],
      content: row[3],
      author_id: row[4],
      created_at: normalizeDateTimeOutput(row[5])!,
    };

    if (row[6] !== null && row[6] !== undefined) {
      comment.author = {
        id: row[6],
        username: row[7],
        avatar: row[8] || null,
      };
    }

    return comment as DocumentCommentWithAuthor;
  }

  findByDocument(documentId: number): DocumentCommentWithAuthor[] {
    const sql = `
      SELECT
        dc.*,
        u.id as author_user_id,
        u.username as author_username,
        u.avatar_url as author_avatar
      FROM document_comments dc
      LEFT JOIN users u ON dc.author_id = u.id
      WHERE dc.document_id = ?
      ORDER BY dc.created_at DESC
    `;

    const results = execQuery(this.db, sql, [documentId]);
    return results
      .map((row) => this.rowToCommentWithAuthor(row))
      .filter((comment) => comment !== null) as DocumentCommentWithAuthor[];
  }

  findById(id: number): DocumentComment | null {
    const results = execQuery(this.db, 'SELECT * FROM document_comments WHERE id = ?', [id]);
    if (results.length === 0) return null;
    return this.rowToComment(results[0]);
  }

  create(data: { documentId: number; projectId: number; content: string; authorId: number }): DocumentComment {
    execStatement(
      this.db,
      `INSERT INTO document_comments (document_id, project_id, content, author_id, created_at)
       VALUES (?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP})`,
      [data.documentId, data.projectId, data.content, data.authorId]
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const commentId = result[0].values[0][0] as number;
    saveDatabase();
    const comment = this.findById(commentId);
    if (!comment) throw new Error('Failed to create document comment');
    return comment;
  }

  delete(id: number): boolean {
    const comment = this.findById(id);
    if (!comment) return false;

    execStatement(this.db, 'DELETE FROM document_comments WHERE id = ?', [id]);
    saveDatabase();
    return true;
  }
}
