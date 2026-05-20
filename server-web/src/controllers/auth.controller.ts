import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { successResponse } from '../utils/response.util';
import { AuthRequest } from '../types/api.types';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password, email, displayName } = req.body;

      const result = await this.authService.register({
        username,
        password,
        email,
        displayName,
      });

      res.status(201).json(successResponse(result, '注册成功'));
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password } = req.body;

      const result = await this.authService.login(username, password);

      res.json(successResponse(result, '登录成功'));
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const result = await this.authService.refreshToken(userId);

      res.json(successResponse(result, '刷新Token成功'));
    } catch (error) {
      next(error);
    }
  };

  logout = async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // 在实际项目中，这里可以将token加入黑名单
      // 目前我们只是返回成功响应
      res.json(successResponse(null, '登出成功'));
    } catch (error) {
      next(error);
    }
  };
}
