import { Database } from 'sql.js';
import { execQuery, execStatement, getDatabaseSync, saveDatabase } from '../database/connection';
import { ProjectPrototype } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP } from '../utils/date-time.util';

export class ProjectPrototypeRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  private rowToPrototype(row: any[]): ProjectPrototype | null {
    if (!row || row.length === 0) return null;

    return {
      id: row[0],
      project_id: row[1],
      name: row[2],
      description: row[3] || undefined,
      archive_file_name: row[4],
      archive_file_path: row[5],
      archive_size: Number(row[6] || 0),
      extracted_dir: row[7],
      entry_file: row[8],
      preview_key: row[9],
      uploader_id: row[10],
      created_at: normalizeDateTimeOutput(row[11])!,
      updated_at: normalizeDateTimeOutput(row[12])!,
    };
  }

  findById(id: number): ProjectPrototype | null {
    const rows = execQuery(this.db, 'SELECT * FROM project_prototypes WHERE id = ?', [id]);
    return rows.length > 0 ? this.rowToPrototype(rows[0]) : null;
  }

  findByPreviewKey(previewKey: string): ProjectPrototype | null {
    const rows = execQuery(this.db, 'SELECT * FROM project_prototypes WHERE preview_key = ?', [previewKey]);
    return rows.length > 0 ? this.rowToPrototype(rows[0]) : null;
  }

  findByProject(projectId: number): ProjectPrototype[] {
    const rows = execQuery(
      this.db,
      'SELECT * FROM project_prototypes WHERE project_id = ? ORDER BY updated_at DESC, created_at DESC',
      [projectId]
    );
    return rows.map((row) => this.rowToPrototype(row)).filter(Boolean) as ProjectPrototype[];
  }

  create(data: {
    projectId: number;
    name: string;
    description?: string;
    archiveFileName: string;
    archiveFilePath: string;
    archiveSize: number;
    extractedDir: string;
    entryFile: string;
    previewKey: string;
    uploaderId: number;
  }): ProjectPrototype {
    execStatement(
      this.db,
      `INSERT INTO project_prototypes (
        project_id, name, description, archive_file_name, archive_file_path, archive_size,
        extracted_dir, entry_file, preview_key, uploader_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP}, ${SQLITE_LOCAL_TIMESTAMP})`,
      [
        data.projectId,
        data.name,
        data.description || null,
        data.archiveFileName,
        data.archiveFilePath,
        data.archiveSize,
        data.extractedDir,
        data.entryFile,
        data.previewKey,
        data.uploaderId,
      ]
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const prototypeId = result[0].values[0][0] as number;
    saveDatabase();
    const prototype = this.findById(prototypeId);
    if (!prototype) {
      throw new Error('Failed to create project prototype');
    }
    return prototype;
  }

  update(id: number, data: {
    name?: string;
    description?: string | null;
    archiveFileName?: string;
    archiveFilePath?: string;
    archiveSize?: number;
    extractedDir?: string;
    entryFile?: string;
    previewKey?: string;
  }): ProjectPrototype {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.archiveFileName !== undefined) {
      updates.push('archive_file_name = ?');
      params.push(data.archiveFileName);
    }
    if (data.archiveFilePath !== undefined) {
      updates.push('archive_file_path = ?');
      params.push(data.archiveFilePath);
    }
    if (data.archiveSize !== undefined) {
      updates.push('archive_size = ?');
      params.push(data.archiveSize);
    }
    if (data.extractedDir !== undefined) {
      updates.push('extracted_dir = ?');
      params.push(data.extractedDir);
    }
    if (data.entryFile !== undefined) {
      updates.push('entry_file = ?');
      params.push(data.entryFile);
    }
    if (data.previewKey !== undefined) {
      updates.push('preview_key = ?');
      params.push(data.previewKey);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = ${SQLITE_LOCAL_TIMESTAMP}`);
      params.push(id);
      execStatement(this.db, `UPDATE project_prototypes SET ${updates.join(', ')} WHERE id = ?`, params);
      saveDatabase();
    }

    const prototype = this.findById(id);
    if (!prototype) {
      throw new Error('Failed to update project prototype');
    }
    return prototype;
  }

  delete(id: number): void {
    execStatement(this.db, 'DELETE FROM project_prototypes WHERE id = ?', [id]);
    saveDatabase();
  }
}