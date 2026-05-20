const isTest = process.env.NODE_ENV === 'test';

const noLimit = (_req: any, _res: any, next: any) => next();

export const generalLimiter = isTest
  ? noLimit
  : noLimit;

export const authLimiter = isTest
  ? noLimit
  : noLimit;

export const uploadLimiter = noLimit;
