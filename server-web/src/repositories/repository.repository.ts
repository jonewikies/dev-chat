import { Database } from 'sql.js';
import { getDatabaseSync, saveDatabase, execQuery, execStatement } from '../database/connection';
import { Repository } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP } from '../utils/date-time.util';

export class RepositoryRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  constructor() {
    // Database will be accessed lazily via getter
  }

  private rowToRepository(row: any[]): Repository | null {
    if (!row || row.length === 0) return null;
    return {
      id: row[0],
      project_id: row[1],
      name: row[2],
      url: row[3],
      platform: row[4] as any,
      access_token: row[5] || null,
      is_active: Boolean(row[6]),
      created_at: normalizeDateTimeOutput(row[7])!,
      updated_at: normalizeDateTimeOutput(row[8])!,
    } as Repository;
  }

  findById(id: number): Repository | null {
    const results = execQuery(this.db, `SELECT * FROM repositories WHERE id = ?`, [id]);
    if (results.length === 0) return null;
    return this.rowToRepository(results[0]);
  }

  findByProject(projectId: number, filters?: {
    platform?: string;
    isActive?: boolean;
  }): Repository[] {
    let sql = `SELECT * FROM repositories WHERE project_id = ?`;
    const params: any[] = [projectId];

    if (filters?.platform) {
      sql += ` AND platform = ?`;
      params.push(filters.platform);
    }

    if (filters?.isActive !== undefined) {
      sql += ` AND is_active = ?`;
      params.push(filters.isActive ? 1 : 0);
    }

    sql += ` ORDER BY created_at DESC`;

    const results = execQuery(this.db, sql, params);
    return results.map(row => this.rowToRepository(row)).filter(repo => repo !== null) as Repository[];
  }

  create(data: {
    projectId: number;
    name: string;
    url: string;
    platform?: 'gitlab' | 'github' | 'gitea';
    accessToken?: string;
    isActive?: boolean;
  }): Repository {
    execStatement(
      this.db,
      `INSERT INTO repositories (project_id, name, url, platform, access_token, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP}, ${SQLITE_LOCAL_TIMESTAMP})`,
      [
        data.projectId,
        data.name,
        data.url,
        data.platform || 'gitlab',
        data.accessToken || null,
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
      ]
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const repoId = result[0].values[0][0] as number;
    
    saveDatabase();
    const repo = this.findById(repoId);
    if (!repo) throw new Error('Failed to create repository');
    return repo;
  }

  update(id: number, data: {
    name?: string;
    url?: string;
    platform?: 'gitlab' | 'github' | 'gitea';
    accessToken?: string;
    isActive?: boolean;
  }): Repository {
    const repo = this.findById(id);
    if (!repo) throw new Error('Repository not found');

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }

    if (data.url !== undefined) {
      updates.push('url = ?');
      params.push(data.url);
    }

    if (data.platform !== undefined) {
      updates.push('platform = ?');
      params.push(data.platform);
    }

    if (data.accessToken !== undefined) {
      updates.push('access_token = ?');
      params.push(data.accessToken);
    }

    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(data.isActive ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = ${SQLITE_LOCAL_TIMESTAMP}`);
      params.push(id);

      execStatement(
        this.db,
        `UPDATE repositories SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      saveDatabase();
    }

    const updatedRepo = this.findById(id);
    if (!updatedRepo) throw new Error('Failed to update repository');
    return updatedRepo;
  }

  delete(id: number): boolean {
    const repo = this.findById(id);
    if (!repo) return false;

    execStatement(this.db, `DELETE FROM repositories WHERE id = ?`, [id]);
    saveDatabase();
    return true;
  }

  countByProject(projectId: number, filters?: {
    platform?: string;
    isActive?: boolean;
  }): number {
    let sql = `SELECT COUNT(*) as count FROM repositories WHERE project_id = ?`;
    const params: any[] = [projectId];

    if (filters?.platform) {
      sql += ` AND platform = ?`;
      params.push(filters.platform);
    }

    if (filters?.isActive !== undefined) {
      sql += ` AND is_active = ?`;
      params.push(filters.isActive ? 1 : 0);
    }

    const results = execQuery(this.db, sql, params);
    return results[0]?.[0] || 0;
  }
}
