import { config } from '../config/app';
import { z } from 'zod';
import { DOCUMENT_TYPES, normalizeDocumentType, type DocumentType } from '../constants/document';
import { AIAnalysisRepository } from '../repositories/ai-analysis.repository';
import { ProjectChangeProposalRepository } from '../repositories/project-change-proposal.repository';
import { MessageRepository } from '../repositories/message.repository';
import { ChatRepository } from '../repositories/chat.repository';
import { ProjectRepository } from '../repositories/project.repository';
import { ProjectMemberRepository } from '../repositories/project-member.repository';
import { UserRepository } from '../repositories/user.repository';
import { ProjectService } from './project.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/error.util';
import { ProjectChangeProposalWithReviewer } from '../types/db.types';
import logger from '../utils/logger.util';
import { WebSocketServer } from '../websocket';

const summaryAnalysisSchema = z.object({
  overview: z.string(),
  highlights: z.array(z.string()),
  decisions: z.array(z.string()),
  projectUpdates: z.array(z.string()),
  archiveDocument: z.object({
    title: z.string(),
    content: z.string(),
    type: z.enum(DOCUMENT_TYPES),
  }),
  proposals: z.array(z.object({
    targetType: z.enum(['project', 'task', 'bug', 'document']),
    action: z.enum(['create', 'update']),
    title: z.string(),
    summary: z.string(),
    payload: z.record(z.any()),
    reason: z.string(),
    sourceMessageIds: z.array(z.number()),
    confidence: z.number().min(0).max(1),
  })),
  metadata: z.object({
    messageCount: z.number().int().nonnegative(),
    generatedAt: z.string(),
    provider: z.enum(['gemini', 'local']).optional(),
    triggerMode: z.enum(['manual', 'auto']).optional(),
  }),
});

type SummaryAnalysisResult = z.infer<typeof summaryAnalysisSchema>;

type ProjectSummaryListItem = {
  id: number;
  chat_id: number;
  analysis_type: 'summary';
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  archive_document_id?: number;
  archive_document_title?: string;
  archive_document_type?: DocumentType;
  archive_document_kept?: boolean;
  proposal_count: number;
  overview?: string;
  error_message?: string;
  can_retry?: boolean;
  summary_source?: 'gemini' | 'local';
  summary_trigger_mode?: 'manual' | 'auto';
};

export class ProjectAIService {
  private aiAnalysisRepo: AIAnalysisRepository;
  private proposalRepo: ProjectChangeProposalRepository;
  private messageRepo: MessageRepository;
  private chatRepo: ChatRepository;
  private projectRepo: ProjectRepository;
  private projectMemberRepo: ProjectMemberRepository;
  private userRepo: UserRepository;
  private projectService: ProjectService;

  constructor() {
    this.aiAnalysisRepo = new AIAnalysisRepository();
    this.proposalRepo = new ProjectChangeProposalRepository();
    this.messageRepo = new MessageRepository();
    this.chatRepo = new ChatRepository();
    this.projectRepo = new ProjectRepository();
    this.projectMemberRepo = new ProjectMemberRepository();
    this.userRepo = new UserRepository();
    this.projectService = new ProjectService();
  }

  async summarizeProjectChat(
    projectId: number,
    userId: number,
    data: {
      chatId: number;
      messageLimit?: number;
      beforeMessageId?: number;
      startMessageId?: number;
      endMessageId?: number;
      startTime?: string;
      endTime?: string;
      triggerMode?: 'manual' | 'auto';
    }
  ) {
    const project = this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限触发 AI 总结');
    }

    const chat = this.chatRepo.findById(data.chatId);
    if (!chat || chat.type !== 'project' || chat.project_id !== projectId) {
      throw new ValidationError('只能对当前项目群聊触发总结');
    }

    const messageLimit = data.messageLimit ? Math.min(500, Math.max(1, data.messageLimit)) : undefined;
    const messages = this.messageRepo
      .findByChatIdInRange(data.chatId, {
        limit: messageLimit,
        beforeId: data.beforeMessageId,
        startMessageId: data.startMessageId,
        endMessageId: data.endMessageId,
        startTime: data.startTime,
        endTime: data.endTime,
      })
      .filter((message) => !message.is_deleted && String(message.content || '').trim());

