import { ProjectRepository } from '../repositories/project.repository';
import { ProjectMemberRepository } from '../repositories/project-member.repository';
import { TaskRepository } from '../repositories/task.repository';
import { BugRepository } from '../repositories/bug.repository';
import { DocumentRepository } from '../repositories/document.repository';
import { DocumentCommentRepository } from '../repositories/document-comment.repository';
import { RepositoryRepository } from '../repositories/repository.repository';
import { ProjectPrototypeRepository } from '../repositories/project-prototype.repository';
import { ChatRepository } from '../repositories/chat.repository';
import { ChatMemberRepository } from '../repositories/chat.repository';
import type { DocumentType } from '../constants/document';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/error.util';
import { Project, Task, TaskWithAssignee, Bug, BugWithUsers, Document, DocumentWithAuthor, DocumentComment, DocumentCommentWithAuthor, Repository, ProjectPrototype } from '../types/db.types';
import { GitLabService, RepositoryDetailPayload } from './gitlab.service';
import { PrototypeArchiveService } from './prototype-archive.service';

export class ProjectService {
  private projectRepo: ProjectRepository;
  private projectMemberRepo: ProjectMemberRepository;
  private taskRepo: TaskRepository;
  private bugRepo: BugRepository;
  private documentRepo: DocumentRepository;
  private documentCommentRepo: DocumentCommentRepository;
  private repositoryRepo: RepositoryRepository;
  private prototypeRepo: ProjectPrototypeRepository;
  private chatRepo: ChatRepository;
  private chatMemberRepo: ChatMemberRepository;
  private gitLabService: GitLabService;
  private prototypeArchiveService: PrototypeArchiveService;

  constructor() {
    this.projectRepo = new ProjectRepository();
    this.projectMemberRepo = new ProjectMemberRepository();
    this.taskRepo = new TaskRepository();
    this.bugRepo = new BugRepository();
    this.documentRepo = new DocumentRepository();
    this.documentCommentRepo = new DocumentCommentRepository();
    this.repositoryRepo = new RepositoryRepository();
    this.prototypeRepo = new ProjectPrototypeRepository();
    this.chatRepo = new ChatRepository();
    this.chatMemberRepo = new ChatMemberRepository();
    this.gitLabService = new GitLabService();
    this.prototypeArchiveService = new PrototypeArchiveService();
  }

  private getProjectChatName(projectName: string) {
    return `${projectName}项目管理群`;
  }

  private ensureProjectChatMembers(project: Project, chatId: number) {
    const creatorMember = this.chatMemberRepo.findByChatAndUser(chatId, project.creator_id);
    if (!creatorMember) {
      this.chatMemberRepo.addMember(chatId, project.creator_id, 'admin');
    } else if (creatorMember.role !== 'admin') {
      this.chatMemberRepo.updateRole(chatId, project.creator_id, 'admin');
    }

    const projectMembers = this.projectMemberRepo.findByProject(project.id);
    for (const member of projectMembers) {
      const chatMember = this.chatMemberRepo.findByChatAndUser(chatId, member.user_id);
      if (!chatMember) {
        this.chatMemberRepo.addMember(
          chatId,
          member.user_id,
          member.user_id === project.creator_id ? 'admin' : 'member'
        );
      }
    }
  }

