import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { isAllowedCorsOrigin } from '../config/app';
import { verifyToken } from '../utils/jwt.util';
import { UserRepository } from '../repositories/user.repository';
import { MessageRepository } from '../repositories/message.repository';
import { ChatRepository, ChatMemberRepository } from '../repositories/chat.repository';
import logger from '../utils/logger.util';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/ws.types';

export class WebSocketServer {
  private static instance: WebSocketServer | null = null;
  private io: SocketServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
  private userRepo: UserRepository;
  private messageRepo: MessageRepository;
  private chatRepo: ChatRepository;
  private chatMemberRepo: ChatMemberRepository;

  constructor(httpServer: HttpServer) {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (isAllowedCorsOrigin(origin)) {
            callback(null, true);
            return;
          }

          callback(new Error(`Origin not allowed by WebSocket CORS: ${origin || 'unknown'}`));
        },
        credentials: true,
      },
    });

    this.userRepo = new UserRepository();
    this.messageRepo = new MessageRepository();
    this.chatRepo = new ChatRepository();
    this.chatMemberRepo = new ChatMemberRepository();

    this.setupMiddleware();
    this.setupEventHandlers();
    
    // 设置单例实例
    WebSocketServer.instance = this;
  }

  public static getInstance(): WebSocketServer | null {
    return WebSocketServer.instance;
  }

  public broadcastMessage(chatId: number, message: any, senderUsername: string) {
    const payload = { message, senderUsername };

    // Broadcast to chat room (active chat participants)
    this.io.to(`chat:${chatId}`).emit('newMessage', payload);

    // Broadcast to user rooms so chat list updates even when not in chat
    const members = this.chatMemberRepo.findByChatId(chatId);
    members.forEach((member) => {
      this.io.to(`user:${member.user_id}`).emit('newMessage', payload);
    });
    logger.info(`[WebSocket] Broadcast message to chat ${chatId}`);
  }

  public broadcastUserStatus(userId: number, isOnline: boolean) {
    this.io.emit('userStatusChanged', {
      userId,
      isOnline,
    });
  }

  public notifyAIProposalCreated(data: {
    userId: number;
    projectId: number;
    projectName: string;
    analysisId: number;
    proposalCount: number;
    triggeredByUserId: number;
  }) {
    this.io.to(`user:${data.userId}`).emit('aiProposalCreated', {
      projectId: data.projectId,
      projectName: data.projectName,
      analysisId: data.analysisId,
      proposalCount: data.proposalCount,
      triggeredByUserId: data.triggeredByUserId,
    });

    logger.info(`[WebSocket] Sent AI proposal notification to user ${data.userId} for project ${data.projectId}`);
  }

  private setupMiddleware() {
    // 认证中间件
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('Authentication error: Token missing'));
        }

        const payload = verifyToken(token);
        socket.data.userId = payload.userId;
        socket.data.username = payload.username;

        next();
      } catch (error) {
        logger.error('WebSocket authentication failed:', error);
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const userId = socket.data.userId!;
      const username = socket.data.username!;

      logger.info(`User connected: ${username} (${userId})`);

      // 用户加入个人房间
      socket.join(`user:${userId}`);

      // 更新用户在线状态
      this.userRepo.setOnlineStatus(userId, true);
      this.broadcastUserStatus(userId, true);

      // 处理加入聊天室
      socket.on('joinChat', (chatId: number) => {
        socket.join(`chat:${chatId}`);
        logger.info(`User ${username} joined chat ${chatId}`);
      });

      // 处理离开聊天室
      socket.on('leaveChat', (chatId: number) => {
        socket.leave(`chat:${chatId}`);
        logger.info(`User ${username} left chat ${chatId}`);
      });

      // 处理发送消息
      socket.on('sendMessage', async (data: { chatId: number; content: string; type?: 'text' | 'system' | 'file' | 'code'; replyToId?: number }) => {
        try {
          const { chatId, content, type, replyToId } = data;

          // 创建消息
          const message = this.messageRepo.create({
            chatId,
            senderId: userId,
            content,
            type: type || 'text',
            replyToId,
          });

          // 更新聊天最后消息
          this.chatRepo.updateLastMessage(chatId, message.id);

          // 广播消息到聊天室和个人房间
          this.broadcastMessage(chatId, message, username);

          logger.info(`Message sent in chat ${chatId} by ${username}`);
        } catch (error) {
          logger.error('Error sending message:', error);
          socket.emit('error', { message: '发送消息失败' });
        }
      });

      // 处理正在输入
      socket.on('typing', (chatId: number) => {
        socket.to(`chat:${chatId}`).emit('userTyping', {
          chatId,
          userId,
          username,
        });
      });

      // 处理停止输入
      socket.on('stopTyping', (chatId: number) => {
        socket.to(`chat:${chatId}`).emit('userStopTyping', {
          chatId,
          userId,
        });
      });

      // 处理消息已读
      socket.on('markAsRead', (data: { chatId: number; lastReadMessageId: number }) => {
        const { chatId, lastReadMessageId } = data;
        socket.to(`chat:${chatId}`).emit('messageRead', {
          chatId,
          messageId: lastReadMessageId,
          userId,
        });
      });

      // 断开连接
      socket.on('disconnect', () => {
        logger.info(`User disconnected: ${username} (${userId})`);

        // 更新用户离线状态
        this.userRepo.setOnlineStatus(userId, false);
        this.broadcastUserStatus(userId, false);
      });
    });
  }

  public getIO() {
    return this.io;
  }
}
