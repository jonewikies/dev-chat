import request from 'supertest';
import { Application } from 'express';
import { setupTestApp, registerAndLogin, generateTestProject, teardownTest } from './setup';
import { ProjectAIAutoSummaryService } from '../src/services/project-ai-auto-summary.service';
import { config } from '../src/config/app';

describe('Project AI API', () => {
  let app: Application;
  let ownerToken: string;
  let memberToken: string;
  let memberId: number;
  let outsiderToken: string;
  let projectId: number;
  let chatId: number;

  beforeAll(async () => {
    app = await setupTestApp();

    const ownerAuth = await registerAndLogin(app);
    ownerToken = ownerAuth.token;

    const memberAuth = await registerAndLogin(app);
    memberToken = memberAuth.token;
    memberId = memberAuth.userId;

    const outsiderAuth = await registerAndLogin(app);
    outsiderToken = outsiderAuth.token;

    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(generateTestProject())
      .expect(201);

    projectId = projectResponse.body.data.id;

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: memberId, role: 'member' })
      .expect(201);

    const chatResponse = await request(app)
      .post(`/api/projects/${projectId}/chat/open`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    chatId = chatResponse.body.data.id;

    const seedMessages = [
      '任务：整理登录重构方案并安排一下',
      'bug：提交接口报错 500，需要修复',
      '文档：补充接口说明文档和记录',
      '进度：当前里程碑延期到月底',
    ];

    for (const content of seedMessages) {
      await request(app)
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content, type: 'text' })
        .expect(201);
    }
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('allows a project member to generate AI summaries and proposals', async () => {
    const response = await request(app)
      .post(`/api/projects/${projectId}/ai/summaries`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ chatId, messageLimit: 50 })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.analysisId).toBeDefined();
    expect(response.body.data.archiveDocumentTitle).toContain('AI对话归档');
    expect(response.body.data.proposalCount).toBeGreaterThan(0);

    const summariesResponse = await request(app)
      .get(`/api/projects/${projectId}/ai/summaries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(summariesResponse.body.success).toBe(true);
    expect(Array.isArray(summariesResponse.body.data)).toBe(true);
  expect(summariesResponse.body.data[0].archive_document_id).toBeUndefined();
  expect(summariesResponse.body.data[0].archive_document_title).toContain('AI对话归档');
  expect(summariesResponse.body.data[0].archive_document_kept).toBe(false);
    expect(summariesResponse.body.data[0].summary_source).toBe('local');
    expect(summariesResponse.body.data[0].summary_trigger_mode).toBe('manual');

    const proposalsResponse = await request(app)
      .get(`/api/projects/${projectId}/ai/proposals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(proposalsResponse.body.success).toBe(true);
    expect(Array.isArray(proposalsResponse.body.data)).toBe(true);
    expect(proposalsResponse.body.data.some((proposal: any) => proposal.target_type === 'task')).toBe(true);
  });

  it('keeps a summary as a meeting minutes document only after user confirmation', async () => {
    const summariesResponse = await request(app)
      .get(`/api/projects/${projectId}/ai/summaries`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    const latestSummary = summariesResponse.body.data[0];
    expect(latestSummary.archive_document_id).toBeUndefined();

    const keepResponse = await request(app)
      .post(`/api/projects/${projectId}/ai/summaries/${latestSummary.id}/keep`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(keepResponse.body.success).toBe(true);
    expect(keepResponse.body.data.archiveDocumentId).toBeDefined();

    const documentsResponse = await request(app)
      .get(`/api/projects/${projectId}/documents`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(documentsResponse.body.data.items.some((document: any) => document.id === keepResponse.body.data.archiveDocumentId)).toBe(true);

    const summariesAfterKeepResponse = await request(app)
      .get(`/api/projects/${projectId}/ai/summaries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(summariesAfterKeepResponse.body.data[0].archive_document_id).toBe(keepResponse.body.data.archiveDocumentId);
    expect(summariesAfterKeepResponse.body.data[0].archive_document_kept).toBe(true);
  });

  it('rejects keep when requester is not the project owner', async () => {
    const proposalsResponse = await request(app)
      .get(`/api/projects/${projectId}/ai/proposals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const pendingTaskProposal = proposalsResponse.body.data.find(
      (proposal: any) => proposal.status === 'pending' && proposal.target_type === 'task'
    );

    expect(pendingTaskProposal).toBeDefined();

    const response = await request(app)
      .post(`/api/projects/${projectId}/ai/proposals/${pendingTaskProposal.id}/keep`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);

    expect(response.body.success).toBe(false);
  });

  it('allows the project owner to keep a task proposal and create a task', async () => {
    const proposalsResponse = await request(app)
      .get(`/api/projects/${projectId}/ai/proposals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const pendingTaskProposal = proposalsResponse.body.data.find(
      (proposal: any) => proposal.status === 'pending' && proposal.target_type === 'task'
    );

    expect(pendingTaskProposal).toBeDefined();

    const keepResponse = await request(app)
      .post(`/api/projects/${projectId}/ai/proposals/${pendingTaskProposal.id}/keep`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(keepResponse.body.success).toBe(true);
    expect(keepResponse.body.data.status).toBe('applied');
    expect(keepResponse.body.data.appliedTargetType).toBe('task');
    expect(keepResponse.body.data.appliedTargetId).toBeDefined();

    const proposalDetailResponse = await request(app)
      .get(`/api/projects/${projectId}/ai/proposals/${pendingTaskProposal.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(proposalDetailResponse.body.data.status).toBe('applied');

    const tasksResponse = await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(tasksResponse.body.data.items.some((task: any) => task.title === pendingTaskProposal.title)).toBe(true);
  });

  it('allows the project owner to edit a proposal before keeping it', async () => {
    await request(app)
      .post(`/api/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ content: '任务：补充 AI 审批通知文案并安排实现', type: 'text' })
      .expect(201);

    await request(app)
      .post(`/api/projects/${projectId}/ai/summaries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ chatId, messageLimit: 20 })
      .expect(201);

    const proposalsResponse = await request(app)
      .get(`/api/projects/${projectId}/ai/proposals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const editableProposal = proposalsResponse.body.data.find(
      (proposal: any) => proposal.status === 'pending' && proposal.target_type === 'task'
    );

    expect(editableProposal).toBeDefined();

    const editedTitle = '补充 AI 审批通知文案并完成负责人提醒';
    const keepResponse = await request(app)
      .post(`/api/projects/${projectId}/ai/proposals/${editableProposal.id}/keep`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: editedTitle,
        summary: '负责人修正后确认入库',
        reviewerComment: '负责人修订后 keep',
        payload: {
          title: editedTitle,
          description: '根据负责人修订后的 AI 提案生成任务',
          priority: 'high',
          status: 'todo',
        },
      })
      .expect(200);

    expect(keepResponse.body.success).toBe(true);
    expect(keepResponse.body.data.status).toBe('applied');

    const proposalDetailResponse = await request(app)
      .get(`/api/projects/${projectId}/ai/proposals/${editableProposal.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(proposalDetailResponse.body.data.title).toBe(editedTitle);
    expect(proposalDetailResponse.body.data.original_title).toBe(editableProposal.title);
    expect(proposalDetailResponse.body.data.original_payload.title).toBe(editableProposal.title);

    const tasksResponse = await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(tasksResponse.body.data.items.some((task: any) => task.title === editedTitle)).toBe(true);
  });

  it('allows the project owner to undo a pending proposal', async () => {
    const proposalsResponse = await request(app)
      .get(`/api/projects/${projectId}/ai/proposals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const pendingDocumentProposal = proposalsResponse.body.data.find(
      (proposal: any) => proposal.status === 'pending' && proposal.target_type === 'document'
    );

    expect(pendingDocumentProposal).toBeDefined();

    const undoResponse = await request(app)
      .post(`/api/projects/${projectId}/ai/proposals/${pendingDocumentProposal.id}/undo`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(undoResponse.body.success).toBe(true);
    expect(undoResponse.body.data.status).toBe('rejected');

    const proposalDetailResponse = await request(app)
      .get(`/api/projects/${projectId}/ai/proposals/${pendingDocumentProposal.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(proposalDetailResponse.body.data.status).toBe('rejected');
  });

  it('rejects AI summary creation for non-project members', async () => {
    const response = await request(app)
      .post(`/api/projects/${projectId}/ai/summaries`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ chatId, messageLimit: 50 })
      .expect(403);

    expect(response.body.success).toBe(false);
  });

  it('records failed summaries and allows retry', async () => {
    process.env.AI_SUMMARY_FORCE_FAIL = '1';

    const failedResponse = await request(app)
      .post(`/api/projects/${projectId}/ai/summaries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ chatId, messageLimit: 20 });

    expect(failedResponse.status).toBe(500);

    const summariesResponse = await request(app)
      .get(`/api/projects/${projectId}/ai/summaries`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const failedSummary = summariesResponse.body.data.find((summary: any) => summary.status === 'failed');
    expect(failedSummary).toBeDefined();
    expect(failedSummary.error_message).toBe('AI_SUMMARY_FORCE_FAIL');
    expect(failedSummary.can_retry).toBe(true);

    delete process.env.AI_SUMMARY_FORCE_FAIL;

    const retryResponse = await request(app)
      .post(`/api/projects/${projectId}/ai/summaries/${failedSummary.id}/retry`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    expect(retryResponse.body.success).toBe(true);
    expect(retryResponse.body.data.analysisId).toBeDefined();
  });

  it('creates an auto-triggered summary when new project chat messages reach the threshold', async () => {
    const autoSummaryService = new ProjectAIAutoSummaryService();
    const originalMinMessages = config.ai.autoSummaryMinMessages;
    const originalCooldownMs = config.ai.autoSummaryCooldownMs;
    const originalMessageLimit = config.ai.autoSummaryMessageLimit;

    config.ai.autoSummaryMinMessages = 3;
    config.ai.autoSummaryCooldownMs = 0;
    config.ai.autoSummaryMessageLimit = 20;

    try {
      const beforeResponse = await request(app)
        .get(`/api/projects/${projectId}/ai/summaries`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const beforeCount = beforeResponse.body.data.length;

      const autoMessages = [
        '自动总结测试：需要整理支付联调排期。',
        '自动总结测试：修复登录态偶发失效问题。',
        '自动总结测试：补充部署说明文档。',
      ];

      for (const content of autoMessages) {
        await request(app)
          .post(`/api/chats/${chatId}/messages`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ content, type: 'text' })
          .expect(201);
      }

      await autoSummaryService.runOnce();
      await autoSummaryService.runOnce();

      const afterResponse = await request(app)
        .get(`/api/projects/${projectId}/ai/summaries`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(afterResponse.body.data.length).toBe(beforeCount + 1);
      expect(afterResponse.body.data[0].summary_trigger_mode).toBe('auto');
    } finally {
      config.ai.autoSummaryMinMessages = originalMinMessages;
      config.ai.autoSummaryCooldownMs = originalCooldownMs;
      config.ai.autoSummaryMessageLimit = originalMessageLimit;
    }
  });
});