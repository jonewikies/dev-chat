import { Database } from 'sql.js';
import { getDatabaseSync, saveDatabase, execQuery, execStatement } from '../database/connection';
import { User } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP, toDatabaseDateTime } from '../utils/date-time.util';

export class UserRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  constructor() {
    // Database will be accessed lazily via getter
  }

  private rowToUser(row: any[]): User | null {
    if (!row || row.length === 0) return null;
    return {
      id: row[0],
      username: row[1],
      password_hash: row[2],
      email: row[3],
      display_name: row[4],
      avatar_url: row[5],
      is_super_admin: Boolean(row[6]),
      is_online: Boolean(row[7]),
      last_seen_at: normalizeDateTimeOutput(row[8]) || undefined,
      created_at: normalizeDateTimeOutput(row[9])!,
      updated_at: normalizeDateTimeOutput(row[10])!,
    };
  }

  findById(id: number): User | null {
    const results = execQuery(this.db, `SELECT * FROM users WHERE id = ?`, [id]);
    if (results.length === 0) return null;
    return this.rowToUser(results[0]);
  }

  findByUsername(username: string): User | null {
    const results = execQuery(this.db, `SELECT * FROM users WHERE username = ?`, [username]);
    if (results.length === 0) return null;
    return this.rowToUser(results[0]);
  }

  findByEmail(email: string): User | null {
    const results = execQuery(this.db, `SELECT * FROM users WHERE email = ?`, [email]);
    if (results.length === 0) return null;
    return this.rowToUser(results[0]);
  }

  countAll(): number {
    const results = execQuery(this.db, 'SELECT COUNT(*) as count FROM users');
    return results.length === 0 ? 0 : (results[0][0] as number);
  }

  countSuperAdmins(): number {
    const results = execQuery(this.db, 'SELECT COUNT(*) as count FROM users WHERE is_super_admin = 1');
    return results.length === 0 ? 0 : (results[0][0] as number);
  }

  listAll(limit: number = 100, offset: number = 0, query?: string): User[] {
    const normalizedQuery = query?.trim();

    if (normalizedQuery) {
      const searchPattern = `%${normalizedQuery}%`;
      const results = execQuery(
        this.db,
        `SELECT * FROM users
         WHERE username LIKE ? OR display_name LIKE ? OR email LIKE ?
         ORDER BY id DESC
         LIMIT ? OFFSET ?`,
        [searchPattern, searchPattern, searchPattern, limit, offset]
      );

      return results.map((row) => this.rowToUser(row)!);
    }

    const results = execQuery(
      this.db,
      `SELECT * FROM users
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return results.map((row) => this.rowToUser(row)!);
  }

  countAllByQuery(query?: string): number {
    const normalizedQuery = query?.trim();

    if (normalizedQuery) {
      const searchPattern = `%${normalizedQuery}%`;
      const results = execQuery(
        this.db,
        `SELECT COUNT(*) as count FROM users
         WHERE username LIKE ? OR display_name LIKE ? OR email LIKE ?`,
        [searchPattern, searchPattern, searchPattern]
      );

      return results.length === 0 ? 0 : (results[0][0] as number);
    }

    return this.countAll();
  }

  create(data: {
    username: string;
    passwordHash: string;
    email?: string;
    displayName?: string;
    isSuperAdmin?: boolean;
  }): User {
    execStatement(
      this.db,
      `INSERT INTO users (username, password_hash, email, display_name, is_super_admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP}, ${SQLITE_LOCAL_TIMESTAMP})`,
      [data.username, data.passwordHash, data.email || null, data.displayName || data.username, data.isSuperAdmin ? 1 : 0]
    );

    // IMPORTANT: Get last_insert_rowid BEFORE saveDatabase!
    // saveDatabase() resets last_insert_rowid to 0
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const userId = result[0].values[0][0] as number;

    saveDatabase();

    const user = this.findById(userId);
    if (!user) {
      throw new Error(`Failed to find user after creation. userId: ${userId}`);
    }

    return user;
  }

  update(id: number, data: Partial<User>): User {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.display_name !== undefined) {
      fields.push('display_name = ?');
      values.push(data.display_name);
    }
    if (data.email !== undefined) {
      fields.push('email = ?');
      values.push(data.email);
    }
    if (data.avatar_url !== undefined) {
      fields.push('avatar_url = ?');
      values.push(data.avatar_url);
    }
    if (data.password_hash !== undefined) {
      fields.push('password_hash = ?');
      values.push(data.password_hash);
    }
    if (data.is_super_admin !== undefined) {
      fields.push('is_super_admin = ?');
      values.push(data.is_super_admin ? 1 : 0);
    }
    if (data.is_online !== undefined) {
      fields.push('is_online = ?');
      values.push(data.is_online ? 1 : 0);
    }
    if (data.last_seen_at !== undefined) {
      fields.push('last_seen_at = ?');
      values.push(toDatabaseDateTime(data.last_seen_at));
    }

    if (fields.length === 0) {
      return this.findById(id)!;
    }

    fields.push(`updated_at = ${SQLITE_LOCAL_TIMESTAMP}`);
    values.push(id);

    execStatement(
      this.db,
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    saveDatabase();
    return this.findById(id)!;
  }

  setOnlineStatus(id: number, isOnline: boolean): void {
    execStatement(
      this.db,
      `UPDATE users 
       SET is_online = ?, last_seen_at = ${SQLITE_LOCAL_TIMESTAMP}, updated_at = ${SQLITE_LOCAL_TIMESTAMP}
       WHERE id = ?`,
      [isOnline ? 1 : 0, id]
    );
    saveDatabase();
  }

  search(query: string, limit: number = 20, offset: number = 0): User[] {
    const searchPattern = `%${query}%`;
    const results = execQuery(
      this.db,
      `SELECT * FROM users 
       WHERE username LIKE ? OR display_name LIKE ?
       LIMIT ? OFFSET ?`,
      [searchPattern, searchPattern, limit, offset]
    );

    return results.map(row => this.rowToUser(row)!);
  }

  countSearch(query: string): number {
    const searchPattern = `%${query}%`;
    const results = execQuery(
      this.db,
      `SELECT COUNT(*) as count FROM users 
       WHERE username LIKE ? OR display_name LIKE ?`,
      [searchPattern, searchPattern]
    );

    if (results.length === 0) return 0;
    return results[0][0] as number;
  }

  delete(id: number): void {
    execStatement(this.db, 'DELETE FROM users WHERE id = ?', [id]);
    saveDatabase();
  }
}
