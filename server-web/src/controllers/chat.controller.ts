import { Response, NextFunction } from 'express';
import { ChatService } from '../services/chat.service';
import { successResponse } from '../utils/response.util';
import { AuthRequest } from '../types/api.types';

export class ChatController {
  private chatService: ChatService;

  constructor() {
    this.chatService = new ChatService();
  }

  getChats = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const chats = this.chatService.getUserChats(userId);

      res.json(successResponse(chats));
    } catch (error) {
      next(error);
    }
  };

  createDirectChat = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { targetUserId } = req.body;

      const chat = await this.chatService.createDirectChat(userId, targetUserId);

      res.status(201).json(successResponse(chat, '创建成功'));
    } catch (error) {
      next(error);
    }
  };

  createGroupChat = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { name, memberIds } = req.body;

      const chat = await this.chatService.createGroupChat(userId, name, memberIds);

      res.status(201).json(successResponse(chat, '创建成功'));
    } catch (error) {
      next(error);
    }
  };

  getChatDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const chatId = parseInt(req.params.chatId);

      const chat = this.chatService.getChatDetail(chatId, userId);

      res.json(successResponse(chat));
    } catch (error) {
      next(error);
    }
  };

  updateChat = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const chatId = parseInt(req.params.chatId);
      const { name, avatarUrl } = req.body;

      const chat = this.chatService.updateChat(chatId, userId, { name, avatarUrl });

      res.json(successResponse(chat, '更新成功'));
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const chatId = parseInt(req.params.chatId);
      const { messageId } = req.body;

      this.chatService.markAsRead(chatId, userId, messageId);

      res.json(successResponse(null, '标记已读成功'));
    } catch (error) {
      next(error);
    }
  };

  addMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const chatId = parseInt(req.params.chatId);
      const { userId: newMemberId } = req.body;

      await this.chatService.addMember(chatId, userId, newMemberId);

      res.status(201).json(successResponse(null, '添加成员成功'));
    } catch (error) {
      next(error);
    }
  };

  removeMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const requestUserId = req.user!.id;
      const chatId = parseInt(req.params.chatId);
      const userIdToRemove = parseInt(req.params.userId);

      this.chatService.removeMember(chatId, requestUserId, userIdToRemove);

      res.json(successResponse(null, '移除成员成功'));
    } catch (error) {
      next(error);
    }
  };

  leaveChat = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const chatId = parseInt(req.params.chatId, 10);

      this.chatService.leaveChat(chatId, userId);

      res.json(successResponse(null, '退出群组成功'));
    } catch (error) {
      next(error);
    }
  };

  deleteDirectChat = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const chatId = parseInt(req.params.chatId, 10);

      this.chatService.deleteDirectChat(chatId, userId);

      res.json(successResponse(null, '删除聊天成功'));
    } catch (error) {
      next(error);
    }
  };
}
