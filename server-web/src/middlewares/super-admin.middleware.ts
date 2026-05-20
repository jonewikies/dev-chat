import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/api.types';
import { UserRepository } from '../repositories/user.repository';
import { ForbiddenError, UnauthorizedError } from '../utils/error.util';

const userRepo = new UserRepository();

export const requireSuperAdmin = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.id) {
      throw new UnauthorizedError('缺少认证信息');
    }

    const currentUser = userRepo.findById(req.user.id);
    if (!currentUser) {
      throw new UnauthorizedError('用户不存在');
    }

    if (!currentUser.is_super_admin) {
      throw new ForbiddenError('仅超级管理员可访问');
    }

    req.user.is_super_admin = true;
    next();
  } catch (error) {
    next(error);
  }
};
