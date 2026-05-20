import fs from 'fs';
import path from 'path';
import { Response, NextFunction } from 'express';
import { MessageService } from '../services/message.service';
import { successResponse } from '../utils/response.util';
import { AuthRequest } from '../types/api.types';
import { WebSocketServer } from '../websocket';
import { UserRepository } from '../repositories/user.repository';
import { config } from '../config/app';
import { normalizeUploadedFileName } from '../utils/file-name.util';

export class MessageController {
  private messageService: MessageService;

  constructor() {
    this.messageService = new MessageService();
  }

  private getRequestBaseUrl(req: AuthRequest): string {
    return `${req.protocol}://${req.get('host')}`;
  }

  private resolveAttachmentPath(filePath: string, storedName: string): string {
    const candidates = [
      filePath,
      path.resolve(filePath),
      path.resolve(config.upload.dir, filePath),
      path.join(config.upload.dir, 'chat-files', storedName),
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (path.isAbsolute(candidate) && fs.existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error('附件文件不存在或路径无效');
  }

  getMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const chatId = parseInt(req.params.chatId);
      const limit = parseInt(req.query.limit as string) || 50;
      const beforeId = req.query.beforeId
        ? parseInt(req.query.beforeId as string)
        : undefined;

      const messages = await this.messageService.getMessages(
        chatId,
        userId,
        limit,
        beforeId,
        this.getRequestBaseUrl(req)
      );

      res.json(successResponse({ messages }));
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const chatId = parseInt(req.params.chatId);
      const { content, type, replyToId, replyToMessageId, metadata } = req.body;

      const message = await this.messageService.sendMessage(chatId, userId, {
        content,
        type,
        replyToId: replyToId || replyToMessageId,
        metadata,
      }, this.getRequestBaseUrl(req));

      // 通过 WebSocket 广播消息给聊天室的其他成员
      const wsServer = WebSocketServer.getInstance();
      if (wsServer) {
        const userRepo = new UserRepository();
        const user = userRepo.findById(userId);
        wsServer.broadcastMessage(chatId, message, user?.username || 'Unknown');
      }

      res.status(201).json(successResponse({ message }, '发送成功'));
    } catch (error) {
      next(error);
    }
  };

  forwardMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const messageId = parseInt(req.params.messageId, 10);
      const { targetChatId } = req.body;

      const message = await this.messageService.forwardMessage(
        messageId,
        parseInt(targetChatId, 10),
        userId,
        this.getRequestBaseUrl(req)
      );

      const wsServer = WebSocketServer.getInstance();
      if (wsServer) {
        const userRepo = new UserRepository();
        const user = userRepo.findById(userId);
        wsServer.broadcastMessage(parseInt(targetChatId, 10), message, user?.username || 'Unknown');
      }

      res.status(201).json(successResponse({ message }, '转发成功'));
    } catch (error) {
      next(error);
    }
  };

  uploadAttachment = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const chatId = parseInt(req.params.chatId, 10);

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: '请选择要上传的附件',
          },
        });
        return;
      }

      const message = await this.messageService.sendAttachment(chatId, userId, req.file, this.getRequestBaseUrl(req));

      const wsServer = WebSocketServer.getInstance();
      if (wsServer) {
        const userRepo = new UserRepository();
        const user = userRepo.findById(userId);
        wsServer.broadcastMessage(chatId, message, user?.username || 'Unknown');
      }

      res.status(201).json(successResponse({ message }, '附件发送成功'));
    } catch (error) {
      next(error);
    }
  };

  downloadAttachment = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const fileId = parseInt(req.params.fileId, 10);
      const { file } = await this.messageService.getAttachment(fileId, userId);
      const absolutePath = this.resolveAttachmentPath(file.file_path, file.stored_name);
      const downloadFileName = normalizeUploadedFileName(file.original_name);

      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
      res.setHeader('Content-Length', String(file.file_size || 0));
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`);
      res.sendFile(absolutePath, {
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const messageId = parseInt(req.params.messageId);
      const { content } = req.body;

      const message = await this.messageService.updateMessage(
        messageId,
        userId,
        content
      );

      res.json(successResponse({ message }, '更新成功'));
    } catch (error) {
      next(error);
    }
  };

  deleteMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const messageId = parseInt(req.params.messageId);

      await this.messageService.deleteMessage(messageId, userId);

      res.json(successResponse(null, '删除成功'));
    } catch (error) {
      next(error);
    }
  };

  searchMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const chatId = parseInt(req.params.chatId);
      const { q } = req.query;

      const messages = await this.messageService.searchMessages(
        chatId,
        userId,
        q as string
      );

      res.json(successResponse({ messages }));
    } catch (error) {
      next(error);
    }
  };
}
