import { UserRepository } from '../repositories/user.repository';
import { hashPassword, comparePassword } from '../utils/password.util';
import { generateToken } from '../utils/jwt.util';
import { ValidationError, UnauthorizedError } from '../utils/error.util';
import { User } from '../types/db.types';
import { LoginResponse } from '../types/api.types';

export class AuthService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  async register(data: {
    username: string;
    password: string;
    email?: string;
    displayName?: string;
  }): Promise<LoginResponse> {
    // 验证必填字段
    if (!data.username || !data.password) {
      throw new ValidationError('用户名和密码为必填项');
    }

    // 验证用户名是否已存在
    const existingUser = this.userRepo.findByUsername(data.username);
    if (existingUser) {
      throw new ValidationError('用户名已存在');
    }

    // 验证邮箱是否已存在
    if (data.email) {
      const existingEmail = this.userRepo.findByEmail(data.email);
      if (existingEmail) {
        throw new ValidationError('邮箱已被使用');
      }
    }

    // 验证密码长度
    if (data.password.length < 6) {
      throw new ValidationError('密码长度至少为6位');
    }

    // 哈希密码
    const passwordHash = await hashPassword(data.password);
    const shouldGrantSuperAdmin = this.userRepo.countSuperAdmins() === 0;

    // 创建用户
    const user = this.userRepo.create({
      username: data.username,
      passwordHash,
      email: data.email,
      displayName: data.displayName || data.username,
      isSuperAdmin: shouldGrantSuperAdmin,
    });

    // 生成 Token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      is_super_admin: user.is_super_admin,
    });

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    // 查找用户
    const user = this.userRepo.findByUsername(username);
    if (!user) {
      throw new UnauthorizedError('用户名或密码错误');
    }

    // 验证密码
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('用户名或密码错误');
    }

    // 更新在线状态
    this.userRepo.setOnlineStatus(user.id, true);

    // 生成 Token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      is_super_admin: user.is_super_admin,
    });

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  async refreshToken(userId: number): Promise<{ token: string }> {
    const user = this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedError('用户不存在');
    }

    // 添加时间戳确保每次生成的token都不同
    const token = generateToken({
      userId: user.id,
      username: user.username,
      is_super_admin: user.is_super_admin,
      refreshedAt: Date.now(),
    } as any);

    return { token };
  }

  private sanitizeUser(user: User): Omit<User, 'password_hash'> {
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }
}
