import { Database } from 'sql.js';
import { getDatabaseSync, saveDatabase, execQuery, execStatement } from '../database/connection';
import { ProjectMember } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP } from '../utils/date-time.util';

export class ProjectMemberRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  constructor() {
    // Database will be accessed lazily via getter
  }

  private rowToProjectMember(row: any[]): ProjectMember | null {
    if (!row || row.length === 0) return null;
    return {
      id: row[0],
      project_id: row[1],
      user_id: row[2],
      role: row[3] as any,
      joined_at: normalizeDateTimeOutput(row[4])!,
    };
  }

  findByProjectAndUser(projectId: number, userId: number): ProjectMember | null {
    const results = execQuery(
      this.db,
      `SELECT * FROM project_members WHERE project_id = ? AND user_id = ?`,
      [projectId, userId]
    );
    if (results.length === 0) return null;
    return this.rowToProjectMember(results[0]);
  }

  findByProject(projectId: number): ProjectMember[] {
    const results = execQuery(
      this.db,
      `SELECT * FROM project_members WHERE project_id = ?`,
      [projectId]
    );
    return results.map(row => this.rowToProjectMember(row)!);
  }

  create(data: {
    projectId: number;
    userId: number;
    role: 'owner' | 'member' | 'viewer';
  }): ProjectMember {
    execStatement(
      this.db,
      `INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP})`,
      [data.projectId, data.userId, data.role]
    );
    
    saveDatabase();
    
    return this.findByProjectAndUser(data.projectId, data.userId)!;
  }

  updateRole(projectId: number, userId: number, role: string) {
    execStatement(
      this.db,
      `UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?`,
      [role, projectId, userId]
    );
    saveDatabase();
    
    return this.findByProjectAndUser(projectId, userId);
  }

  delete(projectId: number, userId: number): void {
    execStatement(
      this.db,
      `DELETE FROM project_members WHERE project_id = ? AND user_id = ?`,
      [projectId, userId]
    );
    saveDatabase();
  }
}
