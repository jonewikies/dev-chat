import request from 'supertest';
import { Application } from 'express';
import { setupTestApp, registerAndLogin } from './setup';

describe('Repository API', () => {
  let app: Application;
  let ownerToken: string;
  let memberId: number;
  let regularUserToken: string;
  let projectId: number;

  beforeAll(async () => {
    app = await setupTestApp();

    // 创建测试用户
    const ownerAuth = await registerAndLogin(app);
    ownerToken = ownerAuth.token;
    
    const memberAuth = await registerAndLogin(app);
    memberId = memberAuth.userId;
    
    const viewerAuth = await registerAndLogin(app);
    const viewerId = viewerAuth.userId;
    
    const regularAuth = await registerAndLogin(app);
    regularUserToken = regularAuth.token;

    // 创建测试项目
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Repository Test Project',
        description: 'Project for testing repositories',
      });

    projectId = projectResponse.body.data.id;

    // 添加成员
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: memberId, role: 'member' });

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: viewerId, role: 'viewer' });
  });

  const generateTestRepository = () => ({
    name: 'Test Repository',
    url: 'https://gitlab.com/test/repo',
    platform: 'gitlab' as const,
  });

  describe('POST /api/projects/:projectId/repositories', () => {
    it('should create a new repository with all fields', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/repositories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Core Engine',
          url: 'https://gitlab.com/phoenix/engine',
          platform: 'gitlab',
          accessToken: 'glpat-xxxx',
          isActive: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('Core Engine');
      expect(response.body.data.platform).toBe('gitlab');
      expect(response.body.data.is_active).toBe(true);
    });

    it('should create a repository with minimal fields', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/repositories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Simple Repo',
          url: 'https://github.com/test/simple',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Simple Repo');
      expect(response.body.data.platform).toBe('gitlab'); // default
      expect(response.body.data.is_active).toBe(true); // default
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/repositories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          url: 'https://github.com/test/repo',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing url', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/repositories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Repo',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/repositories`)
        .send(generateTestRepository());

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/repositories`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(generateTestRepository());

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .post('/api/projects/99999/repositories')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(generateTestRepository());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/projects/:projectId/repositories', () => {
    it('should get all repositories for a project', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/repositories`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/repositories`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/repositories`)
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/projects/:projectId/repositories/:repositoryId', () => {
    let repositoryId: number;

    beforeAll(async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/repositories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(generateTestRepository());
      repositoryId = response.body.data.id;
    });

    it('should update repository name and url', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/repositories/${repositoryId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Updated Repo Name',
          url: 'https://gitlab.com/updated/repo',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Repo Name');
      expect(response.body.data.url).toBe('https://gitlab.com/updated/repo');
    });

    it('should update repository platform and active status', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/repositories/${repositoryId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          platform: 'github',
          isActive: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.platform).toBe('github');
      expect(response.body.data.is_active).toBe(false);
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/repositories/${repositoryId}`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/repositories/${repositoryId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent repository', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/repositories/99999`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/projects/:projectId/repositories/:repositoryId', () => {
    it('should delete a repository', async () => {
      const createResponse = await request(app)
        .post(`/api/projects/${projectId}/repositories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(generateTestRepository());

      const repositoryId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/projects/${projectId}/repositories/${repositoryId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}/repositories/1`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}/repositories/1`)
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent repository', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}/repositories/99999`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Repository Field Validation', () => {
    it('should preserve null values in response', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/repositories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Repository with null fields',
          url: 'https://github.com/test/null',
        });

      expect(response.status).toBe(201);
      expect('access_token' in response.body.data).toBe(true);
    });
  });

  describe('Repository Business Logic', () => {
    it('should set default platform to gitlab', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/repositories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Repository without platform',
          url: 'https://github.com/test/default',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.platform).toBe('gitlab');
    });

    it('should set default isActive to true', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/repositories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Repository without isActive',
          url: 'https://github.com/test/active',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.is_active).toBe(true);
    });

    it('should allow valid platform values', async () => {
      const platforms = ['gitlab', 'github', 'gitea'];

      for (const platform of platforms) {
        const response = await request(app)
          .post(`/api/projects/${projectId}/repositories`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            name: `Repository with ${platform} platform`,
            url: `https://${platform}.com/test/repo`,
            platform,
          });

        expect(response.status).toBe(201);
        expect(response.body.data.platform).toBe(platform);
      }
    });
  });
});
