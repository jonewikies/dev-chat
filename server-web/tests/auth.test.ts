import request from 'supertest';
import { Application } from 'express';
import { setupTestApp, generateTestUser, teardownTest } from './setup';

describe('Auth API', () => {
  let app: Application;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  afterAll(async () => {
    await teardownTest();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = generateTestUser();

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Debug output
      if (response.status !== 201) {
        console.error('Registration failed:', {
          status: response.status,
          body: response.body,
          userData,
        });
      }

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.password_hash).toBeUndefined();
    });

    it('should return 400 for duplicate username', async () => {
      const userData = generateTestUser();

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid password (too short)', async () => {
      const userData = generateTestUser();
      userData.password = '123'; // Too short

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      const userData = generateTestUser();

      // Register first
      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: userData.username,
          password: userData.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.username).toBe(userData.username);
    });

    it('should return 401 for incorrect password', async () => {
      const userData = generateTestUser();

      // Register first
      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Login with wrong password
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: userData.username,
          password: 'WrongPassword123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent_user',
          password: 'SomePassword123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token with valid token', async () => {
      const userData = generateTestUser();

      // Register and get token
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      const token = registerResponse.body.data.token;

      // Refresh token
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token).not.toBe(token); // New token should be different
    });

    it('should return 401 for missing authorization header', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const userData = generateTestUser();

      // Register and get token
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      const token = registerResponse.body.data.token;

      // Logout
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
