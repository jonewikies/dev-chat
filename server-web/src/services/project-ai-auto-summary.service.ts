import { config } from '../config/app';
import { AIAnalysisRepository } from '../repositories/ai-analysis.repository';
import { ChatRepository } from '../repositories/chat.repository';
import { MessageRepository } from '../repositories/message.repository';
import { ProjectRepository } from '../repositories/project.repository';
import logger from '../utils/logger.util';
import { ProjectAIService } from './project-ai.service';

export class ProjectAIAutoSummaryService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private projectAIService = new ProjectAIService();
  private projectRepo = new ProjectRepository();
  private chatRepo = new ChatRepository();
  private messageRepo = new MessageRepository();
  private aiAnalysisRepo = new AIAnalysisRepository();

  start() {
    if (!config.ai.autoSummaryEnabled || this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runOnce();
    }, Math.max(60000, config.ai.autoSummaryIntervalMs));

    logger.info(`Project AI auto summary scheduler enabled (interval=${Math.max(60000, config.ai.autoSummaryIntervalMs)}ms)`);
    void this.runOnce();
  }

  stop() {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
    logger.info('Project AI auto summary scheduler stopped');
  }

  async runOnce() {
    if (this.running) {
      logger.debug('Skip AI auto summary cycle because previous cycle is still running');
      return;
    }

    this.running = true;

    try {
      const projects = this.projectRepo.findAll(500, 0);

      for (const project of projects) {
        try {
          await this.trySummarizeProject(project.id, project.owner_id);
        } catch (error) {
          logger.error(`Project AI auto summary failed for project ${project.id}:`, error);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async trySummarizeProject(projectId: number, ownerId: number) {
    const chat = this.chatRepo.findProjectChat(projectId);
    if (!chat) {
      return;
    }

    const latestAnalyses = this.aiAnalysisRepo.findByChatId(chat.id, { analysisType: 'summary', limit: 5 });
    if (latestAnalyses.some((analysis) => analysis.status === 'pending')) {
      return;
    }

    const latestSummary = latestAnalyses[0];
    if (latestSummary) {
      const lastCreatedAt = new Date(latestSummary.created_at).getTime();
      if (!Number.isNaN(lastCreatedAt) && Date.now() - lastCreatedAt < config.ai.autoSummaryCooldownMs) {
        return;
      }
    }

    const lastProcessedMessageId = Math.max(0, ...(latestAnalyses.flatMap((analysis) => analysis.message_ids || [])));
    const recentMessages = this.messageRepo
      .findByChatId(chat.id, Math.max(config.ai.autoSummaryMessageLimit, config.ai.autoSummaryMinMessages))
      .filter((message) => !message.is_deleted && message.type === 'text' && String(message.content || '').trim());

    const newMessages = recentMessages.filter((message) => message.id > lastProcessedMessageId);
    if (newMessages.length < config.ai.autoSummaryMinMessages) {
      return;
    }

    const messageLimit = Math.min(config.ai.autoSummaryMessageLimit, Math.max(config.ai.autoSummaryMinMessages, newMessages.length));

    logger.info(`Triggering project AI auto summary for project ${projectId} with ${newMessages.length} new messages`);
    await this.projectAIService.summarizeProjectChat(projectId, ownerId, {
      chatId: chat.id,
      messageLimit,
      triggerMode: 'auto',
    });
  }
}