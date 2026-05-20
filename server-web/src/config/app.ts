import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const projectRoot = path.resolve(__dirname, '../..');

const resolveProjectPath = (targetPath: string | undefined, fallbackPath: string): string => {
  const candidate = targetPath?.trim() || fallbackPath;
  return path.isAbsolute(candidate) ? candidate : path.resolve(projectRoot, candidate);
};

const defaultCorsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const parseBooleanEnv = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const corsOrigins = (process.env.CORS_ORIGIN || defaultCorsOrigins.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isPrivateIpv4 = (hostname: string): boolean => {
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;

  const match = hostname.match(/^172\.(\d{1,3})\./);
  if (!match) return false;

  const secondOctet = parseInt(match[1], 10);
  return secondOctet >= 16 && secondOctet <= 31;
};

const isAllowedDevOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && url.port === '5173'
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || isPrivateIpv4(url.hostname));
  } catch {
    return false;
  }
};

export const isAllowedCorsOrigin = (origin?: string): boolean => {
  if (!origin) {
    return true;
  }

  return corsOrigins.includes(origin) || isAllowedDevOrigin(origin);
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || '/api',

  database: {
    path: resolveProjectPath(process.env.DATABASE_PATH, './data/devchat.db'),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-this',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  },

  cors: {
    origin: corsOrigins,
    credentials: true,
  },

  upload: {
    dir: resolveProjectPath(process.env.UPLOAD_DIR, './uploads'),
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  },

  prototype: {
    dir: resolveProjectPath(process.env.PROTOTYPE_DIR, './uploads/prototypes'),
    maxArchiveSize: parseInt(process.env.PROTOTYPE_MAX_ARCHIVE_SIZE || '209715200', 10),
    maxExtractedSize: parseInt(process.env.PROTOTYPE_MAX_EXTRACTED_SIZE || '524288000', 10),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: resolveProjectPath(process.env.LOG_DIR, './logs'),
  },

  ai: {
    geminiEnabled: parseBooleanEnv(process.env.GEMINI_ENABLED, process.env.NODE_ENV !== 'test'),
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    geminiApiUrl: process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models',
    geminiTimeoutMs: parseInt(process.env.GEMINI_TIMEOUT_MS || '20000', 10),
    autoSummaryEnabled: parseBooleanEnv(process.env.AI_AUTO_SUMMARY_ENABLED, false),
    autoSummaryIntervalMs: parseInt(process.env.AI_AUTO_SUMMARY_INTERVAL_MS || '300000', 10),
    autoSummaryMinMessages: parseInt(process.env.AI_AUTO_SUMMARY_MIN_MESSAGES || '10', 10),
    autoSummaryMessageLimit: parseInt(process.env.AI_AUTO_SUMMARY_MESSAGE_LIMIT || '100', 10),
    autoSummaryCooldownMs: parseInt(process.env.AI_AUTO_SUMMARY_COOLDOWN_MS || '1800000', 10),
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || 'change-this-32-byte-hex-key',
    keyVersion: parseInt(process.env.ENCRYPTION_KEY_VERSION || '1', 10),
  },
};
