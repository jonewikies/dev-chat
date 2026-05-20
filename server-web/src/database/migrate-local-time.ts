import { createBackup, getDatabase, saveDatabase, closeDatabase } from './connection';
import logger from '../utils/logger.util';
import { formatLocalDatabaseDateTime } from '../utils/date-time.util';

const MIGRATION_NAME = '2026-03-11-local-time-backfill';
const SQLITE_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

type MigrationTarget = {
  table: string;
  primaryKey: string;
  columns: string[];
};

type CliOptions = {
  apply: boolean;
  force: boolean;
  before: Date | null;
};

const targets: MigrationTarget[] = [
  { table: 'users', primaryKey: 'id', columns: ['last_seen_at', 'created_at', 'updated_at'] },
  { table: 'friendships', primaryKey: 'id', columns: ['created_at', 'updated_at'] },
  { table: 'projects', primaryKey: 'id', columns: ['created_at', 'updated_at'] },
  { table: 'project_members', primaryKey: 'id', columns: ['joined_at'] },
  { table: 'chats', primaryKey: 'id', columns: ['created_at', 'updated_at'] },
  { table: 'chat_members', primaryKey: 'id', columns: ['joined_at'] },
  { table: 'messages', primaryKey: 'id', columns: ['created_at', 'updated_at'] },
  { table: 'tasks', primaryKey: 'id', columns: ['created_at', 'updated_at'] },
  { table: 'bugs', primaryKey: 'id', columns: ['created_at', 'updated_at'] },
  { table: 'documents', primaryKey: 'id', columns: ['created_at', 'updated_at'] },
  { table: 'document_comments', primaryKey: 'id', columns: ['created_at'] },
  { table: 'repositories', primaryKey: 'id', columns: ['created_at', 'updated_at'] },
  { table: 'project_prototypes', primaryKey: 'id', columns: ['created_at', 'updated_at'] },
  { table: 'files', primaryKey: 'id', columns: ['created_at'] },
  { table: 'ai_analyses', primaryKey: 'id', columns: ['created_at'] },
  { table: 'ai_analysis_messages', primaryKey: 'id', columns: ['created_at'] },
  { table: 'message_attachments', primaryKey: 'id', columns: ['created_at'] },
  { table: 'document_attachments', primaryKey: 'id', columns: ['created_at'] },
  { table: 'user_avatars', primaryKey: 'id', columns: ['created_at'] },
];

const pad = (value: number): string => String(value).padStart(2, '0');

const parseCliDate = (input: string): Date | null => {
  const normalized = input.trim();
  if (!normalized) {
    return null;
  }

  const sqliteMatch = normalized.match(SQLITE_DATE_TIME_PATTERN);
  if (sqliteMatch) {
    const [, year, month, day, hour, minute, second] = sqliteMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseUtcDatabaseTimestamp = (value: unknown): Date | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(SQLITE_DATE_TIME_PATTERN);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ));
};

const formatInstantForLog = (value: Date | null): string => {
  if (!value) {
    return 'none';
  }

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
};

const parseOptions = (argv: string[]): CliOptions => {
  let apply = false;
  let force = false;
  let before: Date | null = null;

  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true;
      continue;
    }

    if (arg === '--force') {
      force = true;
      continue;
    }

    if (arg.startsWith('--before=')) {
      before = parseCliDate(arg.slice('--before='.length));
      continue;
    }
  }

  if (argv.some((arg) => arg.startsWith('--before=')) && !before) {
    throw new Error('Invalid --before value. Use local time such as 2026-03-11 18:30:00 or an ISO string.');
  }

  return { apply, force, before };
};

const ensureMigrationTable = (db: ReturnType<typeof getDatabase> extends Promise<infer T> ? T : never) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at DATETIME NOT NULL,
      details TEXT
    )
  `);
};

const hasMigrationRun = (db: ReturnType<typeof getDatabase> extends Promise<infer T> ? T : never): boolean => {
  const result = db.exec(`SELECT 1 FROM app_migrations WHERE name = '${MIGRATION_NAME}' LIMIT 1`);
  return Boolean(result[0]?.values?.length);
};

const recordMigration = (db: ReturnType<typeof getDatabase> extends Promise<infer T> ? T : never, details: Record<string, unknown>) => {
  const stmt = db.prepare(`INSERT INTO app_migrations (name, executed_at, details) VALUES (?, ?, ?)`);
  stmt.bind([MIGRATION_NAME, formatLocalDatabaseDateTime(new Date()), JSON.stringify(details)]);
  stmt.step();
  stmt.free();
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

    const summary: Record<string, number> = {};
    let totalRows = 0;
    let totalCells = 0;

    logger.info(`Starting local-time backfill. mode=${options.apply ? 'apply' : 'dry-run'} before=${formatInstantForLog(options.before)}`);

    if (options.apply) {
      createBackup();
    }

    for (const target of targets) {
      const tableInfo = db.exec(`PRAGMA table_info(${target.table})`);
      const existingColumns = new Set((tableInfo[0]?.values || []).map((row) => String(row[1])));
      const activeColumns = target.columns.filter((column) => existingColumns.has(column));

      if (activeColumns.length === 0 || !existingColumns.has(target.primaryKey)) {
        continue;
      }

      const sql = `SELECT ${[target.primaryKey, ...activeColumns].join(', ')} FROM ${target.table}`;
      const result = db.exec(sql);
      const rows = result[0]?.values || [];
      let tableRowsChanged = 0;
      let tableCellsChanged = 0;

      for (const row of rows) {
        const primaryKeyValue = row[0];
        const updates: Array<{ column: string; value: string }> = [];

        activeColumns.forEach((column, index) => {
          const currentValue = row[index + 1];
          const utcDate = parseUtcDatabaseTimestamp(currentValue);
          if (!utcDate) {
            return;
          }

          if (options.before && utcDate.getTime() > options.before.getTime()) {
            return;
          }

          const nextValue = formatLocalDatabaseDateTime(utcDate);
          if (nextValue !== currentValue) {
            updates.push({ column, value: nextValue });
          }
        });

        if (updates.length === 0) {
          continue;
        }

        tableRowsChanged += 1;
        tableCellsChanged += updates.length;

        if (options.apply) {
          const updateSql = `UPDATE ${target.table} SET ${updates.map((item) => `${item.column} = ?`).join(', ')} WHERE ${target.primaryKey} = ?`;
          const stmt = db.prepare(updateSql);
          stmt.bind([...updates.map((item) => item.value), primaryKeyValue]);
          stmt.step();
          stmt.free();
        }
      }

      if (tableRowsChanged > 0) {
        summary[target.table] = tableRowsChanged;
        totalRows += tableRowsChanged;
        totalCells += tableCellsChanged;
        logger.info(`${target.table}: rows=${tableRowsChanged}, cells=${tableCellsChanged}`);
      }
    }

    logger.info(`Local-time backfill summary: rows=${totalRows}, cells=${totalCells}`);

    if (!options.apply) {
      logger.info('Dry-run completed. Re-run with --apply to persist changes.');
      return;
    }

    recordMigration(db, {
      before: options.before ? formatLocalDatabaseDateTime(options.before) : null,
      totalRows,
      totalCells,
      summary,
    });
    saveDatabase();
    logger.info(`Migration ${MIGRATION_NAME} completed successfully.`);
  } finally {
    closeDatabase();
  }
}

main().catch((error) => {
  logger.error('Failed to migrate legacy timestamps:', error);
  closeDatabase();
  process.exit(1);
});