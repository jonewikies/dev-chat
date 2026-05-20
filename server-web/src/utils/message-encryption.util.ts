import crypto from 'crypto';
import { config } from '../config/app';

const MESSAGE_ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const MESSAGE_ENCRYPTION_IV_LENGTH = 12;

const deriveEncryptionKey = (rawKey: string): Buffer => {
  const normalizedKey = String(rawKey || '').trim();

  if (/^[0-9a-fA-F]{64}$/.test(normalizedKey)) {
    return Buffer.from(normalizedKey, 'hex');
  }

  return crypto.createHash('sha256').update(normalizedKey, 'utf8').digest();
};

export const encryptMessageContentWithKey = (
  content: string,
  rawKey: string,
  keyVersion: number
): {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
} => {
  const iv = crypto.randomBytes(MESSAGE_ENCRYPTION_IV_LENGTH);
  const cipher = crypto.createCipheriv(MESSAGE_ENCRYPTION_ALGORITHM, deriveEncryptionKey(rawKey), iv);
  const ciphertext = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    keyVersion,
  };
};

export const decryptMessageContentWithKey = (
  data: {
    ciphertext: string;
    iv: string;
    tag: string;
  },
  rawKey: string
): string => {
  const decipher = crypto.createDecipheriv(
    MESSAGE_ENCRYPTION_ALGORITHM,
    deriveEncryptionKey(rawKey),
    Buffer.from(data.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(data.tag, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(data.ciphertext, 'base64')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
};

export const encryptMessageContent = (content: string): {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
} => {
  return encryptMessageContentWithKey(content, config.encryption.key, config.encryption.keyVersion);
};

export const decryptMessageContent = (data: {
  ciphertext: string;
  iv: string;
  tag: string;
}): string => {
  return decryptMessageContentWithKey(data, config.encryption.key);
};

export const getMessageEncryptionKeyVersion = (): number => config.encryption.keyVersion;