import { Request } from 'express';
import { User } from './db.types';

// 扩展 Express Request 类型
export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    is_super_admin?: boolean;
  };
  projectMember?: {
    id: number;
    role: string;
  };
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// DTO (Data Transfer Objects)
export interface RegisterDTO {
  username: string;
  password: string;
  email?: string;
  displayName?: string;
}

export interface LoginDTO {
  username: string;
  password: string;
}

export interface CreateProjectDTO {
  name: string;
  description?: string;
  goal?: string;
  content?: string;
  timeline?: string;
  ownerId: number;
  repositories?: Array<{
    name: string;
    url: string;
    platform?: 'gitlab' | 'github' | 'gitea';
    accessToken?: string;
  }>;
}

export interface CreateTaskDTO {
  projectId: number;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  assigneeId?: number;
  startDate?: string;
  endDate?: string;
}

export interface CreateChatDTO {
  name?: string;
  type: 'direct' | 'group';
  memberIds: number[];
  projectId?: number;
}

export interface SendMessageDTO {
  chatId: number;
  content: string;
  type?: 'text' | 'file';
  replyToMessageId?: number;
  metadata?: any;
}

// 用户公开信息（不包含敏感字段）
export type UserPublic = Omit<User, 'password_hash'>;

// 登录响应
export interface LoginResponse {
  token: string;
  user: UserPublic;
}

// Token Payload
export interface TokenPayload {
  userId: number;
  username: string;
  is_super_admin?: boolean;
  iat?: number;
  exp?: number;
}
