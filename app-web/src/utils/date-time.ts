const SQLITE_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

const pad = (value: number): string => String(value).padStart(2, '0');

export const parseDateTime = (value: string | Date | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const sqliteMatch = trimmed.match(SQLITE_DATE_TIME_PATTERN);
  if (sqliteMatch) {
    const [, year, month, day, hour, minute, second = '00'] = sqliteMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDateTime = (value: string | Date | null | undefined, fallback: string = '—'): string => {
  const date = parseDateTime(value);
  if (!date) {
    return fallback;
  }

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};