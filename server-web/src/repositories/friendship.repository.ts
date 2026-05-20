import { Database } from 'sql.js';
import { getDatabaseSync, saveDatabase, execQuery, execStatement } from '../database/connection';
import { Friendship } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP } from '../utils/date-time.util';

export class FriendshipRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  constructor() {
    // Database will be accessed lazily via getter
  }

  private rowToFriendship(row: any[]): Friendship | null {
    if (!row || row.length === 0) return null;
    return {
      id: row[0],
      user_id: row[1],
      friend_id: row[2],
      status: row[3] as any,
      created_at: normalizeDateTimeOutput(row[4])!,
      updated_at: normalizeDateTimeOutput(row[5])!,
    };
  }

  findById(id: number): Friendship | null {
    const results = execQuery(this.db, `SELECT * FROM friendships WHERE id = ?`, [id]);
    if (results.length === 0) return null;
    return this.rowToFriendship(results[0]);
  }

  findFriendship(userId1: number, userId2: number): Friendship | null {
    const results = execQuery(
      this.db,
      `SELECT * FROM friendships 
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [userId1, userId2, userId2, userId1]
    );
    if (results.length === 0) return null;
    return this.rowToFriendship(results[0]);
  }

  // 单向查找：只查找 user_id 添加 friend_id 的关系
  findByUserAndFriend(userId: number, friendId: number): Friendship | null {
    const results = execQuery(
      this.db,
      `SELECT * FROM friendships WHERE user_id = ? AND friend_id = ?`,
      [userId, friendId]
    );
    if (results.length === 0) return null;
    return this.rowToFriendship(results[0]);
  }

  findFriends(userId: number): Friendship[] {
    // 单向好友关系：只返回当前用户主动添加的好友
    const results = execQuery(
      this.db,
      `SELECT * FROM friendships 
       WHERE user_id = ? AND status = 'accepted'`,
      [userId]
    );
    return results.map(row => this.rowToFriendship(row)!);
  }

  findPendingRequests(userId: number): Friendship[] {
    const results = execQuery(
      this.db,
      `SELECT * FROM friendships WHERE friend_id = ? AND status = 'pending'`,
      [userId]
    );
    return results.map(row => this.rowToFriendship(row)!);
  }

  findByUsers(userId1: number, userId2: number): Friendship | null {
    const results = execQuery(
      this.db,
      `SELECT * FROM friendships 
       WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [userId1, userId2, userId2, userId1]
    );
    if (results.length === 0) return null;
    return this.rowToFriendship(results[0]);
  }

  create(userId: number, friendId: number): Friendship {
    // 直接创建 accepted 状态的好友关系（简化版本，跳过审批流程）
    execStatement(
      this.db,
      `INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at) VALUES (?, ?, 'accepted', ${SQLITE_LOCAL_TIMESTAMP}, ${SQLITE_LOCAL_TIMESTAMP})`,
      [userId, friendId]
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const friendshipId = result[0].values[0][0] as number;
    
    saveDatabase();
    
    return this.findById(friendshipId)!;
  }

  updateStatus(id: number, status: 'pending' | 'accepted' | 'rejected' | 'blocked'): Friendship {
    execStatement(
      this.db,
      `UPDATE friendships SET status = ?, updated_at = ${SQLITE_LOCAL_TIMESTAMP} WHERE id = ?`,
      [status, id]
    );
    saveDatabase();
    
    const friendship = this.findById(id);
    if (!friendship) {
      throw new Error('Friendship not found after update');
    }
    return friendship;
  }

  accept(id: number): void {
    execStatement(this.db, `UPDATE friendships SET status = 'accepted' WHERE id = ?`, [id]);
    saveDatabase();
  }

  reject(id: number): void {
    execStatement(this.db, `UPDATE friendships SET status = 'rejected' WHERE id = ?`, [id]);
    saveDatabase();
  }

  delete(id: number): void {
    execStatement(this.db, 'DELETE FROM friendships WHERE id = ?', [id]);
    saveDatabase();
  }
}
