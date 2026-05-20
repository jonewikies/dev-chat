import { Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { successResponse } from '../utils/response.util';
import { AuthRequest } from '../types/api.types';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const profile = this.userService.getProfile(userId);

      res.json(successResponse(profile));
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { displayName, email, avatarUrl } = req.body;

      const profile = this.userService.updateProfile(userId, {
        displayName,
        email,
        avatarUrl,
      });

      res.json(successResponse(profile, '更新成功'));
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { currentPassword, newPassword } = req.body;

      await this.userService.changePassword(userId, {
        currentPassword,
        newPassword,
      });

      res.json(successResponse(null, '密码修改成功'));
    } catch (error) {
      next(error);
    }
  };

  searchUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { q } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = this.userService.searchUsers(q as string, page, pageSize);

      // 返回用户数组而不是整个结果对象
      res.json(successResponse(result.users));
    } catch (error) {
      next(error);
    }
  };

  getFriends = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const friends = this.userService.getFriends(userId);

      res.json(successResponse(friends));
    } catch (error) {
      next(error);
    }
  };

  getUserFriends = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.id);
      const friends = this.userService.getFriends(userId);

      res.json(successResponse(friends));
    } catch (error) {
      next(error);
    }
  };

  getUserById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.id);

      const user = this.userService.getUserById(userId);

      res.json(successResponse(user));
    } catch (error) {
      next(error);
    }
  };

  adminListUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { q } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = this.userService.listUsersForAdmin(q as string | undefined, page, pageSize);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  adminCreateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { username, password, email, displayName, isSuperAdmin } = req.body;
      const user = await this.userService.createUserByAdmin({
        username,
        password,
        email,
        displayName,
        isSuperAdmin,
      });

      res.status(201).json(successResponse(user, '用户创建成功'));
    } catch (error) {
      next(error);
    }
  };

  adminBatchCreateUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.userService.batchCreateUsersByAdmin({
        users: req.body.users,
        defaultPassword: req.body.defaultPassword,
      });

      res.status(201).json(successResponse(result, '批量创建完成'));
    } catch (error) {
      next(error);
    }
  };

  adminResetPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const { newPassword } = req.body;

      await this.userService.resetUserPasswordByAdmin(userId, newPassword);
      res.json(successResponse(null, '密码已重置'));
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const requesterId = req.user!.id;
      const userId = parseInt(req.params.id);
      const { displayName, email, avatarUrl } = req.body;

      // 只能更新自己的信息
      if (requesterId !== userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '无权修改其他用户信息'
          }
        });
        return;
      }

      const user = this.userService.updateProfile(userId, {
        displayName,
        email,
        avatarUrl,
      });

      res.json(successResponse(user, '更新成功'));
    } catch (error) {
      next(error);
    }
  };

  sendFriendRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      // 支持两种方式：从 URL 参数或从 body 获取 friendId
      const friendId = req.params.id ? parseInt(req.params.id) : req.body.friendId;

      if (!friendId || isNaN(friendId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: '请提供有效的用户ID'
          }
        });
        return;
      }

      const friendship = this.userService.sendFriendRequest(userId, friendId);

      res.status(201).json(successResponse(friendship, '好友请求已发送'));
    } catch (error) {
      next(error);
    }
  };

  acceptFriendRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const friendshipId = parseInt(req.params.friendshipId);

      const friendship = this.userService.acceptFriendRequest(friendshipId, userId);

      res.json(successResponse(friendship, '已接受好友请求'));
    } catch (error) {
      next(error);
    }
  };

  deleteFriendship = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const friendshipId = parseInt(req.params.friendshipId);

      this.userService.deleteFriendship(friendshipId, userId);

      res.json(successResponse(null, '已删除好友关系'));
    } catch (error) {
      next(error);
    }
  };
}