  private ensureProjectMember(projectId: number, userId: number) {
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该项目成员');
    }
    return member;
  }

  getUserProjects(userId: number, page: number = 1, pageSize: number = 20) {
    const offset = (page - 1) * pageSize;
    const projects = this.projectRepo.findByUser(userId, pageSize, offset);

    return {
      projects,
      pagination: {
        page,
        pageSize,
        // TODO: Add total count
      },
    };
  }

  async createProject(
    userId: number,
    data: {
      name: string;
      description?: string;
      goal?: string;
      content?: string;
      timeline?: string;
      milestone?: string;
      ownerId?: number;
    }
  ): Promise<Project> {
    // 验证必填字段
    if (!data.name) {
      throw new ValidationError('项目名称为必填项');
    }

    // 创建项目
    const ownerId = data.ownerId || userId;
    const project = this.projectRepo.create({
      name: data.name,
      description: data.description,
      goal: data.goal,
      content: data.content,
      timeline: data.timeline,
      milestone: data.milestone,
      creatorId: userId,
      ownerId: ownerId,
    });

    // 添加创建者为项目所有者
    this.projectMemberRepo.create({
      projectId: project.id,
      userId,
      role: 'owner',
    });

    if (ownerId !== userId) {
      this.projectMemberRepo.create({
        projectId: project.id,
        userId: ownerId,
        role: 'owner',
      });
    }

    return project;
  }

  openProjectChat(projectId: number, userId: number) {
    const project = this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    this.ensureProjectMember(projectId, userId);

    const expectedName = this.getProjectChatName(project.name);
    let chat = this.chatRepo.findProjectChat(projectId);

    if (!chat) {
      chat = this.chatRepo.create({
        type: 'project',
        createdBy: project.creator_id,
        name: expectedName,
        projectId: project.id,
      });
    } else if (chat.name !== expectedName) {
      chat = this.chatRepo.update(chat.id, { name: expectedName });
    }

    this.ensureProjectChatMembers(project, chat.id);

    return {
      ...chat,
      members: this.chatMemberRepo.findByChatId(chat.id).map((member) => ({
        user_id: member.user_id,
        role: member.role,
        unread_count: member.unread_count,
      })),
    };
  }

  getProjectDetail(projectId: number, userId: number): Project {
    const project = this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    // 验证用户是否为项目成员
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该项目成员');
    }

    return project;
  }

  updateProject(
    projectId: number,
    userId: number,
    data: Partial<Project>
  ): Project {
    // 验证权限
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限修改项目');
    }

    if (data.owner_id) {
      if (member.role !== 'owner') {
        throw new ForbiddenError('只有项目所有者才能转让项目');
      }
      const existingMember = this.projectMemberRepo.findByProjectAndUser(projectId, data.owner_id);
      if (!existingMember) {
        this.projectMemberRepo.create({
          projectId,
          userId: data.owner_id,
          role: 'owner'
        });
      } else if (existingMember.role !== 'owner') {
        this.projectMemberRepo.updateRole(projectId, data.owner_id, 'owner');
      }
    }

    return this.projectRepo.update(projectId, data);
  }

  async addMember(
    projectId: number,
    userId: number,
    newMemberId: number,
    role: 'member' | 'viewer' = 'member'
  ) {
    // 验证权限：只有owner和member可以添加成员
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限添加成员');
    }

    // 检查是否已是成员
    const existing = this.projectMemberRepo.findByProjectAndUser(
      projectId,
      newMemberId
    );
    if (existing) {
      throw new ForbiddenError('用户已是项目成员');
    }

    return this.projectMemberRepo.create({
      projectId,
      userId: newMemberId,
      role,
    });
  }

  removeMember(
    projectId: number,
    userId: number,
    targetMemberId: number
  ): void {
    // 验证权限：只有owner可以移除成员
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role !== 'owner') {
      throw new ForbiddenError('只有项目所有者可以移除成员');
    }

    // 不能移除自己
    if (userId === targetMemberId) {
      throw new ForbiddenError('不能移除自己');
    }

    this.projectMemberRepo.delete(projectId, targetMemberId);
  }

  getMembers(projectId: number, userId: number) {
    // 验证用户是否为项目成员
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该项目成员');
    }

    return this.projectMemberRepo.findByProject(projectId);
  }

  searchProjects(query: string, userId: number) {
    return this.projectRepo.search(query, userId);
  }

  deleteProject(projectId: number, userId: number): void {
    // 验证权限：只有owner可以删除项目
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role !== 'owner') {
      throw new ForbiddenError('只有项目所有者可以删除项目');
    }

    this.projectRepo.delete(projectId);
  }

  updateMemberRole(
    projectId: number,
    userId: number,
    targetMemberId: number,
    role: 'owner' | 'member' | 'viewer'
  ) {
    // 验证权限：只有owner可以更新成员角色
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role !== 'owner') {
      throw new ForbiddenError('只有项目所有者可以更新成员角色');
    }

    return this.projectMemberRepo.updateRole(projectId, targetMemberId, role);
  }

  getTasks(
    projectId: number,
    userId: number,
    filters?: {
      status?: string | string[];
      priority?: string;
      assigneeId?: number;
      keyword?: string;
      page?: number;
      pageSize?: number;
    }
  ): { tasks: TaskWithAssignee[]; total: number; page: number; pageSize: number } {
    // 验证用户是否为项目成员
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该项目成员');
    }

    const page = Math.max(1, filters?.page || 1);
    const pageSize = Math.max(1, filters?.pageSize || 10);
    const result = this.taskRepo.findByProject(projectId, {
      ...filters,
      page,
      pageSize,
    });

    return {
      tasks: result.tasks,
      total: result.total,
      page,
      pageSize,
    };
  }

  getProjectTask(taskId: number, projectId: number, userId: number): TaskWithAssignee {
    this.ensureProjectMember(projectId, userId);

    const task = this.taskRepo.findWithAssigneeById(taskId);
    if (!task || task.project_id !== projectId) {
      throw new NotFoundError('任务不存在');
    }

    return task;
  }

  createTask(
    projectId: number,
    userId: number,
    data: {
      title: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high';
      status?: string;
      statusNote?: string;
      assigneeId?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Task {
    // 验证项目是否存在
    const project = this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    // 验证权限：至少是member
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限创建任务');
    }

    return this.taskRepo.create({
      projectId,
      createdBy: userId,
      title: data.title,
      description: data.description,
      status: data.status as 'todo' | 'in-progress' | 'done' | undefined,
      statusNote: data.statusNote,
      priority: data.priority,
      assigneeId: data.assigneeId,
      startDate: data.startDate,
      endDate: data.endDate,
    });
  }

  updateTask(
    taskId: number,
    projectId: number,
    userId: number,
    data: {
      title?: string;
      description?: string;
      status?: 'todo' | 'in-progress' | 'done';
      statusNote?: string;
      priority?: 'low' | 'medium' | 'high';
      progress?: number;
      assigneeId?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Task {
    // 验证任务存在且属于该项目
    const task = this.taskRepo.findById(taskId);
    if (!task || task.project_id !== projectId) {
      throw new NotFoundError('任务不存在');
    }

    // 验证权限：至少是member
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限修改任务');
    }

    if (data.status !== undefined && data.status !== task.status) {
      if (!data.statusNote || data.statusNote.trim() === '') {
        throw new ValidationError('修改任务状态时必须填写说明');
      }
    }

    if (data.progress !== undefined && data.progress !== task.progress) {
      if (!data.statusNote || data.statusNote.trim() === '') {
        throw new ValidationError('修改任务进度时必须填写说明');
      }
    }

    return this.taskRepo.update(taskId, {
      title: data.title,
      description: data.description,
      status: data.status,
      status_note: data.statusNote,
      priority: data.priority,
      progress: data.progress,
      assignee_id: data.assigneeId,
      start_date: data.startDate,
      end_date: data.endDate,
      changedBy: userId,
    });
  }

  deleteTask(taskId: number, projectId: number, userId: number): void {
    // 验证任务存在且属于该项目
    const task = this.taskRepo.findById(taskId);
    if (!task || task.project_id !== projectId) {
      throw new NotFoundError('任务不存在');
    }

    // 验证权限：至少是member
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限删除任务');
    }

    this.taskRepo.delete(taskId);
  }

  // ============= Bug Methods =============
  
  getProjectBugs(
    projectId: number,
    userId: number,
    filters?: {
      status?: string | string[];
      severity?: string;
      assigneeId?: number;
      keyword?: string;
      page?: number;
      pageSize?: number;
    }
  ): { bugs: BugWithUsers[]; total: number; page: number; pageSize: number } {
    // 验证用户是项目成员
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该项目成员');
    }

    const page = Math.max(1, filters?.page || 1);
    const pageSize = Math.max(1, filters?.pageSize || 10);
    const result = this.bugRepo.findByProject(projectId, {
      ...filters,
      page,
      pageSize,
    });

    return {
      bugs: result.bugs,
      total: result.total,
      page,
      pageSize,
    };
  }

  getProjectBug(bugId: number, projectId: number, userId: number): BugWithUsers {
    this.ensureProjectMember(projectId, userId);

    const bug = this.bugRepo.findWithUsersById(bugId);
    if (!bug || bug.project_id !== projectId) {
      throw new NotFoundError('缺陷不存在');
    }

    return bug;
  }

  createBug(
    projectId: number,
    userId: number,
    data: {
      title: string;
      description?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      status?: 'open' | 'in-progress' | 'fixed' | 'closed';
      assigneeId?: number;
      images?: string;
      statusNote?: string;
    }
  ): Bug {
    // 验证项目是否存在
    const project = this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    // 验证权限：至少是member
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限创建缺陷');
    }

    return this.bugRepo.create({
      projectId,
      reporterId: userId,
      title: data.title,
      description: data.description,
      severity: data.severity,
      status: data.status,
      assigneeId: data.assigneeId,
      images: data.images,
      statusNote: data.statusNote,
    });
  }

  updateBug(
    bugId: number,
    projectId: number,
    userId: number,
    data: {
      title?: string;
      description?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      status?: 'open' | 'in-progress' | 'fixed' | 'closed';
      assigneeId?: number;
      images?: string;
      statusNote?: string;
    }
  ): Bug {
    // 验证缺陷存在且属于该项目
    const bug = this.bugRepo.findById(bugId);
    if (!bug || bug.project_id !== projectId) {
      throw new NotFoundError('缺陷不存在');
    }

    // 验证权限：至少是member
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限修改缺陷');
    }

    if (data.status !== undefined && data.status !== bug.status) {
      if (!data.statusNote || data.statusNote.trim() === '') {
        throw new ValidationError('修改缺陷状态时必须填写说明');
      }
    }

    return this.bugRepo.update(bugId, {
      ...data,
      changedBy: userId,
    });
  }

  deleteBug(bugId: number, projectId: number, userId: number): void {
    // 验证缺陷存在且属于该项目
    const bug = this.bugRepo.findById(bugId);
    if (!bug || bug.project_id !== projectId) {
      throw new NotFoundError('缺陷不存在');
    }

    // 验证权限：至少是member
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限删除缺陷');
    }

    this.bugRepo.delete(bugId);
  }

  // ============= Document Methods =============
  
  getProjectDocuments(
    projectId: number,
    userId: number,
    filters?: {
      type?: string;
      keyword?: string;
      page?: number;
      pageSize?: number;
    }
  ): { documents: DocumentWithAuthor[]; total: number; page: number; pageSize: number } {
    // 验证用户是项目成员
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该项目成员');
    }

    const page = Math.max(1, filters?.page || 1);
    const pageSize = Math.max(1, filters?.pageSize || 10);
    const result = this.documentRepo.findByProject(projectId, {
      ...filters,
      page,
      pageSize,
    });

    return {
      documents: result.documents,
      total: result.total,
      page,
      pageSize,
    };
  }

  getProjectDocument(documentId: number, projectId: number, userId: number): DocumentWithAuthor {
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该项目成员');
    }

    const document = this.documentRepo.findWithAuthorById(documentId);
    if (!document || document.project_id !== projectId) {
      throw new NotFoundError('文档不存在');
    }

    return document;
  }

  createDocument(
    projectId: number,
    userId: number,
    data: {
      title: string;
      content?: string;
      format?: 'markdown' | 'richtext';
      type?: DocumentType;
    }
  ): Document {
    // 验证项目是否存在
    const project = this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    // 验证权限：至少是member
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限创建文档');
    }

    return this.documentRepo.create({
      projectId,
      authorId: userId,
      title: data.title,
      content: data.content,
      format: data.format,
      type: data.type,
    });
  }

  updateDocument(
    documentId: number,
    projectId: number,
    userId: number,
    data: {
      title?: string;
      content?: string;
      format?: 'markdown' | 'richtext';
      type?: DocumentType;
    }
  ): Document {
    // 验证文档存在且属于该项目
    const doc = this.documentRepo.findById(documentId);
    if (!doc || doc.project_id !== projectId) {
      throw new NotFoundError('文档不存在');
    }

    // 验证权限：至少是member
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限修改文档');
    }

    return this.documentRepo.update(documentId, {
      ...data,
      updatedBy: userId,
    });
  }

  getDocumentComments(documentId: number, projectId: number, userId: number): DocumentCommentWithAuthor[] {
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该项目成员');
    }

    const doc = this.documentRepo.findById(documentId);
    if (!doc || doc.project_id !== projectId) {
      throw new NotFoundError('文档不存在');
    }

    return this.documentCommentRepo.findByDocument(documentId);
  }

  createDocumentComment(documentId: number, projectId: number, userId: number, content: string): DocumentComment {
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该项目成员');
    }

    const doc = this.documentRepo.findById(documentId);
    if (!doc || doc.project_id !== projectId) {
      throw new NotFoundError('文档不存在');
    }

    const comment = this.documentCommentRepo.create({
      documentId,
      projectId,
      content,
      authorId: userId,
    });

    this.documentRepo.createActivity({
      documentId,
      projectId,
      activityType: 'commented',
      note: `添加评论：${content}`,
      changedBy: userId,
      relatedCommentId: comment.id,
    });

    return comment;
  }

  deleteDocumentComment(commentId: number, documentId: number, projectId: number, userId: number): void {
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该项目成员');
    }

    const comment = this.documentCommentRepo.findById(commentId);
    if (!comment || comment.document_id !== documentId || comment.project_id !== projectId) {
      throw new NotFoundError('评论不存在');
    }

    if (comment.author_id !== userId && member.role === 'viewer') {
      throw new ForbiddenError('无权限删除评论');
    }

    this.documentRepo.createActivity({
      documentId,
      projectId,
      activityType: 'comment_deleted',
      note: `删除评论：${comment.content}`,
      changedBy: userId,
      relatedCommentId: comment.id,
    });

    this.documentCommentRepo.delete(commentId);
  }

  deleteDocument(documentId: number, projectId: number, userId: number): void {
    // 验证文档存在且属于该项目
    const doc = this.documentRepo.findById(documentId);
    if (!doc || doc.project_id !== projectId) {
      throw new NotFoundError('文档不存在');
    }

    // 验证权限：至少是member
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限删除文档');
    }

    this.documentRepo.delete(documentId);
  }

  // ============= Repository Methods =============
  
  getProjectRepositories(
    projectId: number,
    userId: number,
    filters?: {
      platform?: string;
      isActive?: boolean;
    }
  ): Repository[] {
    // 验证用户是项目成员
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该项目成员');
    }

    return this.repositoryRepo.findByProject(projectId, filters);
  }

  createRepository(
    projectId: number,
    userId: number,
    data: {
      name: string;
      url: string;
      platform?: 'gitlab' | 'github' | 'gitea';
      accessToken?: string;
      isActive?: boolean;
    }
  ): Repository {
    // 验证项目是否存在
    const project = this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    // 验证权限：至少是member
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限创建代码仓库');
    }

    return this.repositoryRepo.create({
      projectId,
      name: data.name,
      url: data.url,
      platform: data.platform,
      accessToken: data.accessToken,
      isActive: data.isActive,
    });
  }

  updateRepository(
    repositoryId: number,
    projectId: number,
    userId: number,
    data: {
      name?: string;
      url?: string;
      platform?: 'gitlab' | 'github' | 'gitea';
      accessToken?: string;
      isActive?: boolean;
    }
  ): Repository {
    // 验证仓库存在且属于该项目
    const repo = this.repositoryRepo.findById(repositoryId);
    if (!repo || repo.project_id !== projectId) {
      throw new NotFoundError('代码仓库不存在');
    }

    // 验证权限：至少是member
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限修改代码仓库');
    }

    return this.repositoryRepo.update(repositoryId, data);
  }

  deleteRepository(repositoryId: number, projectId: number, userId: number): void {
    // 验证仓库存在且属于该项目
    const repo = this.repositoryRepo.findById(repositoryId);
    if (!repo || repo.project_id !== projectId) {
      throw new NotFoundError('代码仓库不存在');
    }

    // 验证权限：至少是member
    const member = this.projectMemberRepo.findByProjectAndUser(projectId, userId);
    if (!member || member.role === 'viewer') {
      throw new ForbiddenError('无权限删除代码仓库');
    }

    this.repositoryRepo.delete(repositoryId);
  }

  async getProjectRepositoryDetail(repositoryId: number, projectId: number, userId: number): Promise<RepositoryDetailPayload> {
    this.ensureProjectMember(projectId, userId);

    const repository = this.repositoryRepo.findById(repositoryId);
    if (!repository || repository.project_id !== projectId) {
      throw new NotFoundError('代码仓库不存在');
    }

    return this.gitLabService.getRepositoryDetail(repository);
  }

  getProjectPrototypes(projectId: number, userId: number): ProjectPrototype[] {
    this.ensureProjectMember(projectId, userId);
    return this.prototypeRepo.findByProject(projectId);
  }

  getProjectPrototype(prototypeId: number, projectId: number, userId: number): ProjectPrototype {
    this.ensureProjectMember(projectId, userId);
    const prototype = this.prototypeRepo.findById(prototypeId);
    if (!prototype || prototype.project_id !== projectId) {
      throw new NotFoundError('原型稿不存在');
    }
    return prototype;
  }

  async createProjectPrototype(
    projectId: number,
    userId: number,
    data: {
      name: string;
      description?: string;
      archiveTempFilePath: string;
      archiveOriginalName: string;
    }
  ): Promise<ProjectPrototype> {
    const project = this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    const member = this.ensureProjectMember(projectId, userId);
    if (member.role === 'viewer') {
      throw new ForbiddenError('无权限上传原型稿');
    }

    if (!data.name.trim()) {
      throw new ValidationError('原型稿名称不能为空');
    }

    const prepared = await this.prototypeArchiveService.preparePrototypeArchive(data.archiveTempFilePath, data.archiveOriginalName);

    return this.prototypeRepo.create({
      projectId,
      name: data.name.trim(),
      description: data.description,
      archiveFileName: prepared.archiveFileName,
      archiveFilePath: prepared.archiveFilePath,
      archiveSize: prepared.archiveSize,
      extractedDir: prepared.extractedDir,
      entryFile: prepared.entryFile,
      previewKey: prepared.previewKey,
      uploaderId: userId,
    });
  }

  async updateProjectPrototype(
    prototypeId: number,
    projectId: number,
    userId: number,
    data: {
      name?: string;
      description?: string;
      archiveTempFilePath?: string;
      archiveOriginalName?: string;
    }
  ): Promise<ProjectPrototype> {
    const member = this.ensureProjectMember(projectId, userId);
    if (member.role === 'viewer') {
      throw new ForbiddenError('无权限修改原型稿');
    }

    const prototype = this.prototypeRepo.findById(prototypeId);
    if (!prototype || prototype.project_id !== projectId) {
      throw new NotFoundError('原型稿不存在');
    }

    const updates: {
      name?: string;
      description?: string | null;
      archiveFileName?: string;
      archiveFilePath?: string;
      archiveSize?: number;
      extractedDir?: string;
      entryFile?: string;
      previewKey?: string;
    } = {};

    if (data.name !== undefined) {
      if (!data.name.trim()) {
        throw new ValidationError('原型稿名称不能为空');
      }
      updates.name = data.name.trim();
    }

    if (data.description !== undefined) {
      updates.description = data.description || null;
    }

    if (data.archiveTempFilePath && data.archiveOriginalName) {
      const prepared = await this.prototypeArchiveService.replacePrototypeArchive(
        prototype,
        data.archiveTempFilePath,
        data.archiveOriginalName
      );
      updates.archiveFileName = prepared.archiveFileName;
      updates.archiveFilePath = prepared.archiveFilePath;
      updates.archiveSize = prepared.archiveSize;
      updates.extractedDir = prepared.extractedDir;
      updates.entryFile = prepared.entryFile;
      updates.previewKey = prepared.previewKey;
    }

    return this.prototypeRepo.update(prototypeId, updates);
  }

  async deleteProjectPrototype(prototypeId: number, projectId: number, userId: number): Promise<void> {
    const member = this.ensureProjectMember(projectId, userId);
    if (member.role === 'viewer') {
      throw new ForbiddenError('无权限删除原型稿');
    }

    const prototype = this.prototypeRepo.findById(prototypeId);
    if (!prototype || prototype.project_id !== projectId) {
      throw new NotFoundError('原型稿不存在');
    }

    this.prototypeRepo.delete(prototypeId);
    await this.prototypeArchiveService.removePrototypeAssets(prototype);
  }
}
