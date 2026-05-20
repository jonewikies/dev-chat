import { UserRepository } from '../repositories/user.repository';
import { FriendshipRepository } from '../repositories/friendship.repository';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/error.util';
import { User, Friendship } from '../types/db.types';
import { hashPassword, comparePassword } from '../utils/password.util';

export class UserService {
  private userRepo: UserRepository;
  private friendshipRepo: FriendshipRepository;

  constructor() {
    this.userRepo = new UserRepository();
    this.friendshipRepo = new FriendshipRepository();
  }

  getProfile(userId: number): Omit<User, 'password_hash'> {
    const user = this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const { password_hash, ...profile } = user;
    return profile;
  }

  updateProfile(
    userId: number,
    data: {
      displayName?: string;
      email?: string;
      avatarUrl?: string;
    }
  ): Omit<User, 'password_hash'> {
    const user = this.userRepo.update(userId, {
      display_name: data.displayName,
      email: data.email,
      avatar_url: data.avatarUrl,
    });

    const { password_hash, ...profile } = user;
    return profile;
  }

  async changePassword(
    userId: number,
    data: {
      currentPassword: string;
      newPassword: string;
    }
  ): Promise<void> {
    if (!data.currentPassword || !data.newPassword) {
      throw new ValidationError('当前密码和新密码为必填项');
    }

    if (data.newPassword.length < 6) {
      throw new ValidationError('新密码长度至少为6位');
    }

    const user = this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const passwordMatches = await comparePassword(data.currentPassword, user.password_hash);
    if (!passwordMatches) {
      throw new ValidationError('当前密码错误');
    }

    const newPasswordHash = await hashPassword(data.newPassword);
    this.userRepo.update(userId, {
      password_hash: newPasswordHash,
    });
  }

  setOnlineStatus(userId: number, isOnline: boolean): void {
    this.userRepo.setOnlineStatus(userId, isOnline);
  }

