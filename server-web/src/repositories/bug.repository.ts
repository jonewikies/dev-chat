import { Database } from 'sql.js';
import { getDatabaseSync, saveDatabase, execQuery, execStatement } from '../database/connection';
import { Bug, BugStatusHistoryWithUser, BugWithUsers } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP } from '../utils/date-time.util';

export class BugRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  constructor() {
    // Database will be accessed lazily via getter
  }

  private rowToBug(row: any[]): Bug | null {
    if (!row || row.length === 0) return null;
    return {
      id: row[0],
      project_id: row[1],
      title: row[2],
      description: row[3] || null,
      severity: row[4] as any,
      status: row[5] as any,
      reporter_id: row[6],
      assignee_id: row[7] || null,
      images: row[8] || null,
      created_at: normalizeDateTimeOutput(row[9])!,
      updated_at: normalizeDateTimeOutput(row[10])!,
      status_note: row[11] || null,
    } as Bug;
  }

  private rowToBugWithUsers(row: any[]): BugWithUsers | null {
    if (!row || row.length === 0) return null;
    const bug: any = {
      id: row[0],
      project_id: row[1],
      title: row[2],
      description: row[3] || null,
      severity: row[4] as any,
      status: row[5] as any,
      reporter_id: row[6],
      assignee_id: row[7] || null,
      images: row[8] || null,
      created_at: normalizeDateTimeOutput(row[9])!,
      updated_at: normalizeDateTimeOutput(row[10])!,
      status_note: row[11] || null,
    };
    
    // Reporter info (from JOIN)
    if (row[12] !== null && row[12] !== undefined) {
      bug.reporter = {
        id: row[12],
        username: row[13],
        avatar: row[14] || null,
      };
    }
    
    // Assignee info (from JOIN)
    if (row[15] !== null && row[15] !== undefined) {
      bug.assignee = {
        id: row[15],
        username: row[16],
        avatar: row[17] || null,
      };
    }
    
    return bug as BugWithUsers;
  }

  private rowToBugStatusHistory(row: any[]): BugStatusHistoryWithUser | null {
    if (!row || row.length === 0) return null;

    const history: BugStatusHistoryWithUser = {
      id: row[0],
      bug_id: row[1],
      from_status: row[2] || null,
      to_status: row[3],
      note: row[4],
      changed_by: row[5],
      created_at: normalizeDateTimeOutput(row[6])!,
    };

    if (row[7] !== null && row[7] !== undefined) {
      history.changed_by_user = {
        id: row[7],
        username: row[8],
        avatar: row[9] || null,
      };
    }

    return history;
  }

  findById(id: number): Bug | null {
    const results = execQuery(this.db, `SELECT * FROM bugs WHERE id = ?`, [id]);
    if (results.length === 0) return null;
    return this.rowToBug(results[0]);
  }

  findWithUsersById(id: number): BugWithUsers | null {
    const results = execQuery(
      this.db,
      `SELECT 
        b.*,
        r.id as reporter_user_id,
        r.username as reporter_username,
        r.avatar_url as reporter_avatar,
        a.id as assignee_user_id,
        a.username as assignee_username,
        a.avatar_url as assignee_avatar
      FROM bugs b
      LEFT JOIN users r ON b.reporter_id = r.id
      LEFT JOIN users a ON b.assignee_id = a.id
      WHERE b.id = ?`,
      [id]
    );
    if (results.length === 0) return null;
    const bug = this.rowToBugWithUsers(results[0]);
    if (!bug) return null;
    bug.status_history = this.getStatusHistory(id);
    return bug;
  }

  getStatusHistory(bugId: number): BugStatusHistoryWithUser[] {
    const results = execQuery(
      this.db,
      `SELECT
        h.id,
        h.bug_id,
        h.from_status,
        h.to_status,
        h.note,
        h.changed_by,
        h.created_at,
        u.id as changed_by_user_id,
        u.username as changed_by_username,
        u.avatar_url as changed_by_avatar
      FROM bug_status_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.bug_id = ?
      ORDER BY h.created_at ASC, h.id ASC`,
      [bugId]
    );

    return results
      .map((row) => this.rowToBugStatusHistory(row))
      .filter((history) => history !== null) as BugStatusHistoryWithUser[];
  }

  createStatusHistory(data: {
    bugId: number;
    fromStatus?: 'open' | 'in-progress' | 'fixed' | 'closed';
    toStatus: 'open' | 'in-progress' | 'fixed' | 'closed';
    note: string;
    changedBy: number;
  }): void {
    execStatement(
      this.db,
      `INSERT INTO bug_status_history (bug_id, from_status, to_status, note, changed_by, created_at)
      VALUES (?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP})`,
      [data.bugId, data.fromStatus || null, data.toStatus, data.note, data.changedBy]
    );
  }

  private buildFilterClause(
    projectId: number,
    filters?: {
      status?: string | string[];
      severity?: string;
      assigneeId?: number;
      keyword?: string;
    }
  ): { whereClause: string; params: any[] } {
    let whereClause = ` WHERE b.project_id = ?`;
    const params: any[] = [projectId];

    if (filters?.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status.filter(Boolean)
        : String(filters.status)
            .split(',')
            .map(status => status.trim())
            .filter(Boolean);

      if (statuses.length === 1) {
        whereClause += ` AND b.status = ?`;
        params.push(statuses[0]);
      } else if (statuses.length > 1) {
        whereClause += ` AND b.status IN (${statuses.map(() => '?').join(', ')})`;
        params.push(...statuses);
      }
    }

    if (filters?.severity) {
      whereClause += ` AND b.severity = ?`;
      params.push(filters.severity);
    }

    if (filters?.assigneeId) {
      whereClause += ` AND b.assignee_id = ?`;
      params.push(filters.assigneeId);
    }

    if (filters?.keyword) {
      whereClause += ` AND b.title LIKE ?`;
      const keyword = `%${filters.keyword.trim()}%`;
      params.push(keyword);
    }

    return { whereClause, params };
  }

  findByProject(projectId: number, filters?: {
    status?: string | string[];
    severity?: string;
    assigneeId?: number;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): { bugs: BugWithUsers[]; total: number } {
    const { whereClause, params } = this.buildFilterClause(projectId, filters);
    const page = Math.max(1, filters?.page || 1);
    const pageSize = Math.max(1, filters?.pageSize || 10);
    const offset = (page - 1) * pageSize;

    const countSql = `SELECT COUNT(*) FROM bugs b${whereClause}`;
    const countResults = execQuery(this.db, countSql, params);
    const total = (countResults[0]?.[0] as number) || 0;

    const sql = `
      SELECT 
        b.*,
        r.id as reporter_user_id,
        r.username as reporter_username,
        r.avatar_url as reporter_avatar,
        a.id as assignee_user_id,
        a.username as assignee_username,
        a.avatar_url as assignee_avatar
      FROM bugs b
      LEFT JOIN users r ON b.reporter_id = r.id
      LEFT JOIN users a ON b.assignee_id = a.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?`;

    const results = execQuery(this.db, sql, [...params, pageSize, offset]);
    const bugs = results.map(row => this.rowToBugWithUsers(row)).filter(bug => bug !== null) as BugWithUsers[];
    return { bugs, total };
  }

  create(data: {
    projectId: number;
    title: string;
    description?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'open' | 'in-progress' | 'fixed' | 'closed';
    reporterId: number;
    assigneeId?: number;
    images?: string;
    statusNote?: string;
  }): Bug {
    execStatement(
      this.db,
      `INSERT INTO bugs (project_id, title, description, severity, status, reporter_id, assignee_id, images, status_note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP}, ${SQLITE_LOCAL_TIMESTAMP})`,
      [
        data.projectId,
        data.title,
        data.description || null,
        data.severity || 'medium',
        data.status || 'open',
        data.reporterId,
        data.assigneeId || null,
        data.images || null,
        data.statusNote || null,
      ]
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const bugId = result[0].values[0][0] as number;

    this.createStatusHistory({
      bugId,
      toStatus: data.status || 'open',
      note: (data.statusNote || '').trim() || '报告缺陷',
      changedBy: data.reporterId,
    });
    
    saveDatabase();
    const bug = this.findById(bugId);
    if (!bug) throw new Error('Failed to create bug');
    return bug;
  }

  update(id: number, data: {
    title?: string;
    description?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'open' | 'in-progress' | 'fixed' | 'closed';
    assigneeId?: number;
    images?: string;
    statusNote?: string;
    changedBy?: number;
  }): Bug {
    const bug = this.findById(id);
    if (!bug) throw new Error('Bug not found');

    const updates: string[] = [];
    const params: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }

    if (data.severity !== undefined) {
      updates.push('severity = ?');
      params.push(data.severity);
    }

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (data.assigneeId !== undefined) {
      updates.push('assignee_id = ?');
      params.push(data.assigneeId);
    }

    if (data.images !== undefined) {
      updates.push('images = ?');
      params.push(data.images);
    }

    if (data.statusNote !== undefined) {
      updates.push('status_note = ?');
      params.push(data.statusNote || null);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = ${SQLITE_LOCAL_TIMESTAMP}`);
      params.push(id);

      execStatement(
        this.db,
        `UPDATE bugs SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      if (data.status !== undefined && data.status !== bug.status && data.statusNote && data.changedBy) {
        this.createStatusHistory({
          bugId: id,
          fromStatus: bug.status,
          toStatus: data.status,
          note: data.statusNote,
          changedBy: data.changedBy,
        });
      }

      saveDatabase();
    }

    const updatedBug = this.findById(id);
    if (!updatedBug) throw new Error('Failed to update bug');
    return updatedBug;
  }

  delete(id: number): boolean {
    const bug = this.findById(id);
    if (!bug) return false;

    execStatement(this.db, `DELETE FROM bugs WHERE id = ?`, [id]);
    saveDatabase();
    return true;
  }

  countByProject(projectId: number, filters?: {
    status?: string | string[];
    severity?: string;
    assigneeId?: number;
    keyword?: string;
  }): number {
    const { whereClause, params } = this.buildFilterClause(projectId, filters);
    const sql = `SELECT COUNT(*) as count FROM bugs b${whereClause}`;
    const results = execQuery(this.db, sql, params);
    return results[0]?.[0] || 0;
  }
}
