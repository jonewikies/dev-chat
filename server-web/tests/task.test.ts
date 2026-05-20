import request from 'supertest';
import { Application } from 'express';
import { setupTestApp, registerAndLogin, generateTestProject, generateTestTask, teardownTest } from './setup';

describe('Task API', () => {
  let app: Application;
  let authToken: string;
  let userId: number;
  let projectId: number;
  let secondUserToken: string;

  beforeAll(async () => {
    app = await setupTestApp();
    
    // Create first user
    const auth = await registerAndLogin(app);
    authToken = auth.token;
    userId = auth.userId;
    
    // Create second user for multi-user tests
    const secondAuth = await registerAndLogin(app);
    secondUserToken = secondAuth.token;
    
    // Create a test project
    const projectData = generateTestProject();
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send(projectData);
    
    projectId = projectResponse.body.data.id;
  });

  afterAll(async () => {
    await teardownTest();
  });

  describe('POST /api/projects/:projectId/tasks', () => {
    it('should create a new task with all fields', async () => {
      const taskData = {
        ...generateTestTask(),
        assigneeId: userId,
      };

      const response = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(taskData.title);
      expect(response.body.data.description).toBe(taskData.description);
      expect(response.body.data.priority).toBe(taskData.priority);
      expect(response.body.data.status).toBe(taskData.status);
      expect(response.body.data.assignee_id).toBe(userId);
      expect(response.body.data.start_date).toBe(taskData.startDate);
      expect(response.body.data.end_date).toBe(taskData.endDate);
      expect(response.body.data.progress).toBe(0);
      expect(response.body.data.created_by).toBe(userId);
    });

    it('should create a task with minimal fields', async () => {
      const taskData = {
        title: 'Minimal Task',
      };

      const response = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(taskData.title);
      expect(response.body.data.priority).toBe('medium'); // default
      expect(response.body.data.status).toBe('todo'); // default
      expect(response.body.data.progress).toBe(0);
    });

    it('should return 400 for missing title', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'No title' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authorization', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .send(generateTestTask())
        .expect(401);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send(generateTestTask())
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .post('/api/projects/99999/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestTask());


      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/projects/:projectId/tasks', () => {
    beforeAll(async () => {
      // Create some tasks
      await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestTask());
      
      await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...generateTestTask(), priority: 'high' });
    });

    it('should get all tasks for a project', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      
      // Check task structure with assignee info
      const task = response.body.data.items[0];
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('status');
      expect(task).toHaveProperty('priority');
      expect(task).toHaveProperty('progress');
      
      // These fields should exist even if null
      expect(task).toHaveProperty('assignee_id');
      expect(task).toHaveProperty('start_date');
      expect(task).toHaveProperty('end_date');
      expect(task).toHaveProperty('description');
      
      // If assignee exists, check structure
      if (task.assignee) {
        expect(task.assignee).toHaveProperty('id');
        expect(task.assignee).toHaveProperty('username');
        expect(task.assignee).toHaveProperty('avatar'); // Should exist even if null
      }
    });

    it('should return 401 without authorization', async () => {
      await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .expect(401);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/projects/:projectId/tasks/:taskId', () => {
    let taskId: number;

    beforeAll(async () => {
      const taskResponse = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestTask());
      
      taskId = taskResponse.body.data.id;
    });

    it('should update task title and description', async () => {
      const updates = {
        title: 'Updated Task Title',
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updates.title);
      expect(response.body.data.description).toBe(updates.description);
    });

    it('should update task status and progress', async () => {
      const updates = {
        status: 'in-progress',
        statusNote: '任务已开始处理',
        progress: 50,
      };

      const response = await request(app)
        .put(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(updates.status);
      expect(response.body.data.progress).toBe(updates.progress);
    });

    it('should require status note when changing task status', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'done' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should require status note when changing task progress', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ progress: 75 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should record progress updates in task status history', async () => {
      await request(app)
        .put(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ progress: 80, statusNote: '同步推进开发进度' })
        .expect(200);

      const response = await request(app)
        .get(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.status_history)).toBe(true);
      expect(response.body.data.status_history.at(-1).note).toBe('同步推进开发进度');
      expect(response.body.data.status_history.at(-1).from_status).toBe(response.body.data.status_history.at(-1).to_status);
    });

    it('should return task status history in detail endpoint', async () => {
      await request(app)
        .put(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'done', statusNote: '任务已经完成', progress: 100 })
        .expect(200);

      const response = await request(app)
        .get(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.status_history)).toBe(true);
      expect(response.body.data.status_history.length).toBeGreaterThanOrEqual(2);
      expect(response.body.data.status_history[0].note).toBe('创建任务');
      expect(response.body.data.status_history.at(-1).note).toBe('任务已经完成');
      expect(response.body.data.status_history.at(-1).changed_by).toBe(userId);
    });

    it('should update task dates and assignee', async () => {
      const updates = {
        startDate: '2026-03-10',
        endDate: '2026-03-20',
        assigneeId: userId,
      };

      const response = await request(app)
        .put(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.start_date).toBe(updates.startDate);
      expect(response.body.data.end_date).toBe(updates.endDate);
      expect(response.body.data.assignee_id).toBe(updates.assigneeId);
    });

    it('should return 401 without authorization', async () => {
      await request(app)
        .put(`/api/projects/${projectId}/tasks/${taskId}`)
        .send({ title: 'New Title' })
        .expect(401);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({ title: 'New Title' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .put(`/api/projects/${projectId}/tasks/99999`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'New Title' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/projects/:projectId/tasks/:taskId', () => {
    let taskId: number;

    beforeEach(async () => {
      const taskResponse = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestTask());
      
      taskId = taskResponse.body.data.id;
    });

    it('should delete a task', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify task is deleted
      const getResponse = await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const deletedTask = getResponse.body.data.items.find((t: any) => t.id === taskId);
      expect(deletedTask).toBeUndefined();
    });

    it('should return 401 without authorization', async () => {
      await request(app)
        .delete(`/api/projects/${projectId}/tasks/${taskId}`)
        .expect(401);
    });

    it('should return 403 for non-member', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}/tasks/99999`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Task Field Validation', () => {
    it('should preserve null values in response', async () => {
      const taskData = {
        title: 'Task without optional fields',
        // No assigneeId, startDate, endDate
      };

      const createResponse = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData)
        .expect(201);

      const task = createResponse.body.data;
      
      // These fields should exist in response even if null
      expect('assignee_id' in task).toBe(true);
      expect('start_date' in task).toBe(true);
      expect('end_date' in task).toBe(true);
      expect('description' in task).toBe(true);
      
      // Values should be null
      expect(task.assignee_id).toBeNull();
      expect(task.start_date).toBeNull();
      expect(task.end_date).toBeNull();
    });

    it('should handle assignee with null avatar', async () => {
      const taskData = {
        title: 'Task with assignee',
        assigneeId: userId,
      };

      await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData)
        .expect(201);

      // Get task list to check assignee structure
      const listResponse = await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const taskWithAssignee = listResponse.body.data.items.find((t: any) => t.assignee_id === userId);
      
      expect(taskWithAssignee.assignee).toBeDefined();
      expect(taskWithAssignee.assignee.id).toBe(userId);
      expect(taskWithAssignee.assignee.username).toBeDefined();
      expect('avatar' in taskWithAssignee.assignee).toBe(true); // avatar field should exist
      // avatar can be null since user may not have uploaded one
    });
  });

  describe('Task Business Logic', () => {
    it('should set default priority to medium', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Task without priority' })
        .expect(201);

      expect(response.body.data.priority).toBe('medium');
    });

    it('should set default status to todo', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Task without status' })
        .expect(201);

      expect(response.body.data.status).toBe('todo');
    });

    it('should initialize progress to 0', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateTestTask())
        .expect(201);

      expect(response.body.data.progress).toBe(0);
    });

    it('should allow valid priority values', async () => {
      const priorities = ['low', 'medium', 'high'];
      
      for (const priority of priorities) {
        const response = await request(app)
          .post(`/api/projects/${projectId}/tasks`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ title: `Task ${priority}`, priority })
          .expect(201);

        expect(response.body.data.priority).toBe(priority);
      }
    });

    it('should allow valid status values', async () => {
      const statuses = ['todo', 'in-progress', 'done'];
      
      for (const status of statuses) {
        const response = await request(app)
          .post(`/api/projects/${projectId}/tasks`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ title: `Task ${status}`, status })
          .expect(201);

        expect(response.body.data.status).toBe(status);
      }
    });
  });
});
