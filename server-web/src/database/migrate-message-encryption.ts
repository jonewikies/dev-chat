import { closeDatabase, createBackup, execQuery, execStatement, getDatabase, saveDatabase } from './connection';
import logger from '../utils/logger.util';
import { encryptMessageContent, getMessageEncryptionKeyVersion } from '../utils/message-encryption.util';

const MIGRATION_NAME = '2026-03-17-message-encryption-backfill';

type CliOptions = {
  apply: boolean;
  force: boolean;
};

const parseOptions = (argv: string[]): CliOptions => {
  return {
    apply: argv.includes('--apply'),
    force: argv.includes('--force'),
  };
};

const ensureMigrationTable = (db: Awaited<ReturnType<typeof getDatabase>>) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at DATETIME NOT NULL,
      details TEXT
    )
  `);
};

const hasMigrationRun = (db: Awaited<ReturnType<typeof getDatabase>>): boolean => {
  const rows = execQuery(db, 'SELECT 1 FROM app_migrations WHERE name = ? LIMIT 1', [MIGRATION_NAME]);
  return rows.length > 0;
};

const recordMigration = (
  db: Awaited<ReturnType<typeof getDatabase>>,
  details: Record<string, unknown>
) => {
  execStatement(
    db,
    `INSERT INTO app_migrations (name, executed_at, details)
     VALUES (?, strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'), ?)`,
    [MIGRATION_NAME, JSON.stringify(details)]
  );
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const db = await getDatabase();

  try {
    ensureMigrationTable(db);

    if (hasMigrationRun(db) && !options.force) {
      logger.info(`Migration ${MIGRATION_NAME} already recorded. Use --force to run again.`);
      return;
    }

    const rows = execQuery(
      db,
      `SELECT id, content
       FROM messages
       WHERE (content_iv IS NULL OR content_iv = '')
         OR (content_tag IS NULL OR content_tag = '')
       ORDER BY id ASC`
    );

    logger.info(`Message encryption backfill mode=${options.apply ? 'apply' : 'dry-run'} pendingRows=${rows.length}`);

    if (!options.apply) {
      if (rows.length > 0) {
        logger.info(`Dry-run preview: first pending message ids = ${rows.slice(0, 20).map((row) => row[0]).join(', ')}`);
      }
      logger.info('Dry-run completed. Re-run with --apply to persist changes.');
      return;
    }

    if (rows.length === 0) {
      recordMigration(db, { updatedRows: 0, keyVersion: getMessageEncryptionKeyVersion() });
      saveDatabase();
      logger.info('No legacy plaintext messages found. Migration recorded without changes.');
      return;
    }

    createBackup();

    rows.forEach(([id, content]) => {
      const encrypted = encryptMessageContent(String(content || ''));
      execStatement(
        db,
        `UPDATE messages
         SET content = ?, content_iv = ?, content_tag = ?, content_key_version = ?
         WHERE id = ?`,
        [encrypted.ciphertext, encrypted.iv, encrypted.tag, getMessageEncryptionKeyVersion(), id]
      );
    });

    recordMigration(db, {
      updatedRows: rows.length,
      keyVersion: getMessageEncryptionKeyVersion(),
      firstMessageId: rows[0]?.[0] || null,
      lastMessageId: rows[rows.length - 1]?.[0] || null,
    });

    saveDatabase();
    logger.info(`Message encryption migration completed. updatedRows=${rows.length}`);
  } finally {
    closeDatabase();
  }
}

main().catch((error) => {
  logger.error('Failed to backfill encrypted messages:', error);
  closeDatabase();
  process.exit(1);
});