  searchUsers(query: string, page: number = 1, pageSize: number = 20) {
    const offset = (page - 1) * pageSize;
    const users = this.userRepo.search(query, pageSize, offset);
    const total = this.userRepo.countSearch(query);

    return {
      users: users.map(u => {
        const { password_hash, ...user } = u;
        return user;
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  getFriends(userId: number): Array<Omit<User, 'password_hash'>> {
    // 获取单向好友关系（我添加的好友）
    const friendships = this.friendshipRepo.findFriends(userId);
    const friendIds = friendships.map(f => f.friend_id);

    const friends = friendIds
      .map(id => this.userRepo.findById(id))
      .filter((u): u is User => u !== null)
      .map(u => {
        const { password_hash, ...user } = u;
        return user;
      });

    return friends;
  }

  getUserById(userId: number): Omit<User, 'password_hash'> {
    const user = this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const { password_hash, ...profile } = user;
    return profile;
  }

  listUsersForAdmin(query: string | undefined, page: number = 1, pageSize: number = 20) {
    const safePage = Math.max(page, 1);
    const safePageSize = Math.min(Math.max(pageSize, 1), 100);
    const offset = (safePage - 1) * safePageSize;
    const users = this.userRepo.listAll(safePageSize, offset, query);
    const total = this.userRepo.countAllByQuery(query);

    return {
      users: users.map((u) => {
        const { password_hash, ...user } = u;
        return user;
      }),
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages: Math.ceil(total / safePageSize),
      },
    };
  }

  async createUserByAdmin(data: {
    username: string;
    password: string;
    email?: string;
    displayName?: string;
    isSuperAdmin?: boolean;
  }): Promise<Omit<User, 'password_hash'>> {
    if (!data.username || !data.password) {
      throw new ValidationError('用户名和密码为必填项');
    }

    if (data.password.length < 6) {
      throw new ValidationError('密码长度至少为6位');
    }

    const existingUser = this.userRepo.findByUsername(data.username);
    if (existingUser) {
      throw new ValidationError(`用户名已存在: ${data.username}`);
    }

    if (data.email) {
      const existingEmail = this.userRepo.findByEmail(data.email);
      if (existingEmail) {
        throw new ValidationError(`邮箱已被使用: ${data.email}`);
      }
    }

    const passwordHash = await hashPassword(data.password);
    const user = this.userRepo.create({
      username: data.username,
      passwordHash,
      email: data.email,
      displayName: data.displayName || data.username,
      isSuperAdmin: Boolean(data.isSuperAdmin),
    });

    const { password_hash, ...sanitized } = user;
    return sanitized;
  }

  async batchCreateUsersByAdmin(payload: {
    users: Array<{
      username: string;
      password?: string;
      email?: string;
      displayName?: string;
      isSuperAdmin?: boolean;
    }>;
    defaultPassword?: string;
  }) {
    if (!Array.isArray(payload.users) || payload.users.length === 0) {
      throw new ValidationError('请至少提供一个用户');
    }

    const created: Array<Omit<User, 'password_hash'>> = [];
    const failed: Array<{ username: string; reason: string }> = [];

    for (const item of payload.users) {
      try {
        const password = item.password || payload.defaultPassword;
        if (!password) {
          throw new ValidationError('缺少密码，且未提供默认密码');
        }

        const user = await this.createUserByAdmin({
          username: item.username,
          password,
          email: item.email,
          displayName: item.displayName,
          isSuperAdmin: item.isSuperAdmin,
        });
        created.push(user);
      } catch (error) {
        failed.push({
          username: item.username || '(empty)',
          reason: error instanceof Error ? error.message : '创建失败',
        });
      }
    }

    return {
      created,
      failed,
      summary: {
        requested: payload.users.length,
        created: created.length,
        failed: failed.length,
      },
    };
  }

  async resetUserPasswordByAdmin(userId: number, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError('新密码长度至少为6位');
    }

    const user = this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const passwordHash = await hashPassword(newPassword);
    this.userRepo.update(userId, {
      password_hash: passwordHash,
    });
  }

  sendFriendRequest(userId: number, friendId: number): Friendship {
    // 不能添加自己为好友
    if (userId === friendId) {
      throw new ValidationError('不能添加自己为好友');
    }

    // 检查目标用户是否存在
    const friend = this.userRepo.findById(friendId);
    if (!friend) {
      throw new NotFoundError('目标用户不存在');
    }

    // 单向好友关系：只检查当前用户是否已经添加过这个好友
    // 不使用双向查找，因为 A 添加 B 和 B 添加 A 是两个独立的关系
    const existing = this.friendshipRepo.findByUserAndFriend(userId, friendId);
    if (existing) {
      // 如果已经存在，确保状态是 accepted
      if (existing.status !== 'accepted') {
        return this.friendshipRepo.updateStatus(existing.id, 'accepted');
      }
      return existing;
    }

    return this.friendshipRepo.create(userId, friendId);
  }

  acceptFriendRequest(friendshipId: number, userId: number): Friendship {
    const friendship = this.friendshipRepo.findById(friendshipId);
    if (!friendship) {
      throw new NotFoundError('好友请求不存在');
    }

    // 只有接收方可以接受请求
    if (friendship.friend_id !== userId) {
      throw new ForbiddenError('无权接受此好友请求');
    }

    if (friendship.status === 'accepted') {
      return friendship;
    }

    this.friendshipRepo.accept(friendshipId);
    return this.friendshipRepo.findById(friendshipId)!;
  }

  deleteFriendship(friendshipId: number, userId: number): void {
    const friendship = this.friendshipRepo.findById(friendshipId);
    if (!friendship) {
      throw new NotFoundError('好友关系不存在');
    }

    // 只有关系双方可以删除
    if (friendship.user_id !== userId && friendship.friend_id !== userId) {
      throw new ForbiddenError('无权删除此好友关系');
    }

    this.friendshipRepo.delete(friendshipId);
  }
}
