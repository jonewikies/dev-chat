const hasCjkCharacters = (value: string): boolean => /[\u3400-\u9fff\uf900-\ufaff]/.test(value);

const hasNonAsciiCharacters = (value: string): boolean => /[^\x00-\x7f]/.test(value);

export const normalizeUploadedFileName = (fileName?: string | null): string => {
  if (!fileName) {
    return '';
  }

  if (hasCjkCharacters(fileName) || !hasNonAsciiCharacters(fileName)) {
    return fileName;
  }

  const decoded = Buffer.from(fileName, 'latin1').toString('utf8');
  if (!decoded || decoded.includes('\u0000')) {
    return fileName;
  }

  if (hasCjkCharacters(decoded)) {
    return decoded;
  }

  return fileName;
};