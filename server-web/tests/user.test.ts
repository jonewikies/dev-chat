import request from 'supertest';
import { Application } from 'express';
import { setupTestApp, registerAndLogin, teardownTest, generateTestUser } from './setup';

describe('User API', () => {
  let app: Application;
  let authToken: string;
  let userId: number;

  beforeAll(async () => {
    app = await setupTestApp();
    const auth = await registerAndLogin(app);
    authToken = auth.token;
    userId = auth.userId;
  });

  afterAll(async () => {
    await teardownTest();
  });

  describe('GET /api/users/:id', () => {
    it('should get user by id', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(userId);
      expect(response.body.data.password_hash).toBeUndefined();
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/users/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authorization', async () => {
      await request(app)
        .get(`/api/users/${userId}`)
        .expect(401);
    });
  });

  describe('GET /api/users/profile/me', () => {
    it('should get current user profile', async () => {
      const response = await request(app)
        .get('/api/users/profile/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(userId);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user profile', async () => {
      const updateData = {
        displayName: 'Updated Name',
        email: 'updated@example.com',
      };

      const response = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.display_name).toBe(updateData.displayName);
      expect(response.body.data.email).toBe(updateData.email);
    });

    it('should return 403 when updating another user', async () => {
      const otherUserAuth = await registerAndLogin(app);

      const response = await request(app)
        .put(`/api/users/${otherUserAuth.userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ displayName: 'Hacker' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/users/search', () => {
    it('should search users by username', async () => {
      // Create a user with known username
      const userData = generateTestUser();
      userData.username = 'searchable_user_123';

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const response = await request(app)
        .get('/api/users/search?q=searchable_user')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.some((u: any) => u.username === 'searchable_user_123')).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const response = await request(app)
        .get('/api/users/search?q=nonexistent_xyz_123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/users/:id/friends', () => {
    it('should get user friends', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}/friends`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/users/:id/friends', () => {
    it('should send friend request', async () => {
      const friendAuth = await registerAndLogin(app);

      const response = await request(app)
        .post(`/api/users/${friendAuth.userId}/friends`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('pending');
    });

    it('should return 400 for self friend request', async () => {
      const response = await request(app)
        .post(`/api/users/${userId}/friends`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/users/friends/:friendshipId', () => {
    it('should accept friend request', async () => {
      // Create friend request
      const friendAuth = await registerAndLogin(app);

      const requestResponse = await request(app)
        .post(`/api/users/${userId}/friends`)
        .set('Authorization', `Bearer ${friendAuth.token}`)
        .expect(201);

      const friendshipId = requestResponse.body.data.id;

      // Accept friend request
      const response = await request(app)
        .put(`/api/users/friends/${friendshipId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'accepted' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('accepted');
    });
  });

  describe('DELETE /api/users/friends/:friendshipId', () => {
    it('should delete friendship', async () => {
      // Create and accept friendship
      const friendAuth = await registerAndLogin(app);

      const requestResponse = await request(app)
        .post(`/api/users/${userId}/friends`)
        .set('Authorization', `Bearer ${friendAuth.token}`)
        .expect(201);

      const friendshipId = requestResponse.body.data.id;

      await request(app)
        .put(`/api/users/friends/${friendshipId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'accepted' });

      // Delete friendship
      const response = await request(app)
        .delete(`/api/users/friends/${friendshipId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
