import { Application } from 'express';
import { createApp } from '../src/app';
import { getDatabase, initializeSchema, closeDatabase, startAutoSave } from '../src/database/connection';
import logger from '../src/utils/logger.util';

// 禁用测试期间的日志输出
logger.transports.forEach((transport) => {
  transport.silent = true;
});

let app: Application;
let isDbInitialized = false;

export async function setupTestApp(): Promise<Application> {
  if (!isDbInitialized) {
    // 初始化数据库
    await getDatabase();
    await initializeSchema();
    startAutoSave();
    isDbInitialized = true;
  }

  if (!app) {
    app = createApp();
  }

  return app;
}

export async function teardownTest(): Promise<void> {
  closeDatabase();
}

// 生成随机测试数据
export const generateRandomString = (length: number = 8): string => {
  return Math.random().toString(36).substring(2, 2 + length);
};

export const generateTestUser = () => ({
  username: `test_${generateRandomString()}`,
  password: 'Test123456',
  email: `test_${generateRandomString()}@example.com`,
  displayName: `Test User ${generateRandomString(4)}`,
});

export const generateTestProject = () => ({
  name: `Test Project ${generateRandomString()}`,
  description: 'Test project description',
  goal: 'Test project goal',
});

export const generateTestChat = (memberIds: number[]) => ({
  name: `Test Chat ${generateRandomString()}`,
  type: 'group' as const,
  memberIds,
});

export const generateTestTask = () => ({
  title: `Test Task ${generateRandomString()}`,
  description: `Test task description ${generateRandomString()}`,
  priority: 'medium' as const,
  status: 'todo' as const,
  assigneeId: undefined,
  startDate: '2026-03-01',
  endDate: '2026-03-31',
});

// 认证辅助函数
export interface AuthTokens {
  token: string;
  userId: number;
}

export const registerAndLogin = async (app: Application): Promise<AuthTokens> => {
  const request = require('supertest');
  const userData = generateTestUser();

  const registerResponse = await request(app)
    .post('/api/auth/register')
    .send(userData);

  // Debug output for failures
  if (registerResponse.status !== 201) {
    console.error('Registration failed:', {
      status: registerResponse.status,
      body: registerResponse.body,
      userData,
    });
  }

  return {
    token: registerResponse.body.data.token,
    userId: registerResponse.body.data.user.id,
  };
};
