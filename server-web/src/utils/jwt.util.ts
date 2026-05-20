import jwt from 'jsonwebtoken';
import { config } from '../config/app';
import { TokenPayload } from '../types/api.types';
import { UnauthorizedError } from './error.util';

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as string,
  } as jwt.SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn as string,
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, config.jwt.secret) as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token已过期');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('无效的Token');
    }
    throw new UnauthorizedError('Token验证失败');
  }
};

export const decodeToken = (token: string): TokenPayload | null => {
  return jwt.decode(token) as TokenPayload | null;
};
