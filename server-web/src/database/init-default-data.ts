import { getDatabaseSync } from './connection';
import { hashPassword } from '../utils/password.util';
import logger from '../utils/logger.util';
import { SQLITE_LOCAL_TIMESTAMP } from '../utils/date-time.util';

/**
 * 初始化默认数据
 * 当前仅负责创建默认管理员用户
 */
export const initializeDefaultData = async (): Promise<void> => {
  try {
    const db = getDatabaseSync();

    const result = db.exec('SELECT COUNT(*) as count FROM users');
    const userCount = result[0]?.values[0]?.[0] || 0;

    if (userCount > 0) {
      logger.info('Database already has users, skipping default data initialization');
      return;
    }

    const adminPassword = await hashPassword('123456');

    db.run(`
      INSERT INTO users (
        username,
        display_name,
        email,
        password_hash,
        avatar_url,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP}, ${SQLITE_LOCAL_TIMESTAMP})
    `, [
      'admin',
      'Administrator',
      'admin@example.com',
      adminPassword,
      null,
    ]);

    logger.info('Default admin user created (username: admin, password: 123456)');
  } catch (error) {
    logger.error('Failed to initialize default data:', error);
    throw error;
  }
};

if (require.main === module) {
  initializeDefaultData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}