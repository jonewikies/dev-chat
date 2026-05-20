import { Database } from 'sql.js';
import { getDatabaseSync, saveDatabase, execQuery, execStatement } from '../database/connection';
import { Project } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP } from '../utils/date-time.util';

export class ProjectRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  constructor() {
    // Database will be accessed lazily via getter
  }

  private rowToProject(row: any[]): Project | null {
    if (!row || row.length === 0) return null;
    return {
      id: row[0],
      name: row[1],
      description: row[2] || undefined,
      goal: row[3] || undefined,
      content: row[4] || undefined,
      timeline: row[5] || undefined,
      status: row[6] as any,
      creator_id: row[7],
      owner_id: row[8],
      created_at: normalizeDateTimeOutput(row[9])!,
      updated_at: normalizeDateTimeOutput(row[10])!,
      milestone: row[11] || undefined,
    };
  }

  findById(id: number): Project | null {
    const results = execQuery(this.db, `SELECT * FROM projects WHERE id = ?`, [id]);
    if (results.length === 0) return null;
    return this.rowToProject(results[0]);
  }

  findByUser(userId: number, limit: number = 20, offset: number = 0): Project[] {
    const results = execQuery(
      this.db,
      `SELECT p.* FROM projects p
       INNER JOIN project_members pm ON p.id = pm.project_id
       WHERE pm.user_id = ?
       ORDER BY p.updated_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    return results.map(row => this.rowToProject(row)!);
  }

  findAll(limit: number = 200, offset: number = 0): Project[] {
    const results = execQuery(
      this.db,
      `SELECT * FROM projects
       ORDER BY updated_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return results.map(row => this.rowToProject(row)!);
  }

  create(data: {
    name: string;
    creatorId: number;
    ownerId: number;
    description?: string;
    goal?: string;
    content?: string;
    timeline?: string;
    milestone?: string;
    status?: 'active' | 'completed' | 'on-hold';
  }): Project {
    execStatement(
      this.db,
      `INSERT INTO projects (name, description, goal, content, timeline, status, creator_id, owner_id, created_at, updated_at, milestone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP}, ${SQLITE_LOCAL_TIMESTAMP}, ?)`,
      [
        data.name,
        data.description || null,
        data.goal || null,
        data.content || null,
        data.timeline || null,
        data.status || 'active',
        data.creatorId,
        data.ownerId,
        data.milestone || null
      ]
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const projectId = result[0].values[0][0] as number;
    
    saveDatabase();
    
    return this.findById(projectId)!;
  }

  update(id: number, data: Partial<Project>): Project {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.goal !== undefined) {
      fields.push('goal = ?');
      values.push(data.goal);
    }
    if (data.content !== undefined) {
      fields.push('content = ?');
      values.push(data.content);
    }
    if (data.timeline !== undefined) {
      fields.push('timeline = ?');
      values.push(data.timeline);
    }
    if (data.milestone !== undefined) {
      fields.push('milestone = ?');
      values.push(data.milestone);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.owner_id !== undefined) {
      fields.push('owner_id = ?');
      values.push(data.owner_id);
    }

    if (fields.length === 0) {
      return this.findById(id)!;
    }

    fields.push(`updated_at = ${SQLITE_LOCAL_TIMESTAMP}`);
    values.push(id);

    execStatement(
      this.db,
      `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    saveDatabase();
    return this.findById(id)!;
  }

  delete(id: number): void {
    execStatement(this.db, 'DELETE FROM projects WHERE id = ?', [id]);
    saveDatabase();
  }

  search(query: string, userId?: number, limit: number = 20): Project[] {
    let sql = `SELECT DISTINCT p.* FROM projects p`;

    const params: any[] = [];

    if (userId) {
      sql += ` INNER JOIN project_members pm ON p.id = pm.project_id`;
    }

    sql += ` WHERE (p.name LIKE ? OR p.description LIKE ?)`;
    const searchPattern = `%${query}%`;
    params.push(searchPattern, searchPattern);

    if (userId) {
      sql += ` AND pm.user_id = ?`;
      params.push(userId);
    }

    sql += ` ORDER BY p.updated_at DESC LIMIT ?`;
    params.push(limit);

    const results = execQuery(this.db, sql, params);
    return results.map(row => this.rowToProject(row)!);
  }
}