    if (messages.length === 0) {
      throw new ValidationError('当前范围内没有可总结的聊天内容');
    }
    const summaryWindow = this.buildSummaryWindow(messages);

    const analysis = this.aiAnalysisRepo.create({
      chatId: chat.id,
      analysisType: 'summary',
      result: JSON.stringify({
        metadata: {
          triggerMode: data.triggerMode || 'manual',
        },
        retry: {
          chatId: data.chatId,
          messageLimit,
          beforeMessageId: data.beforeMessageId,
          startMessageId: data.startMessageId,
          endMessageId: data.endMessageId,
          startTime: data.startTime,
          endTime: data.endTime,
        },
        summaryWindow,
      }),
      status: 'pending',
      messageIds: messages.map((message) => message.id),
    });

    try {
      const analysisResult = await this.generateSummary(project.name, messages);
      const parsed = summaryAnalysisSchema.parse(analysisResult);

      const proposals = parsed.proposals.map((proposal) =>
        this.proposalRepo.create({
          projectId,
          chatId: chat.id,
          aiAnalysisId: analysis.id,
          targetType: proposal.targetType,
          action: proposal.action,
          title: proposal.title,
          summary: proposal.summary,
          payload: JSON.stringify(proposal.payload),
          reason: proposal.reason,
          originalTitle: proposal.title,
          originalSummary: proposal.summary,
          originalPayload: JSON.stringify(proposal.payload),
          originalReason: proposal.reason,
          sourceMessageIds: JSON.stringify(proposal.sourceMessageIds),
          confidence: proposal.confidence,
        })
      );

      const finalResult = {
        ...parsed,
        metadata: {
          ...parsed.metadata,
          provider: parsed.metadata.provider || 'local',
          triggerMode: data.triggerMode || parsed.metadata.triggerMode || 'manual',
        },
        archiveDocumentDraft: parsed.archiveDocument,
        summaryWindow,
        proposalIds: proposals.map((proposal) => proposal.id),
        retry: {
          chatId: data.chatId,
          messageLimit,
          beforeMessageId: data.beforeMessageId,
          startMessageId: data.startMessageId,
          endMessageId: data.endMessageId,
          startTime: data.startTime,
          endTime: data.endTime,
        },
      };

      this.aiAnalysisRepo.update(analysis.id, {
        result: JSON.stringify(finalResult),
        status: 'completed',
        messageIds: messages.map((message) => message.id),
      });

      this.messageRepo.create({
        chatId: chat.id,
        senderId: userId,
        type: 'ai_summary',
        content: parsed.overview,
        metadata: JSON.stringify({
          analysisId: analysis.id,
          proposalCount: proposals.length,
        }),
      });

      if (proposals.length > 0) {
        WebSocketServer.getInstance()?.notifyAIProposalCreated({
          userId: project.owner_id,
          projectId,
          projectName: project.name,
          analysisId: analysis.id,
          proposalCount: proposals.length,
          triggeredByUserId: userId,
        });
      }

      return {
        analysisId: analysis.id,
        proposalCount: proposals.length,
        overview: parsed.overview,
        archiveDocumentTitle: parsed.archiveDocument.title,
      };
    } catch (error) {
      this.aiAnalysisRepo.update(analysis.id, {
        result: JSON.stringify({
          errorMessage: error instanceof Error ? error.message : 'AI 总结失败',
          metadata: {
            triggerMode: data.triggerMode || 'manual',
          },
          retry: {
            chatId: data.chatId,
            messageLimit,
            beforeMessageId: data.beforeMessageId,
            startMessageId: data.startMessageId,
            endMessageId: data.endMessageId,
            startTime: data.startTime,
            endTime: data.endTime,
          },
          summaryWindow,
        }),
        status: 'failed',
        messageIds: messages.map((message) => message.id),
      });

      throw error;
    }
  }

  async retrySummary(projectId: number, analysisId: number, userId: number) {
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限重试 AI 总结');
    }

    const analysis = this.aiAnalysisRepo.findById(analysisId);
    if (!analysis) {
      throw new NotFoundError('AI 总结记录不存在');
    }

    const chat = this.chatRepo.findById(analysis.chat_id);
    if (!chat || chat.project_id !== projectId) {
      throw new ValidationError('该 AI 总结不属于当前项目');
    }

    const parsed = this.parseAnalysisResult(analysis.result) || {};
    const retry = parsed.retry;
    if (!retry?.chatId) {
      throw new ValidationError('该 AI 总结缺少重试上下文');
    }

    return this.summarizeProjectChat(projectId, userId, {
      chatId: retry.chatId,
      messageLimit: retry.messageLimit,
      beforeMessageId: retry.beforeMessageId,
    });
  }

  listProjectSummaries(projectId: number, userId: number): ProjectSummaryListItem[] {
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该项目成员');
    }

    const chat = this.chatRepo.findProjectChat(projectId);
    if (!chat) {
      return [];
    }

    return this.aiAnalysisRepo.findByChatId(chat.id, { analysisType: 'summary', limit: 50 }).map((analysis) => {
      const parsed = this.parseAnalysisResult(analysis.result);

      return {
        id: analysis.id,
        chat_id: analysis.chat_id,
        analysis_type: 'summary',
        status: analysis.status,
        created_at: analysis.created_at,
        archive_document_id: parsed?.archiveDocumentId,
        archive_document_title: parsed?.archiveDocumentDraft?.title || parsed?.archiveDocument?.title,
        archive_document_type: parsed?.archiveDocumentDraft?.type || parsed?.archiveDocument?.type,
        archive_document_kept: Boolean(parsed?.archiveDocumentId),
        proposal_count: parsed?.proposalIds?.length || parsed?.proposals?.length || 0,
        overview: parsed?.overview,
        error_message: parsed?.errorMessage,
        can_retry: Boolean(parsed?.retry?.chatId),
        summary_source: parsed?.metadata?.provider,
        summary_trigger_mode: parsed?.metadata?.triggerMode,
      };
    });
  }

  keepSummary(projectId: number, analysisId: number, userId: number) {
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限保留 AI 沟通纪要');
    }

    const analysis = this.aiAnalysisRepo.findById(analysisId);
    if (!analysis || analysis.analysis_type !== 'summary') {
      throw new NotFoundError('AI 总结记录不存在');
    }

    const chat = this.chatRepo.findById(analysis.chat_id);
    if (!chat || chat.project_id !== projectId) {
      throw new ValidationError('该 AI 总结不属于当前项目');
    }

    if (analysis.status !== 'completed') {
      throw new ValidationError('只有已完成的 AI 总结才能保留为纪要文档');
    }

    const parsed = this.parseAnalysisResult(analysis.result) || {};
    if (parsed.archiveDocumentId) {
      return {
        analysisId: analysis.id,
        archiveDocumentId: parsed.archiveDocumentId,
        archiveDocumentTitle: parsed.archiveDocumentDraft?.title || parsed.archiveDocument?.title,
      };
    }

    const archiveDocumentDraft = parsed.archiveDocumentDraft || parsed.archiveDocument;
    if (!archiveDocumentDraft?.title || !archiveDocumentDraft?.content) {
      throw new ValidationError('该 AI 总结缺少纪要文档草稿');
    }

    const archiveDocument = this.projectService.createDocument(projectId, userId, {
      title: archiveDocumentDraft.title,
      content: archiveDocumentDraft.content,
      format: 'markdown',
      type: archiveDocumentDraft.type,
    });

    this.aiAnalysisRepo.update(analysis.id, {
      result: JSON.stringify({
        ...parsed,
        archiveDocumentId: archiveDocument.id,
        archiveDocumentDraft,
        archiveDocumentKeptAt: new Date().toISOString(),
        archiveDocumentKeptBy: userId,
      }),
    });

    return {
      analysisId: analysis.id,
      archiveDocumentId: archiveDocument.id,
      archiveDocumentTitle: archiveDocument.title,
    };
  }

  listProjectProposals(
    projectId: number,
    userId: number,
    filters?: {
      status?: 'pending' | 'approved' | 'rejected' | 'applied' | 'failed';
      targetType?: 'project' | 'task' | 'bug' | 'document';
      chatId?: number;
    }
  ): ProjectChangeProposalWithReviewer[] {
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该项目成员');
    }

    return this.proposalRepo.findByProject(projectId, filters);
  }

  getProjectProposal(projectId: number, proposalId: number, userId: number) {
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该项目成员');
    }

    const proposal = this.proposalRepo.findWithReviewerById(proposalId);
    if (!proposal || proposal.project_id !== projectId) {
      throw new NotFoundError('提案不存在');
    }

    let sourceMessageIds: number[] = [];
    try {
      sourceMessageIds = proposal.source_message_ids ? JSON.parse(proposal.source_message_ids) : [];
    } catch {
      sourceMessageIds = [];
    }

    const sourceMessagesPreview = sourceMessageIds
      .map((messageId) => this.messageRepo.findById(messageId))
      .filter((message) => message)
      .map((message) => ({
        id: message!.id,
        sender_id: message!.sender_id,
        content: message!.content,
        created_at: message!.created_at,
      }));

    return {
      ...proposal,
      payload: this.safeJsonParse(proposal.payload),
      original_title: proposal.original_title,
      original_summary: proposal.original_summary,
      original_payload: proposal.original_payload ? this.safeJsonParse(proposal.original_payload) : undefined,
      original_reason: proposal.original_reason,
      source_message_ids: sourceMessageIds,
      source_messages_preview: sourceMessagesPreview,
    };
  }

  keepProposal(
    projectId: number,
    proposalId: number,
    reviewerId: number,
    overrides?: {
      title?: string;
      summary?: string;
      reason?: string;
      payload?: Record<string, any>;
      reviewerComment?: string;
    }
  ) {
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, reviewerId);
    if (!member || member.role !== 'owner') {
      throw new ForbiddenError('只有项目负责人可以确认 AI 内容');
    }

    const proposal = this.proposalRepo.findById(proposalId);
    if (!proposal || proposal.project_id !== projectId) {
      throw new NotFoundError('提案不存在');
    }

    if (proposal.status !== 'pending') {
      throw new ValidationError('该提案已处理，不能重复 keep');
    }

    const payload = this.buildFinalProposalPayload(proposal.target_type, this.safeJsonParse(proposal.payload) || {}, overrides);
    const reviewedAt = new Date().toISOString();
    const appliedTargetId = this.applyProposal(projectId, reviewerId, proposal.target_type, proposal.action, proposal.target_id, payload);

    const updated = this.proposalRepo.update(proposalId, {
      ...(overrides?.title !== undefined ? { title: overrides.title } : {}),
      ...(overrides?.summary !== undefined ? { summary: overrides.summary } : {}),
      ...(overrides?.reason !== undefined ? { reason: overrides.reason } : {}),
      ...(overrides?.payload !== undefined ? { payload: JSON.stringify(payload) } : {}),
      status: 'applied',
      reviewerId,
      reviewerComment: overrides?.reviewerComment || 'keep',
      reviewedAt,
      appliedAt: reviewedAt,
      ...(appliedTargetId ? { targetId: appliedTargetId } as any : {}),
    });

    return {
      proposalId: updated.id,
      status: updated.status,
      appliedTargetType: updated.target_type,
      appliedTargetId: appliedTargetId || updated.target_id,
    };
  }

  undoProposal(projectId: number, proposalId: number, reviewerId: number) {
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, reviewerId);
    if (!member || member.role !== 'owner') {
      throw new ForbiddenError('只有项目负责人可以撤销 AI 内容');
    }

    const proposal = this.proposalRepo.findById(proposalId);
    if (!proposal || proposal.project_id !== projectId) {
      throw new NotFoundError('提案不存在');
    }

    if (proposal.status !== 'pending') {
      throw new ValidationError('该提案已处理，不能重复 undo');
    }

    const reviewedAt = new Date().toISOString();
    const updated = this.proposalRepo.update(proposalId, {
      status: 'rejected',
      reviewerId,
      reviewerComment: 'undo',
      reviewedAt,
    });

    return {
      proposalId: updated.id,
      status: updated.status,
    };
  }

  private applyProposal(
    projectId: number,
    reviewerId: number,
    targetType: 'project' | 'task' | 'bug' | 'document',
    action: 'create' | 'update',
    targetId: number | undefined,
    payload: Record<string, any>
  ): number | undefined {
    switch (targetType) {
      case 'project': {
        this.projectService.updateProject(projectId, reviewerId, {
          description: payload.description,
          goal: payload.goal,
          content: payload.content,
          timeline: payload.timeline,
          milestone: payload.milestone,
          status: payload.status,
          name: payload.name,
        });
        return projectId;
      }
      case 'task': {
        if (action === 'create') {
          const created = this.projectService.createTask(projectId, reviewerId, {
            title: String(payload.title || 'AI生成任务'),
            description: payload.description,
            priority: payload.priority,
            status: payload.status,
            statusNote: payload.status && payload.status !== 'todo' ? 'AI 提案已确认' : undefined,
            assigneeId: payload.assigneeId,
            startDate: payload.startDate,
            endDate: payload.endDate,
          });
          return created.id;
        }

        if (!targetId) {
          throw new ValidationError('任务更新提案缺少目标任务');
        }

        const updated = this.projectService.updateTask(targetId, projectId, reviewerId, {
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          progress: payload.progress,
          status: payload.status,
          statusNote: payload.status || payload.progress !== undefined ? 'AI 提案已确认' : undefined,
          assigneeId: payload.assigneeId,
          startDate: payload.startDate,
          endDate: payload.endDate,
        });
        return updated.id;
      }
      case 'bug': {
        if (action === 'create') {
          const created = this.projectService.createBug(projectId, reviewerId, {
            title: String(payload.title || 'AI生成缺陷'),
            description: payload.description,
            severity: payload.severity,
            status: payload.status,
            assigneeId: payload.assigneeId,
            images: payload.images,
            statusNote: payload.status && payload.status !== 'open' ? 'AI 提案已确认' : undefined,
          });
          return created.id;
        }

        if (!targetId) {
          throw new ValidationError('缺陷更新提案缺少目标缺陷');
        }

        const updated = this.projectService.updateBug(targetId, projectId, reviewerId, {
          title: payload.title,
          description: payload.description,
          severity: payload.severity,
          status: payload.status,
          assigneeId: payload.assigneeId,
          images: payload.images,
          statusNote: payload.status ? 'AI 提案已确认' : undefined,
        });
        return updated.id;
      }
      case 'document': {
        if (action === 'create') {
          const created = this.projectService.createDocument(projectId, reviewerId, {
            title: String(payload.title || 'AI生成文档'),
            content: payload.content,
            format: payload.format,
            type: payload.type,
          });
          return created.id;
        }

        if (!targetId) {
          throw new ValidationError('文档更新提案缺少目标文档');
        }

        const updated = this.projectService.updateDocument(targetId, projectId, reviewerId, {
          title: payload.title,
          content: payload.content,
          format: payload.format,
          type: payload.type,
        });
        return updated.id;
      }
      default:
        throw new ValidationError('不支持的提案类型');
    }
  }

  private parseAnalysisResult(raw: string): any {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private safeJsonParse(raw: string): any {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  private buildFinalProposalPayload(
    targetType: 'project' | 'task' | 'bug' | 'document',
    originalPayload: Record<string, any>,
    overrides?: {
      title?: string;
      payload?: Record<string, any>;
    }
  ) {
    const nextPayload = {
      ...originalPayload,
      ...(overrides?.payload || {}),
    };

    if (overrides?.title && targetType !== 'project') {
      nextPayload.title = overrides.title;
    }

    return nextPayload;
  }

  private buildSummaryWindow(messages: Array<{ id: number; content: string; created_at: string }>) {
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    if (!firstMessage || !lastMessage) {
      return undefined;
    }

    return {
      messageCount: messages.length,
      startMessageId: firstMessage.id,
      endMessageId: lastMessage.id,
      startCreatedAt: firstMessage.created_at,
      endCreatedAt: lastMessage.created_at,
      startPreview: this.truncateText(firstMessage.content || '', 120),
      endPreview: this.truncateText(lastMessage.content || '', 120),
    };
  }

  private async generateSummary(projectName: string, messages: Array<{ id: number; sender_id: number; content: string; created_at: string }>): Promise<SummaryAnalysisResult> {
    const enrichedMessages = messages.map((message) => {
      const user = this.userRepo.findById(message.sender_id);
      return {
        ...message,
        senderName: user?.display_name || user?.username || `用户${message.sender_id}`,
        normalizedContent: String(message.content || '').replace(/\s+/g, ' ').trim(),
      };
    });

    const geminiSummary = await this.generateSummaryWithGemini(projectName, enrichedMessages);
    if (geminiSummary) {
      return geminiSummary;
    }

    const highlights = this.collectHighlights(enrichedMessages);
    const decisions = this.collectDecisions(enrichedMessages);
    const projectUpdates = this.collectProjectUpdates(enrichedMessages);
    const proposals = this.collectProposals(enrichedMessages);
    const overview = this.buildOverview(projectName, enrichedMessages.length, highlights, decisions, projectUpdates, proposals.length);

    return {
      overview,
      highlights,
      decisions,
      projectUpdates,
      archiveDocument: {
        title: `AI对话归档-${projectName}-${new Date().toISOString().slice(0, 10)}`,
        content: this.buildArchiveContent(projectName, enrichedMessages, overview, highlights, decisions, projectUpdates, proposals),
        type: 'meeting_minutes',
      },
      proposals,
      metadata: {
        messageCount: enrichedMessages.length,
        generatedAt: new Date().toISOString(),
        provider: 'local',
      },
    };
  }

  private async generateSummaryWithGemini(
    projectName: string,
    messages: Array<{ id: number; senderName: string; normalizedContent: string; created_at: string }>
  ): Promise<SummaryAnalysisResult | null> {
    if (process.env.AI_SUMMARY_FORCE_FAIL === '1') {
      throw new Error('AI_SUMMARY_FORCE_FAIL');
    }

    if (!config.ai.geminiEnabled || !config.ai.geminiApiKey) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.ai.geminiTimeoutMs);

    try {
      const response = await fetch(
        `${config.ai.geminiApiUrl}/${config.ai.geminiModel}:generateContent?key=${encodeURIComponent(config.ai.geminiApiKey)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: this.buildGeminiPrompt(projectName, messages),
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn('Gemini summary request failed, falling back to local summarizer', {
          status: response.status,
          body: this.truncateText(errorText, 300),
        });
        return null;
      }

      const responseBody = await response.json() as any;
      const candidateText = responseBody?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || '')
        .join('')
        .trim();

      if (!candidateText) {
        logger.warn('Gemini summary response was empty, falling back to local summarizer');
        return null;
      }

      const parsed = this.parseGeminiSummary(candidateText);
      if (!parsed) {
        logger.warn('Gemini summary response could not be parsed, falling back to local summarizer');
        return null;
      }

      const normalized = summaryAnalysisSchema.parse(parsed);
      return {
        ...normalized,
        metadata: {
          ...normalized.metadata,
          provider: 'gemini',
        },
      };
    } catch (error) {
      logger.warn('Gemini summary request threw, falling back to local summarizer', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildGeminiPrompt(
    projectName: string,
    messages: Array<{ id: number; senderName: string; normalizedContent: string; created_at: string }>
  ): string {
    const transcript = messages
      .map((message) => `[${message.id}] ${message.created_at} ${message.senderName}: ${message.normalizedContent}`)
      .join('\n');

    return [
      '你是项目群聊分析助手。',
      `请基于项目 ${projectName} 的群聊内容，输出严格 JSON。不要输出 markdown 代码块，不要输出额外解释。`,
      '输出 JSON 结构必须与下述示例同构：',
      JSON.stringify({
        overview: 'string',
        highlights: ['string'],
        decisions: ['string'],
        projectUpdates: ['string'],
        archiveDocument: {
          title: 'string',
          content: 'markdown string',
          type: 'meeting_minutes',
        },
        proposals: [
          {
            targetType: 'task',
            action: 'create',
            title: 'string',
            summary: 'string',
            payload: {
              title: 'string',
              description: 'string',
            },
            reason: 'string',
            sourceMessageIds: [1],
            confidence: 0.8,
          },
        ],
        metadata: {
          messageCount: messages.length,
          generatedAt: new Date().toISOString(),
        },
      }),
      '约束：',
      '1. proposals.targetType 只能是 project/task/bug/document。',
      '2. proposals.action 只能是 create 或 update。',
      '3. sourceMessageIds 只能引用下方真实存在的消息 id。',
      '4. 没有足够证据时，不要生成提案，返回空数组。',
      '5. archiveDocument.content 使用 markdown。',
      '6. confidence 为 0 到 1 之间的小数。',
      '群聊内容：',
      transcript,
    ].join('\n\n');
  }

  private parseGeminiSummary(raw: string): SummaryAnalysisResult | null {
    const normalized = raw.trim();
    const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fencedMatch?.[1]?.trim() || normalized;

    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  private collectHighlights(messages: Array<{ normalizedContent: string; senderName: string }>): string[] {
    return messages
      .filter((message) => /(完成|计划|需要|安排|讨论|确认|上线|修复|优化|进度|文档|任务|缺陷)/i.test(message.normalizedContent))
      .slice(-5)
      .map((message) => `${message.senderName}：${this.truncateText(message.normalizedContent, 80)}`);
  }

  private collectDecisions(messages: Array<{ normalizedContent: string; senderName: string }>): string[] {
    return messages
      .filter((message) => /(决定|确认|采用|按.*处理|就这样|结论|确定)/i.test(message.normalizedContent))
      .slice(-4)
      .map((message) => `${message.senderName}：${this.truncateText(message.normalizedContent, 80)}`);
  }

  private collectProjectUpdates(messages: Array<{ normalizedContent: string; senderName: string }>): string[] {
    return messages
      .filter((message) => /(进度|延期|里程碑|排期|风险|阻塞|上线|版本)/i.test(message.normalizedContent))
      .slice(-4)
      .map((message) => `${message.senderName}：${this.truncateText(message.normalizedContent, 80)}`);
  }

  private collectProposals(messages: Array<{ id: number; normalizedContent: string; senderName: string }>): SummaryAnalysisResult['proposals'] {
    const proposals: SummaryAnalysisResult['proposals'] = [];
    const seenKeys = new Set<string>();

    for (const message of messages) {
      const content = message.normalizedContent;

      const maybeTask = /(任务|待办|todo|需要做|安排一下|跟进)/i.test(content);
      const maybeBug = /(bug|缺陷|报错|异常|问题|修复)/i.test(content);
      const maybeDocument = /(文档|说明|记录|设计稿|prd|接口文档|方案)/i.test(content);
      const maybeProject = /(进度|里程碑|排期|延期|状态|上线)/i.test(content);

      if (maybeTask) {
        const title = this.buildProposalTitle(content, '任务');
        const key = `task:${title}`;
        if (!seenKeys.has(key)) {
          proposals.push({
            targetType: 'task',
            action: 'create',
            title,
            summary: `根据群聊内容建议新增任务：${title}`,
            payload: {
              title,
              description: `来源群聊自动提取：${content}`,
              priority: /(紧急|尽快|优先|阻塞)/.test(content) ? 'high' : 'medium',
              status: 'todo',
            },
            reason: `${message.senderName} 在讨论中提出了可执行任务。`,
            sourceMessageIds: [message.id],
            confidence: 0.74,
          });
          seenKeys.add(key);
        }
      }

      if (maybeBug) {
        const title = this.buildProposalTitle(content, '缺陷');
        const key = `bug:${title}`;
        if (!seenKeys.has(key)) {
          proposals.push({
            targetType: 'bug',
            action: 'create',
            title,
            summary: `根据群聊内容建议登记缺陷：${title}`,
            payload: {
              title,
              description: `来源群聊自动提取：${content}`,
              severity: /(严重|阻塞|critical|致命)/i.test(content) ? 'high' : 'medium',
              status: 'open',
            },
            reason: `${message.senderName} 提到了明确的问题或修复诉求。`,
            sourceMessageIds: [message.id],
            confidence: 0.78,
          });
          seenKeys.add(key);
        }
      }

      if (maybeDocument) {
        const title = this.buildProposalTitle(content, '文档');
        const key = `document:${title}`;
        if (!seenKeys.has(key)) {
          proposals.push({
            targetType: 'document',
            action: 'create',
            title,
            summary: `根据群聊内容建议补充文档：${title}`,
            payload: {
              title,
              content: `AI 从群聊中提取的文档初稿线索：\n\n- 来源内容：${content}`,
              type: normalizeDocumentType(
                /(接口|api)/i.test(content)
                  ? 'api'
                  : /(测试|用例)/.test(content)
                  ? 'test_cases'
                  : /(部署|发布|上线)/.test(content)
                  ? 'deployment'
                  : /(需求|prd)/i.test(content)
                  ? 'requirements_design'
                  : /(设计|方案)/.test(content)
                  ? 'development_design'
                  : 'other'
              ),
              format: 'markdown',
            },
            reason: `${message.senderName} 的讨论涉及需要沉淀的文档信息。`,
            sourceMessageIds: [message.id],
            confidence: 0.71,
          });
          seenKeys.add(key);
        }
      }

      if (maybeProject) {
        const title = this.buildProposalTitle(content, '项目更新');
        const key = `project:${title}`;
        if (!seenKeys.has(key)) {
          proposals.push({
            targetType: 'project',
            action: 'update',
            title,
            summary: `根据群聊内容建议更新项目信息：${title}`,
            payload: {
              milestone: this.truncateText(content, 100),
            },
            reason: `${message.senderName} 的讨论涉及项目状态、排期或里程碑变更。`,
            sourceMessageIds: [message.id],
            confidence: 0.66,
          });
          seenKeys.add(key);
        }
      }

      if (proposals.length >= 6) {
        break;
      }
    }

    return proposals;
  }

  private buildOverview(
    projectName: string,
    messageCount: number,
    highlights: string[],
    decisions: string[],
    projectUpdates: string[],
    proposalCount: number
  ): string {
    const fragments = [
      `已整理 ${projectName} 项目群最近 ${messageCount} 条消息。`,
      highlights.length > 0 ? `提取到 ${highlights.length} 条重点讨论。` : '未提取到明显重点讨论。',
      decisions.length > 0 ? `识别到 ${decisions.length} 条决策信息。` : '未识别到明确决策。',
      projectUpdates.length > 0 ? `捕获到 ${projectUpdates.length} 条项目进展信号。` : '未发现明显进展更新。',
      proposalCount > 0 ? `生成 ${proposalCount} 条待确认项目提案。` : '未生成待确认提案。',
    ];

    return fragments.join(' ');
  }

  private buildArchiveContent(
    projectName: string,
    messages: Array<{ senderName: string; normalizedContent: string; created_at: string }>,
    overview: string,
    highlights: string[],
    decisions: string[],
    projectUpdates: string[],
    proposals: SummaryAnalysisResult['proposals']
  ): string {
    const recentMessages = messages.slice(-10).map((message) => `- ${message.created_at} ${message.senderName}：${message.normalizedContent}`);
    const proposalLines = proposals.map((proposal, index) => `- ${index + 1}. [${proposal.targetType}/${proposal.action}] ${proposal.title}：${proposal.summary}`);

    return [
      `# ${projectName} 群聊 AI 归档`,
      '',
      '## 总览',
      overview,
      '',
      '## 重点讨论',
      ...(highlights.length > 0 ? highlights.map((item) => `- ${item}`) : ['- 无']),
      '',
      '## 决策结论',
      ...(decisions.length > 0 ? decisions.map((item) => `- ${item}`) : ['- 无']),
      '',
      '## 项目管理相关内容',
      ...(projectUpdates.length > 0 ? projectUpdates.map((item) => `- ${item}`) : ['- 无']),
      '',
      '## AI 生成提案',
      ...(proposalLines.length > 0 ? proposalLines : ['- 无']),
      '',
      '## 最近消息摘录',
      ...(recentMessages.length > 0 ? recentMessages : ['- 无']),
    ].join('\n');
  }

  private buildProposalTitle(content: string, fallback: string): string {
    const normalized = content
      .replace(/^(任务|待办|bug|缺陷|文档|说明|记录|进度|里程碑)[:：\s-]*/i, '')
      .trim();

    return this.truncateText(normalized || fallback, 36);
  }

  private truncateText(content: string, maxLength: number): string {
    return content.length <= maxLength ? content : `${content.slice(0, maxLength).trim()}...`;
  }
}
