import { closeDatabase, createBackup, execQuery, execStatement, getDatabase, saveDatabase } from './connection';
import logger from '../utils/logger.util';
import {
  decryptMessageContentWithKey,
  encryptMessageContentWithKey,
} from '../utils/message-encryption.util';

type CliOptions = {
  apply: boolean;
  force: boolean;
  oldKey: string;
  newKey: string;
  newKeyVersion: number;
};

const parseOptionValue = (argv: string[], name: string): string | undefined => {
  const prefix = `--${name}=`;
  const matched = argv.find((arg) => arg.startsWith(prefix));
  return matched ? matched.slice(prefix.length) : undefined;
};

const parseOptions = (argv: string[]): CliOptions => {
  const oldKey = parseOptionValue(argv, 'old-key') || process.env.OLD_ENCRYPTION_KEY || '';
  const newKey = parseOptionValue(argv, 'new-key') || process.env.NEW_ENCRYPTION_KEY || '';
  const versionInput = parseOptionValue(argv, 'new-key-version') || process.env.NEW_ENCRYPTION_KEY_VERSION || '2';
  const newKeyVersion = parseInt(versionInput, 10);

  if (!oldKey.trim()) {
    throw new Error('Missing old encryption key. Use OLD_ENCRYPTION_KEY or --old-key=...');
  }

  if (!newKey.trim()) {
    throw new Error('Missing new encryption key. Use NEW_ENCRYPTION_KEY or --new-key=...');
  }

  if (!Number.isFinite(newKeyVersion) || newKeyVersion <= 0) {
    throw new Error('NEW_ENCRYPTION_KEY_VERSION must be a positive integer.');
  }

  return {
    apply: argv.includes('--apply'),
    force: argv.includes('--force'),
    oldKey,
    newKey,
    newKeyVersion,
  };
};

const getMigrationName = (newKeyVersion: number): string => {
  return `message-encryption-key-rotation-v${newKeyVersion}`;
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

const hasMigrationRun = (
  db: Awaited<ReturnType<typeof getDatabase>>,
  migrationName: string
): boolean => {
  const rows = execQuery(db, 'SELECT 1 FROM app_migrations WHERE name = ? LIMIT 1', [migrationName]);
  return rows.length > 0;
};

const recordMigration = (
  db: Awaited<ReturnType<typeof getDatabase>>,
  migrationName: string,
  details: Record<string, unknown>
) => {
  execStatement(
    db,
    `INSERT INTO app_migrations (name, executed_at, details)
     VALUES (?, strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'), ?)`,
    [migrationName, JSON.stringify(details)]
  );
};

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const migrationName = getMigrationName(options.newKeyVersion);
  const db = await getDatabase();

  try {
    ensureMigrationTable(db);

    if (hasMigrationRun(db, migrationName) && !options.force) {
      logger.info(`Migration ${migrationName} already recorded. Use --force to run again.`);
      return;
    }

    const rows = execQuery(
      db,
      `SELECT id, content, content_iv, content_tag, content_key_version
       FROM messages
       ORDER BY id ASC`
    );

    const targetRows = rows.filter((row) => Number(row[4] || 0) !== options.newKeyVersion);

    logger.info(
      `Message key rotation mode=${options.apply ? 'apply' : 'dry-run'} targetRows=${targetRows.length} newKeyVersion=${options.newKeyVersion}`
    );

    if (!options.apply) {
      if (targetRows.length > 0) {
        logger.info(`Dry-run preview: first target message ids = ${targetRows.slice(0, 20).map((row) => row[0]).join(', ')}`);
      }
      logger.info('Dry-run completed. Re-run with --apply to persist changes.');
      return;
    }

    if (targetRows.length === 0) {
      recordMigration(db, migrationName, {
        updatedRows: 0,
        newKeyVersion: options.newKeyVersion,
      });
      saveDatabase();
      logger.info('No messages require key rotation. Migration recorded without changes.');
      return;
    }

    createBackup();

    targetRows.forEach(([id, content, iv, tag]) => {
      const plaintext = iv && tag
        ? decryptMessageContentWithKey(
            {
              ciphertext: String(content || ''),
              iv: String(iv || ''),
              tag: String(tag || ''),
            },
            options.oldKey
          )
        : String(content || '');

      const encrypted = encryptMessageContentWithKey(plaintext, options.newKey, options.newKeyVersion);

      execStatement(
        db,
        `UPDATE messages
         SET content = ?, content_iv = ?, content_tag = ?, content_key_version = ?
         WHERE id = ?`,
        [encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.keyVersion, id]
      );
    });

    recordMigration(db, migrationName, {
      updatedRows: targetRows.length,
      newKeyVersion: options.newKeyVersion,
      firstMessageId: targetRows[0]?.[0] || null,
      lastMessageId: targetRows[targetRows.length - 1]?.[0] || null,
    });

    saveDatabase();
    logger.info(`Message key rotation completed. updatedRows=${targetRows.length} newKeyVersion=${options.newKeyVersion}`);
  } finally {
    closeDatabase();
  }
}

main().catch((error) => {
  logger.error('Failed to rotate message encryption key:', error);
  closeDatabase();
  process.exit(1);
});