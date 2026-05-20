import request from 'supertest';
import { Application } from 'express';
import { setupTestApp, registerAndLogin, teardownTest } from './setup';

describe('Chat API', () => {
  let app: Application;
  let authToken: string;
  let userId: number;
  let otherUserAuth: { token: string; userId: number };

  beforeAll(async () => {
    app = await setupTestApp();
    const auth = await registerAndLogin(app);
    authToken = auth.token;
    userId = auth.userId;

    // Create another user for chat tests
    otherUserAuth = await registerAndLogin(app);
  });

  afterAll(async () => {
    await teardownTest();
  });

  describe('GET /api/chats', () => {
    it('should get user chats', async () => {
      const response = await request(app)
        .get('/api/chats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 401 without authorization', async () => {
      await request(app)
        .get('/api/chats')
        .expect(401);
    });
  });

  describe('POST /api/chats/direct', () => {
    it('should create direct chat', async () => {
      const response = await request(app)
        .post('/api/chats/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ targetUserId: otherUserAuth.userId })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('direct');
    });

    it('should return existing direct chat if already exists', async () => {
      // Create first chat
      const firstResponse = await request(app)
        .post('/api/chats/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ targetUserId: otherUserAuth.userId });

      const firstChatId = firstResponse.body.data.id;

      // Try to create again
      const secondResponse = await request(app)
        .post('/api/chats/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ targetUserId: otherUserAuth.userId })
        .expect(201);

      expect(secondResponse.body.data.id).toBe(firstChatId);
    });

    it('should return 400 for self chat', async () => {
      const response = await request(app)
        .post('/api/chats/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ targetUserId: userId })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/chats/group', () => {
    it('should create group chat', async () => {
      const thirdUser = await registerAndLogin(app);

      const response = await request(app)
        .post('/api/chats/group')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Group',
          memberIds: [otherUserAuth.userId, thirdUser.userId],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('group');
      expect(response.body.data.name).toBe('Test Group');
    });

    it('should return 400 for insufficient members', async () => {
      const response = await request(app)
        .post('/api/chats/group')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Small Group',
          memberIds: [otherUserAuth.userId], // Only 1 member + creator = 2 total
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/chats/:chatId', () => {
    it('should get chat by id', async () => {
      // Create a chat first
      const createResponse = await request(app)
        .post('/api/chats/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ targetUserId: otherUserAuth.userId });

      const chatId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/chats/${chatId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(chatId);
    });

    it('should return 404 for non-existent chat', async () => {
      const response = await request(app)
        .get('/api/chats/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/chats/:chatId', () => {
    it('should update group chat', async () => {
      const thirdUser = await registerAndLogin(app);

      // Create group chat
      const createResponse = await request(app)
        .post('/api/chats/group')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Group',
          memberIds: [otherUserAuth.userId, thirdUser.userId],
        });

      const chatId = createResponse.body.data.id;

      // Update chat
      const response = await request(app)
        .put(`/api/chats/${chatId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Group Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Group Name');
    });
  });

  describe('POST /api/chats/:chatId/members', () => {
    it('should add member to group chat', async () => {
      const thirdUser = await registerAndLogin(app);
      const fourthUser = await registerAndLogin(app);

      // Create group chat
      const createResponse = await request(app)
        .post('/api/chats/group')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Group',
          memberIds: [otherUserAuth.userId, thirdUser.userId],
        });

      const chatId = createResponse.body.data.id;

      // Add member
      const response = await request(app)
        .post(`/api/chats/${chatId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: fourthUser.userId })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/chats/:chatId/members/:userId', () => {
    it('should remove member from group chat', async () => {
      const thirdUser = await registerAndLogin(app);

      // Create group chat
      const createResponse = await request(app)
        .post('/api/chats/group')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Group',
          memberIds: [otherUserAuth.userId, thirdUser.userId],
        });

      const chatId = createResponse.body.data.id;

      // Remove member
      const response = await request(app)
        .delete(`/api/chats/${chatId}/members/${thirdUser.userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/chats/:chatId/read', () => {
    it('should mark chat as read', async () => {
      // Create chat
      const createResponse = await request(app)
        .post('/api/chats/direct')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ targetUserId: otherUserAuth.userId });

      const chatId = createResponse.body.data.id;

      // Mark as read
      const response = await request(app)
        .post(`/api/chats/${chatId}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ messageId: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
