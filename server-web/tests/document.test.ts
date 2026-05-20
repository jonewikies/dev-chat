import request from 'supertest';
import { Application } from 'express';
import { setupTestApp, registerAndLogin } from './setup';

describe('Document API', () => {
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
        name: 'Document Test Project',
        description: 'Project for testing documents',
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

  const generateTestDocument = () => ({
    title: 'Test Document',
    content: 'This is a test document content',
    type: 'general' as const,
  });

  describe('POST /api/projects/:projectId/documents', () => {
    it('should create a new document with all fields', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/documents`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Architecture Overview',
          content: 'Detailed architecture of the Phoenix Engine...',
          type: 'product',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe('Architecture Overview');
      expect(response.body.data.type).toBe('product');
    });

    it('should create a document with minimal fields', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/documents`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Simple Document',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Simple Document');
      expect(response.body.data.type).toBe('general'); // default
    });

    it('should return 400 for missing title', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/documents`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          content: 'Document without title',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/documents`)
        .send(generateTestDocument());

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/documents`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(generateTestDocument());

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .post('/api/projects/99999/documents')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(generateTestDocument());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/projects/:projectId/documents', () => {
    it('should get all documents for a project', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/documents`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/documents`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/documents`)
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/projects/:projectId/documents/:documentId', () => {
    let documentId: number;

    beforeAll(async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/documents`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(generateTestDocument());
      documentId = response.body.data.id;
    });

    it('should update document title and content', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/documents/${documentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Updated Document Title',
          content: 'Updated content',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Document Title');
      expect(response.body.data.content).toBe('Updated content');
    });

    it('should update document type', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/documents/${documentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          type: 'design',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('design');
    });

    it('should return document activity history in detail endpoint', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/documents/${documentId}/comments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: '补充一条评审意见' })
        .expect(201);

      const response = await request(app)
        .get(`/api/projects/${projectId}/documents/${documentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.activity_history)).toBe(true);
      expect(response.body.data.activity_history.length).toBeGreaterThanOrEqual(3);
      expect(response.body.data.activity_history[0].activity_type).toBe('created');
      expect(response.body.data.activity_history.at(-1).activity_type).toBe('commented');
      expect(response.body.data.activity_history.at(-1).changed_by).toBeDefined();
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/documents/${documentId}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/documents/${documentId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/documents/99999`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/projects/:projectId/documents/:documentId', () => {
    it('should delete a document', async () => {
      const createResponse = await request(app)
        .post(`/api/projects/${projectId}/documents`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(generateTestDocument());

      const documentId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/projects/${projectId}/documents/${documentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}/documents/1`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}/documents/1`)
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}/documents/99999`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Document Field Validation', () => {
    it('should preserve null values in response', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/documents`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Document with null fields',
        });

      expect(response.status).toBe(201);
      expect('content' in response.body.data).toBe(true);
    });

    it('should handle author with null avatar', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/documents`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      const documents = response.body.data.items;
      if (documents.length > 0 && documents[0].author) {
        expect('avatar' in documents[0].author).toBe(true);
      }
    });
  });

  describe('Document Business Logic', () => {
    it('should set default type to general', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/documents`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Document without type',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.type).toBe('general');
    });

    it('should allow valid type values', async () => {
      const types = ['product', 'design', 'meeting', 'general'];

      for (const type of types) {
        const response = await request(app)
          .post(`/api/projects/${projectId}/documents`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            title: `Document with ${type} type`,
            type,
          });

        expect(response.status).toBe(201);
        expect(response.body.data.type).toBe(type);
      }
    });
  });
});
