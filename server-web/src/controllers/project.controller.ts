import { Response, NextFunction } from 'express';
import { ProjectService } from '../services/project.service';
import { ProjectAIService } from '../services/project-ai.service';
import { successResponse, paginatedResponse } from '../utils/response.util';
import { AuthRequest } from '../types/api.types';

export class ProjectController {
  private projectService: ProjectService;
  private projectAIService: ProjectAIService;

  constructor() {
    this.projectService = new ProjectService();
    this.projectAIService = new ProjectAIService();
  }

  private getRequestBaseUrl(req: AuthRequest): string {
    return `${req.protocol}://${req.get('host')}`;
  }

  private serializePrototype(req: AuthRequest, prototype: any) {
    const previewPath = prototype.entry_file || 'index.html';
    return {
      ...prototype,
      preview_url: `${this.getRequestBaseUrl(req)}/prototype-preview/${prototype.preview_key}/${previewPath}`,
    };
  }

  getProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = this.projectService.getUserProjects(userId, page, pageSize);

      // 返回项目数组而不是包装对象
      res.json(successResponse(result.projects));
    } catch (error) {
      next(error);
    }
  };

  createProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { name, description, goal, content, timeline, milestone, ownerId } = req.body;

      const project = await this.projectService.createProject(userId, {
        name,
        description,
        goal,
        content,
        timeline,
        milestone,
        ownerId,
      });

      res.status(201).json(successResponse(project, '创建成功'));
    } catch (error) {
      next(error);
    }
  };

  getProjectDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);

      const project = this.projectService.getProjectDetail(projectId, userId);

      res.json(successResponse(project));
    } catch (error) {
      next(error);
    }
  };

  updateProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const { name, description, status, goal, content, timeline, milestone, ownerId } = req.body;

      const project = this.projectService.updateProject(projectId, userId, {
        name,
        description,
        status,
        goal,
        content,
        timeline,
        milestone,
        owner_id: ownerId,
      });

      res.json(successResponse(project, '更新成功'));
    } catch (error) {
      next(error);
    }
  };

  getMembers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);

      const members = this.projectService.getMembers(projectId, userId);

      res.json(successResponse(members));
    } catch (error) {
      next(error);
    }
  };

  openProjectChat = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId, 10);

      const chat = this.projectService.openProjectChat(projectId, userId);

      res.json(successResponse(chat));
    } catch (error) {
      next(error);
    }
  };

  addMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const { userId: newMemberId, role } = req.body;

      const member = await this.projectService.addMember(projectId, userId, newMemberId, role);

      res.status(201).json(successResponse(member, '添加成功'));
    } catch (error) {
      next(error);
    }
  };

  removeMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const memberId = parseInt(req.params.memberId);

      this.projectService.removeMember(projectId, userId, memberId);

      res.json(successResponse(null, '移除成功'));
    } catch (error) {
      next(error);
    }
  };

  searchProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { q } = req.query;

      const projects = this.projectService.searchProjects(q as string, userId);

      res.json(successResponse(projects));
    } catch (error) {
      next(error);
    }
  };

  deleteProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);

      this.projectService.deleteProject(projectId, userId);

      res.json(successResponse(null, '删除成功'));
    } catch (error) {
      next(error);
    }
  };

  updateMemberRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const memberId = parseInt(req.params.memberId);
      const { role } = req.body;

      const member = this.projectService.updateMemberRole(projectId, userId, memberId, role);

      res.json(successResponse(member, '更新角色成功'));
    } catch (error) {
      next(error);
    }
  };

  getTasks = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const { status, priority, assigneeId, q, page, pageSize } = req.query;

      const result = this.projectService.getTasks(projectId, userId, {
        status: status as string,
        priority: priority as string,
        assigneeId: assigneeId ? parseInt(assigneeId as string, 10) : undefined,
        keyword: q as string,
        page: page ? parseInt(page as string, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize as string, 10) : 10,
      });

      res.json(paginatedResponse(result.tasks, result.page, result.pageSize, result.total));
    } catch (error) {
      next(error);
    }
  };

  getTaskDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const taskId = parseInt(req.params.taskId);

      const task = this.projectService.getProjectTask(taskId, projectId, userId);
      res.json(successResponse(task));
    } catch (error) {
      next(error);
    }
  };

  createTask = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const { title, description, priority, status, statusNote, assigneeId, startDate, endDate } = req.body;

      if (!title || title.trim() === '') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '任务标题不能为空',
          },
        });
        return;
      }

      const task = this.projectService.createTask(projectId, userId, {
        title,
        description,
        priority,
        status,
        statusNote,
        assigneeId,
        startDate,
        endDate,
      });

      res.status(201).json(successResponse(task, '创建任务成功'));
    } catch (error) {
      next(error);
    }
  };

  updateTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const taskId = parseInt(req.params.taskId);
      const { title, description, status, statusNote, priority, progress, assigneeId, startDate, endDate } = req.body;

      const task = this.projectService.updateTask(taskId, projectId, userId, {
        title,
        description,
        status,
        statusNote,
        priority,
        progress,
        assigneeId,
        startDate,
        endDate,
      });

      res.json(successResponse(task, '更新任务成功'));
    } catch (error) {
      next(error);
    }
  };

  deleteTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const taskId = parseInt(req.params.taskId);

      this.projectService.deleteTask(taskId, projectId, userId);

      res.json(successResponse(null, '删除任务成功'));
    } catch (error) {
      next(error);
    }
  };

  // ============= Bug Controllers =============

  getBugs = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const { status, severity, assigneeId, q, page, pageSize } = req.query;

      const result = this.projectService.getProjectBugs(projectId, userId, {
        status: status as string,
        severity: severity as string,
        assigneeId: assigneeId ? parseInt(assigneeId as string) : undefined,
        keyword: q as string,
        page: page ? parseInt(page as string, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize as string, 10) : 10,
      });

      res.json(paginatedResponse(result.bugs, result.page, result.pageSize, result.total));
    } catch (error) {
      next(error);
    }
  };

  getBugDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const bugId = parseInt(req.params.bugId);

      const bug = this.projectService.getProjectBug(bugId, projectId, userId);
      res.json(successResponse(bug));
    } catch (error) {
      next(error);
    }
  };

  createBug = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const { title, description, severity, status, assigneeId, images, statusNote } = req.body;

      if (!title || title.trim() === '') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '缺陷标题不能为空',
          },
        });
        return;
      }

      const bug = this.projectService.createBug(projectId, userId, {
        title,
        description,
        severity,
        status,
        assigneeId,
        images,
        statusNote,
      });

      res.status(201).json(successResponse(bug, '创建缺陷成功'));
    } catch (error) {
      next(error);
    }
  };

  updateBug = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const bugId = parseInt(req.params.bugId);
      const { title, description, severity, status, assigneeId, images, statusNote } = req.body;

      const bug = this.projectService.updateBug(bugId, projectId, userId, {
        title,
        description,
        severity,
        status,
        assigneeId,
        images,
        statusNote,
      });

      res.json(successResponse(bug, '更新缺陷成功'));
    } catch (error) {
      next(error);
    }
  };

  deleteBug = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const bugId = parseInt(req.params.bugId);

      this.projectService.deleteBug(bugId, projectId, userId);

      res.json(successResponse(null, '删除缺陷成功'));
    } catch (error) {
      next(error);
    }
  };

  // ============= Document Controllers =============

  getDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const { type, q, page, pageSize } = req.query;

      const result = this.projectService.getProjectDocuments(projectId, userId, {
        type: type as string,
        keyword: q as string,
        page: page ? parseInt(page as string, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize as string, 10) : 10,
      });

      res.json(paginatedResponse(result.documents, result.page, result.pageSize, result.total));
    } catch (error) {
      next(error);
    }
  };

  getDocumentDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const documentId = parseInt(req.params.documentId);

      const document = this.projectService.getProjectDocument(documentId, projectId, userId);

      res.json(successResponse(document));
    } catch (error) {
      next(error);
    }
  };

  createDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const { title, content, format, type } = req.body;

      if (!title || title.trim() === '') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '文档标题不能为空',
          },
        });
        return;
      }

      const document = this.projectService.createDocument(projectId, userId, {
        title,
        content,
        format,
        type,
      });

      res.status(201).json(successResponse(document, '创建文档成功'));
    } catch (error) {
      next(error);
    }
  };

  updateDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const documentId = parseInt(req.params.documentId);
      const { title, content, format, type } = req.body;

      const document = this.projectService.updateDocument(documentId, projectId, userId, {
        title,
        content,
        format,
        type,
      });

      res.json(successResponse(document, '更新文档成功'));
    } catch (error) {
      next(error);
    }
  };

  deleteDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const documentId = parseInt(req.params.documentId);

      this.projectService.deleteDocument(documentId, projectId, userId);

      res.json(successResponse(null, '删除文档成功'));
    } catch (error) {
      next(error);
    }
  };

  getDocumentComments = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const documentId = parseInt(req.params.documentId);

      const comments = this.projectService.getDocumentComments(documentId, projectId, userId);
      res.json(successResponse(comments));
    } catch (error) {
      next(error);
    }
  };

  createDocumentComment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const documentId = parseInt(req.params.documentId);
      const { content } = req.body;

      if (!content || !String(content).trim()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '评论内容不能为空',
          },
        });
        return;
      }

      const comment = this.projectService.createDocumentComment(documentId, projectId, userId, String(content).trim());
      res.status(201).json(successResponse(comment, '评论成功'));
    } catch (error) {
      next(error);
    }
  };

  deleteDocumentComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const documentId = parseInt(req.params.documentId);
      const commentId = parseInt(req.params.commentId);

      this.projectService.deleteDocumentComment(commentId, documentId, projectId, userId);
      res.json(successResponse(null, '删除评论成功'));
    } catch (error) {
      next(error);
    }
  };

  createAISummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId, 10);
      const { chatId, messageLimit, beforeMessageId, startMessageId, endMessageId, startTime, endTime } = req.body;

      const result = await this.projectAIService.summarizeProjectChat(projectId, userId, {
        chatId: parseInt(chatId, 10),
        messageLimit: messageLimit ? parseInt(messageLimit, 10) : undefined,
        beforeMessageId: beforeMessageId ? parseInt(beforeMessageId, 10) : undefined,
        startMessageId: startMessageId ? parseInt(startMessageId, 10) : undefined,
        endMessageId: endMessageId ? parseInt(endMessageId, 10) : undefined,
        startTime: startTime ? String(startTime) : undefined,
        endTime: endTime ? String(endTime) : undefined,
      });

      res.status(201).json(successResponse(result, 'AI 总结已生成'));
    } catch (error) {
      next(error);
    }
  };

  getAISummaries = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId, 10);

      const result = this.projectAIService.listProjectSummaries(projectId, userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  retryAISummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId, 10);
      const analysisId = parseInt(req.params.analysisId, 10);

      const result = await this.projectAIService.retrySummary(projectId, analysisId, userId);
      res.status(201).json(successResponse(result, 'AI 总结已重新生成'));
    } catch (error) {
      next(error);
    }
  };

  keepAISummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId, 10);
      const analysisId = parseInt(req.params.analysisId, 10);

      const result = this.projectAIService.keepSummary(projectId, analysisId, userId);
      res.json(successResponse(result, '沟通纪要已加入项目文档'));
    } catch (error) {
      next(error);
    }
  };

  getAIProposals = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId, 10);
      const { status, targetType, chatId } = req.query;

      const result = this.projectAIService.listProjectProposals(projectId, userId, {
        status: status as any,
        targetType: targetType as any,
        chatId: chatId ? parseInt(chatId as string, 10) : undefined,
      });

      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  getAIProposalDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId, 10);
      const proposalId = parseInt(req.params.proposalId, 10);

      const result = this.projectAIService.getProjectProposal(projectId, proposalId, userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  keepAIProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId, 10);
      const proposalId = parseInt(req.params.proposalId, 10);

      const { title, summary, reason, payload, reviewerComment } = req.body || {};
      const result = this.projectAIService.keepProposal(projectId, proposalId, userId, {
        title,
        summary,
        reason,
        payload,
        reviewerComment,
      });
      res.json(successResponse(result, 'AI 内容已保留到项目管理'));
    } catch (error) {
      next(error);
    }
  };

  undoAIProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId, 10);
      const proposalId = parseInt(req.params.proposalId, 10);

      const result = this.projectAIService.undoProposal(projectId, proposalId, userId);
      res.json(successResponse(result, 'AI 内容已撤销'));
    } catch (error) {
      next(error);
    }
  };

  // ============= Repository Controllers =============

  getRepositories = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const { platform, isActive } = req.query;

      const repositories = this.projectService.getProjectRepositories(projectId, userId, {
        platform: platform as string,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
      });

      res.json(successResponse(repositories));
    } catch (error) {
      next(error);
    }
  };

  getRepositoryDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const repositoryId = parseInt(req.params.repositoryId);

      const repositoryDetail = await this.projectService.getProjectRepositoryDetail(repositoryId, projectId, userId);
      res.json(successResponse(repositoryDetail));
    } catch (error) {
      next(error);
    }
  };

  createRepository = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const { name, url, platform, accessToken, isActive } = req.body;

      if (!name || name.trim() === '') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '仓库名称不能为空',
          },
        });
        return;
      }

      if (!url || url.trim() === '') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '仓库URL不能为空',
          },
        });
        return;
      }

      const repository = this.projectService.createRepository(projectId, userId, {
        name,
        url,
        platform,
        accessToken,
        isActive,
      });

      res.status(201).json(successResponse(repository, '创建仓库成功'));
    } catch (error) {
      next(error);
    }
  };

  updateRepository = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const repositoryId = parseInt(req.params.repositoryId);
      const { name, url, platform, accessToken, isActive } = req.body;

      const repository = this.projectService.updateRepository(repositoryId, projectId, userId, {
        name,
        url,
        platform,
        accessToken,
        isActive,
      });

      res.json(successResponse(repository, '更新仓库成功'));
    } catch (error) {
      next(error);
    }
  };

  deleteRepository = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId);
      const repositoryId = parseInt(req.params.repositoryId);

      this.projectService.deleteRepository(repositoryId, projectId, userId);

      res.json(successResponse(null, '删除仓库成功'));
    } catch (error) {
      next(error);
    }
  };

  getProjectPrototypes = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId, 10);

      const prototypes = this.projectService.getProjectPrototypes(projectId, userId);
      res.json(successResponse(prototypes.map((prototype) => this.serializePrototype(req, prototype))));
    } catch (error) {
      next(error);
    }
  };

  getProjectPrototypeDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId, 10);
      const prototypeId = parseInt(req.params.prototypeId, 10);

      const prototype = this.projectService.getProjectPrototype(prototypeId, projectId, userId);
      res.json(successResponse(this.serializePrototype(req, prototype)));
    } catch (error) {
      next(error);
    }
  };

  createProjectPrototype = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId, 10);
      const { name, description } = req.body;

      if (!name || String(name).trim() === '') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '原型稿名称不能为空',
          },
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请上传原型稿 zip 压缩包',
          },
        });
        return;
      }

      const prototype = await this.projectService.createProjectPrototype(projectId, userId, {
        name: String(name).trim(),
        description: description ? String(description).trim() : undefined,
        archiveTempFilePath: req.file.path,
        archiveOriginalName: req.file.originalname,
      });

      res.status(201).json(successResponse(this.serializePrototype(req, prototype), '上传原型稿成功'));
    } catch (error) {
      next(error);
    }
  };

  updateProjectPrototype = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId, 10);
      const prototypeId = parseInt(req.params.prototypeId, 10);
      const { name, description } = req.body;

      const prototype = await this.projectService.updateProjectPrototype(prototypeId, projectId, userId, {
        name: name !== undefined ? String(name).trim() : undefined,
        description: description !== undefined ? String(description).trim() : undefined,
        archiveTempFilePath: req.file?.path,
        archiveOriginalName: req.file?.originalname,
      });

      res.json(successResponse(this.serializePrototype(req, prototype), '更新原型稿成功'));
    } catch (error) {
      next(error);
    }
  };

  deleteProjectPrototype = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const projectId = parseInt(req.params.projectId, 10);
      const prototypeId = parseInt(req.params.prototypeId, 10);

      await this.projectService.deleteProjectPrototype(prototypeId, projectId, userId);
      res.json(successResponse(null, '删除原型稿成功'));
    } catch (error) {
      next(error);
    }
  };
}
