const SQLITE_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export const SQLITE_LOCAL_TIMESTAMP = "strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')";

const pad = (value: number): string => String(value).padStart(2, '0');

const parseDateTimeValue = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (SQLITE_DATE_TIME_PATTERN.test(trimmed)) {
    const [datePart, timePart] = trimmed.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, second);
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatOffset = (date: Date): string => {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return `${sign}${pad(hours)}:${pad(minutes)}`;
};

export const formatLocalDatabaseDateTime = (value: Date): string => {
  return [
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`,
  ].join(' ');
};

export const formatLocalIsoDateTime = (value: unknown): string | null => {
  const date = parseDateTimeValue(value);
  if (!date) {
    return null;
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${formatOffset(date)}`;
};

export const normalizeDateTimeOutput = (value: unknown): string | null => {
  return formatLocalIsoDateTime(value);
};

export const toDatabaseDateTime = (value: unknown): string | null => {
  const date = parseDateTimeValue(value);
  return date ? formatLocalDatabaseDateTime(date) : null;
};