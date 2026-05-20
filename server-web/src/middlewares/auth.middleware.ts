import { Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.util';
import { UnauthorizedError } from '../utils/error.util';
import { AuthRequest } from '../types/api.types';

export const authenticate = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('缺少认证Token');
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    const payload = verifyToken(token);

    req.user = {
      id: payload.userId,
      username: payload.username,
      is_super_admin: payload.is_super_admin,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);

      req.user = {
        id: payload.userId,
        username: payload.username,
        is_super_admin: payload.is_super_admin,
      };
    }

    next();
  } catch (error) {
    // 可选认证，即使失败也继续
    next();
  }
};
