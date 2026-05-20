import { Database } from 'sql.js';
import { getDatabaseSync, saveDatabase, execQuery, execStatement } from '../database/connection';
import { Task, TaskStatusHistoryWithUser, TaskWithAssignee } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP } from '../utils/date-time.util';

export class TaskRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  constructor() {
    // Database will be accessed lazily via getter
  }

  private rowToTask(row: any[]): Task | null {
    if (!row || row.length === 0) return null;
    return {
      id: row[0],
      project_id: row[1],
      title: row[2],
      description: row[3] || null,
      status: row[4] as any,
      status_note: row[5] || null,
      priority: row[6] as any,
      progress: row[7] || 0,
      assignee_id: row[8] || null,
      start_date: row[9] || null,
      end_date: row[10] || null,
      created_by: row[11],
      created_at: normalizeDateTimeOutput(row[12])!,
      updated_at: normalizeDateTimeOutput(row[13])!,
    } as Task;
  }

  private rowToTaskWithAssignee(row: any[]): TaskWithAssignee | null {
    if (!row || row.length === 0) return null;
    const task: any = {
      id: row[0],
      project_id: row[1],
      title: row[2],
      description: row[3] || null,
      status: row[4] as any,
      status_note: row[5] || null,
      priority: row[6] as any,
      progress: row[7] || 0,
      assignee_id: row[8] || null,
      start_date: row[9] || null,
      end_date: row[10] || null,
      created_by: row[11],
      created_at: normalizeDateTimeOutput(row[12])!,
      updated_at: normalizeDateTimeOutput(row[13])!,
    };
    
    // If assignee info is available (from JOIN)
    if (row[14] !== null && row[14] !== undefined) {
      task.assignee = {
        id: row[14],
        username: row[15],
        avatar: row[16] || null,
      };
    }
    
    return task as TaskWithAssignee;
  }

  private rowToTaskStatusHistory(row: any[]): TaskStatusHistoryWithUser | null {
    if (!row || row.length === 0) return null;

    const history: TaskStatusHistoryWithUser = {
      id: row[0],
      task_id: row[1],
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

  findById(id: number): Task | null {
    const results = execQuery(
      this.db,
      `SELECT
        id,
        project_id,
        title,
        description,
        status,
        status_note,
        priority,
        progress,
        assignee_id,
        start_date,
        end_date,
        created_by,
        created_at,
        updated_at
      FROM tasks
      WHERE id = ?`,
      [id]
    );
    if (results.length === 0) return null;
    return this.rowToTask(results[0]);
  }

  findWithAssigneeById(id: number): TaskWithAssignee | null {
    const results = execQuery(
      this.db,
      `SELECT 
        t.id,
        t.project_id,
        t.title,
        t.description,
        t.status,
        t.status_note,
        t.priority,
        t.progress,
        t.assignee_id,
        t.start_date,
        t.end_date,
        t.created_by,
        t.created_at,
        t.updated_at,
        u.id as assignee_user_id,
        u.username as assignee_username,
        u.avatar_url as assignee_avatar
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.id = ?`,
      [id]
    );
    if (results.length === 0) return null;
    const task = this.rowToTaskWithAssignee(results[0]);
    if (!task) return null;
    task.status_history = this.getStatusHistory(id);
    return task;
  }

  getStatusHistory(taskId: number): TaskStatusHistoryWithUser[] {
    const results = execQuery(
      this.db,
      `SELECT
        h.id,
        h.task_id,
        h.from_status,
        h.to_status,
        h.note,
        h.changed_by,
        h.created_at,
        u.id as changed_by_user_id,
        u.username as changed_by_username,
        u.avatar_url as changed_by_avatar
      FROM task_status_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.task_id = ?
      ORDER BY h.created_at ASC, h.id ASC`,
      [taskId]
    );

    return results
      .map((row) => this.rowToTaskStatusHistory(row))
      .filter((history) => history !== null) as TaskStatusHistoryWithUser[];
  }

  createStatusHistory(data: {
    taskId: number;
    fromStatus?: 'todo' | 'in-progress' | 'done';
    toStatus: 'todo' | 'in-progress' | 'done';
    note: string;
    changedBy: number;
  }): void {
    execStatement(
      this.db,
      `INSERT INTO task_status_history (task_id, from_status, to_status, note, changed_by, created_at)
       VALUES (?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP})`,
      [data.taskId, data.fromStatus || null, data.toStatus, data.note, data.changedBy]
    );
  }

  private buildFilterClause(
    projectId: number,
    filters?: {
      status?: string | string[];
      priority?: string;
      assigneeId?: number;
      keyword?: string;
    }
  ): { whereClause: string; params: any[] } {
    let whereClause = ` WHERE t.project_id = ?`;
    const params: any[] = [projectId];

    if (filters?.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status.filter(Boolean)
        : String(filters.status)
            .split(',')
            .map(status => status.trim())
            .filter(Boolean);

      if (statuses.length === 1) {
        whereClause += ` AND t.status = ?`;
        params.push(statuses[0]);
      } else if (statuses.length > 1) {
        whereClause += ` AND t.status IN (${statuses.map(() => '?').join(', ')})`;
        params.push(...statuses);
      }
    }

    if (filters?.priority) {
      whereClause += ` AND t.priority = ?`;
      params.push(filters.priority);
    }

    if (filters?.assigneeId) {
      whereClause += ` AND t.assignee_id = ?`;
      params.push(filters.assigneeId);
    }

    if (filters?.keyword) {
      whereClause += ` AND (t.title LIKE ? OR t.description LIKE ?)`;
      const keyword = `%${filters.keyword.trim()}%`;
      params.push(keyword, keyword);
    }

    return { whereClause, params };
  }

  findByProject(projectId: number, filters?: {
    status?: string | string[];
    priority?: string;
    assigneeId?: number;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): { tasks: TaskWithAssignee[]; total: number } {
    const { whereClause, params } = this.buildFilterClause(projectId, filters);
    const page = Math.max(1, filters?.page || 1);
    const pageSize = Math.max(1, filters?.pageSize || 10);
    const offset = (page - 1) * pageSize;

    const countSql = `SELECT COUNT(*) FROM tasks t${whereClause}`;
    const countResults = execQuery(this.db, countSql, params);
    const total = (countResults[0]?.[0] as number) || 0;

    const sql = `
      SELECT 
        t.id,
        t.project_id,
        t.title,
        t.description,
        t.status,
        t.status_note,
        t.priority,
        t.progress,
        t.assignee_id,
        t.start_date,
        t.end_date,
        t.created_by,
        t.created_at,
        t.updated_at,
        u.id as assignee_user_id,
        u.username as assignee_username,
        u.avatar_url as assignee_avatar
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?`;

    const results = execQuery(this.db, sql, [...params, pageSize, offset]);
    return {
      tasks: results.map(row => this.rowToTaskWithAssignee(row)!).filter(Boolean),
      total,
    };
  }

  create(data: {
    projectId: number;
    title: string;
    description?: string;
    status?: 'todo' | 'in-progress' | 'done';
    statusNote?: string;
    priority?: 'low' | 'medium' | 'high';
    assigneeId?: number;
    startDate?: string;
    endDate?: string;
    createdBy: number;
  }): Task {
    execStatement(
      this.db,
      `INSERT INTO tasks 
       (project_id, title, description, status, status_note, priority, assignee_id, start_date, end_date, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP}, ${SQLITE_LOCAL_TIMESTAMP})`,
      [
        data.projectId,
        data.title,
        data.description || null,
        data.status || 'todo',
        data.statusNote || null,
        data.priority || 'medium',
        data.assigneeId || null,
        data.startDate || null,
        data.endDate || null,
        data.createdBy
      ]
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const taskId = result[0].values[0][0] as number;

    this.createStatusHistory({
      taskId,
      toStatus: data.status || 'todo',
      note: (data.statusNote || '').trim() || '创建任务',
      changedBy: data.createdBy,
    });
    
    saveDatabase();
    
    return this.findById(taskId)!;
  }

  update(id: number, data: Partial<Task> & { changedBy?: number }): Task {
    const task = this.findById(id);
    if (!task) throw new Error('Task not found');

    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.status_note !== undefined) {
      fields.push('status_note = ?');
      values.push(data.status_note);
    }
    if (data.priority !== undefined) {
      fields.push('priority = ?');
      values.push(data.priority);
    }
    if (data.progress !== undefined) {
      fields.push('progress = ?');
      values.push(data.progress);
    }
    if (data.assignee_id !== undefined) {
      fields.push('assignee_id = ?');
      values.push(data.assignee_id);
    }
    if (data.start_date !== undefined) {
      fields.push('start_date = ?');
      values.push(data.start_date);
    }
    if (data.end_date !== undefined) {
      fields.push('end_date = ?');
      values.push(data.end_date);
    }

    if (fields.length === 0) {
      return task;
    }

    const statusChanged = data.status !== undefined && data.status !== task.status;
    const progressChanged = data.progress !== undefined && data.progress !== task.progress;
    const statusNote = (data.status_note || '').trim();

    fields.push(`updated_at = ${SQLITE_LOCAL_TIMESTAMP}`);
    values.push(id);

    execStatement(this.db, `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);

    if ((statusChanged || progressChanged) && data.changedBy && statusNote) {
      this.createStatusHistory({
        taskId: id,
        fromStatus: task.status,
        toStatus: data.status || task.status,
        note: statusNote,
        changedBy: data.changedBy,
      });
    }

    saveDatabase();
    return this.findById(id)!;
  }

  delete(id: number): void {
    execStatement(this.db, 'DELETE FROM tasks WHERE id = ?', [id]);
    saveDatabase();
  }
}
