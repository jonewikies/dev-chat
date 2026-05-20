import request from 'supertest';
import { Application } from 'express';
import { setupTestApp, registerAndLogin } from './setup';

describe('Bug API', () => {
  let app: Application;
  let ownerToken: string;
  let memberToken: string;
  let memberId: number;
  let regularUserToken: string;
  let projectId: number;

  beforeAll(async () => {
    app = await setupTestApp();

    // 创建测试用户
    const ownerAuth = await registerAndLogin(app);
    ownerToken = ownerAuth.token;
    
    const memberAuth = await registerAndLogin(app);
    memberToken = memberAuth.token;
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
        name: 'Bug Test Project',
        description: 'Project for testing bugs',
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

  const generateTestBug = () => ({
    title: 'Test Bug',
    description: 'This is a test bug',
    severity: 'high' as const,
    status: 'open' as const,
  });

  describe('POST /api/projects/:projectId/bugs', () => {
    it('should create a new bug with all fields', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/bugs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Memory leak in texture loader',
          description: 'Textures are not being freed properly',
          severity: 'critical',
          status: 'open',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe('Memory leak in texture loader');
      expect(response.body.data.severity).toBe('critical');
      expect(response.body.data.status).toBe('open');
    });

    it('should create a bug with minimal fields', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/bugs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Simple bug',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Simple bug');
      expect(response.body.data.severity).toBe('medium'); // default
      expect(response.body.data.status).toBe('open'); // default
    });

    it('should return 400 for missing title', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/bugs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          description: 'Bug without title',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/bugs`)
        .send(generateTestBug());

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/bugs`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(generateTestBug());

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .post('/api/projects/99999/bugs')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(generateTestBug());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/projects/:projectId/bugs', () => {
    it('should get all bugs for a project', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/bugs`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/bugs`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/bugs`)
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/projects/:projectId/bugs/:bugId', () => {
    it('should return bug detail with status timeline', async () => {
      const createResponse = await request(app)
        .post(`/api/projects/${projectId}/bugs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Timeline bug',
          description: 'Validate bug timeline',
        });

      const bugId = createResponse.body.data.id;

      const moveToInProgress = await request(app)
        .put(`/api/projects/${projectId}/bugs/${bugId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'in-progress',
          statusNote: '开始定位问题',
        });

      expect(moveToInProgress.status).toBe(200);

      const moveToFixed = await request(app)
        .put(`/api/projects/${projectId}/bugs/${bugId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'fixed',
          statusNote: '已提交修复补丁',
        });

      expect(moveToFixed.status).toBe(200);

      const reopenResponse = await request(app)
        .put(`/api/projects/${projectId}/bugs/${bugId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'open',
          statusNote: '回归测试发现问题仍存在',
        });

      expect(reopenResponse.status).toBe(200);

      const detailResponse = await request(app)
        .get(`/api/projects/${projectId}/bugs/${bugId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.success).toBe(true);
      expect(Array.isArray(detailResponse.body.data.status_history)).toBe(true);
      expect(detailResponse.body.data.status_history).toHaveLength(4);
      expect(detailResponse.body.data.status_history[0]).toMatchObject({
        from_status: null,
        to_status: 'open',
      });
      expect(detailResponse.body.data.status_history[1]).toMatchObject({
        from_status: 'open',
        to_status: 'in-progress',
        note: '开始定位问题',
      });
      expect(detailResponse.body.data.status_history[2]).toMatchObject({
        from_status: 'in-progress',
        to_status: 'fixed',
        note: '已提交修复补丁',
      });
      expect(detailResponse.body.data.status_history[3]).toMatchObject({
        from_status: 'fixed',
        to_status: 'open',
        note: '回归测试发现问题仍存在',
      });
    });

    it('should record the actual operator instead of bug assignee in status timeline', async () => {
      const createResponse = await request(app)
        .post(`/api/projects/${projectId}/bugs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Operator tracking bug',
          assigneeId: memberId,
        });

      const bugId = createResponse.body.data.id;

      const updateResponse = await request(app)
        .put(`/api/projects/${projectId}/bugs/${bugId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'in-progress',
          statusNote: '由负责人开始处理',
        });

      expect(updateResponse.status).toBe(200);

      const reopenResponse = await request(app)
        .put(`/api/projects/${projectId}/bugs/${bugId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          status: 'fixed',
          statusNote: '成员提交修复结果',
        });

      expect(reopenResponse.status).toBe(200);

      const detailResponse = await request(app)
        .get(`/api/projects/${projectId}/bugs/${bugId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.data.status_history).toHaveLength(3);
      expect(detailResponse.body.data.status_history[1].changed_by).not.toBe(memberId);
      expect(detailResponse.body.data.status_history[1].changed_by_user?.username).toBeDefined();
      expect(detailResponse.body.data.status_history[2]).toMatchObject({
        from_status: 'in-progress',
        to_status: 'fixed',
        changed_by: memberId,
        note: '成员提交修复结果',
      });
      expect(detailResponse.body.data.status_history[2].changed_by_user?.username).toBeDefined();
    });
  });

  describe('PUT /api/projects/:projectId/bugs/:bugId', () => {
    let bugId: number;

    beforeAll(async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/bugs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(generateTestBug());
      bugId = response.body.data.id;
    });

    it('should update bug title and description', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/bugs/${bugId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Updated Bug Title',
          description: 'Updated description',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Bug Title');
      expect(response.body.data.description).toBe('Updated description');
    });

    it('should update bug severity and status', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/bugs/${bugId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          severity: 'low',
          status: 'fixed',
          statusNote: '验证修复完成',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.severity).toBe('low');
      expect(response.body.data.status).toBe('fixed');
    });

    it('should require note when changing bug status', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/bugs/${bugId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'closed',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('必须填写说明');
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/bugs/${bugId}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/bugs/${bugId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent bug', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/bugs/99999`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/projects/:projectId/bugs/:bugId', () => {
    it('should delete a bug', async () => {
      const createResponse = await request(app)
        .post(`/api/projects/${projectId}/bugs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(generateTestBug());

      const bugId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/projects/${projectId}/bugs/${bugId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}/bugs/1`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}/bugs/1`)
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent bug', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}/bugs/99999`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Bug Field Validation', () => {
    it('should preserve null values in response', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/bugs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Bug with null fields',
        });

      expect(response.status).toBe(201);
      expect('description' in response.body.data).toBe(true);
      expect('assignee_id' in response.body.data).toBe(true);
    });

    it('should handle reporter and assignee with null avatar', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/bugs`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      const bugs = response.body.data.items;
      if (bugs.length > 0 && bugs[0].reporter) {
        expect('avatar' in bugs[0].reporter).toBe(true);
      }
    });
  });

  describe('Bug Business Logic', () => {
    it('should set default severity to medium', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/bugs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Bug without severity',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.severity).toBe('medium');
    });

    it('should set default status to open', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/bugs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Bug without status',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('open');
    });

    it('should allow valid severity values', async () => {
      const severities = ['low', 'medium', 'high', 'critical'];

      for (const severity of severities) {
        const response = await request(app)
          .post(`/api/projects/${projectId}/bugs`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            title: `Bug with ${severity} severity`,
            severity,
          });

        expect(response.status).toBe(201);
        expect(response.body.data.severity).toBe(severity);
      }
    });

    it('should allow valid status values', async () => {
      const statuses = ['open', 'in-progress', 'fixed', 'closed'];

      for (const status of statuses) {
        const response = await request(app)
          .post(`/api/projects/${projectId}/bugs`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            title: `Bug with ${status} status`,
            status,
          });

        expect(response.status).toBe(201);
        expect(response.body.data.status).toBe(status);
      }
    });
  });
});
