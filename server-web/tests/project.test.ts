import request from 'supertest';
import { Application } from 'express';
import { setupTestApp, registerAndLogin, generateTestProject, teardownTest } from './setup';

describe('Project API', () => {
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

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const projectData = generateTestProject();

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(projectData.name);
      expect(response.body.data.description).toBe(projectData.description);
      expect(response.body.data.creator_id).toBe(userId);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authorization', async () => {
      await request(app)
        .post('/api/projects')
        .send(generateTestProject())
        .expect(401);
    });
  });

  describe('GET /api/projects', () => {
    it('should get user projects', async () => {
      // Create a project first
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestProject());

      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should get project by id', async () => {
      // Create a project
      const createResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestProject());

      const projectId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(projectId);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/projects/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should update project', async () => {
      // Create a project
      const createResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestProject());

      const projectId = createResponse.body.data.id;

      const updateData = {
        name: 'Updated Project Name',
        description: 'Updated description',
        status: 'on-hold',
      };

      const response = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.status).toBe(updateData.status);
    });

    it('should return 403 when non-owner tries to update', async () => {
      // Create project
      const createResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestProject());

      const projectId = createResponse.body.data.id;

      // Try to update with different user
      const otherUserAuth = await registerAndLogin(app);

      const response = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${otherUserAuth.token}`)
        .send({ name: 'Hacked Name' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete project', async () => {
      // Create a project
      const createResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestProject());

      const projectId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify project is deleted
      await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/projects/:id/members', () => {
    it('should get project members', async () => {
      // Create a project
      const createResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestProject());

      const projectId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      // Creator should be a member
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/projects/:id/members', () => {
    it('should add member to project', async () => {
      // Create project
      const createResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestProject());

      const projectId = createResponse.body.data.id;

      // Create another user
      const memberAuth = await registerAndLogin(app);

      // Add member
      const response = await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: memberAuth.userId,
          role: 'member',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/projects/:id/members/:memberId', () => {
    it('should update member role', async () => {
      // Create project
      const createResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestProject());

      const projectId = createResponse.body.data.id;

      // Add member
      const memberAuth = await registerAndLogin(app);

      await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: memberAuth.userId,
          role: 'member',
        });

      // Update role - use userId, not project_member.id
      const response = await request(app)
        .put(`/api/projects/${projectId}/members/${memberAuth.userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: 'viewer' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('viewer');
    });
  });

  describe('DELETE /api/projects/:id/members/:memberId', () => {
    it('should remove member from project', async () => {
      // Create project
      const createResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestProject());

      const projectId = createResponse.body.data.id;

      // Add member
      const memberAuth = await registerAndLogin(app);

      await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: memberAuth.userId,
          role: 'member',
        });

      // Remove member - use userId, not project_member.id
      const response = await request(app)
        .delete(`/api/projects/${projectId}/members/${memberAuth.userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/projects/:id/tasks', () => {
    it('should get project tasks', async () => {
      // Create project
      const createResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestProject());

      const projectId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/projects/:id/tasks', () => {
    it('should create task in project', async () => {
      // Create project
      const createResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestProject());

      const projectId = createResponse.body.data.id;

      const taskData = {
        title: 'Test Task',
        description: 'Task description',
        priority: 'high',
        status: 'todo',
      };

      const response = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(taskData.title);
      expect(response.body.data.project_id).toBe(projectId);
    });
  });
});
