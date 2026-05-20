import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { MessageRepository } from '../repositories/message.repository';
import { ChatMemberRepository } from '../repositories/chat.repository';
import { FileRepository, MessageAttachmentRepository } from '../repositories/file.repository';
import { config } from '../config/app';
import { NotFoundError, ForbiddenError } from '../utils/error.util';
import { Message } from '../types/db.types';
import { normalizeUploadedFileName } from '../utils/file-name.util';
import { UserRepository } from '../repositories/user.repository';
import { ChatRepository } from '../repositories/chat.repository';

export class MessageService {
  private messageRepo: MessageRepository;
  private chatMemberRepo: ChatMemberRepository;
  private fileRepo: FileRepository;
  private messageAttachmentRepo: MessageAttachmentRepository;
  private userRepo: UserRepository;
  private chatRepo: ChatRepository;

  constructor() {
    this.messageRepo = new MessageRepository();
    this.chatMemberRepo = new ChatMemberRepository();
    this.fileRepo = new FileRepository();
    this.messageAttachmentRepo = new MessageAttachmentRepository();
    this.userRepo = new UserRepository();
    this.chatRepo = new ChatRepository();
  }

  private parseMessageMetadata(metadata?: string) {
    if (!metadata) {
      return undefined;
    }

    try {
      return JSON.parse(metadata);
    } catch {
      return metadata;
    }
  }

  private normalizeMessageMetadata(chatId: number, rawMetadata?: string | Record<string, any>) {
    if (!rawMetadata) {
      return undefined;
    }

    let parsedMetadata: Record<string, any> | null = null;

    if (typeof rawMetadata === 'string') {
      try {
        parsedMetadata = JSON.parse(rawMetadata);
      } catch {
        return undefined;
      }
    } else if (typeof rawMetadata === 'object') {
      parsedMetadata = rawMetadata;
    }

    if (!parsedMetadata) {
      return undefined;
    }

    const normalizedMetadata: Record<string, any> = { ...parsedMetadata };
    const rawMentions = Array.isArray(parsedMetadata.mentions) ? parsedMetadata.mentions : [];
    if (rawMentions.length === 0) {
      return Object.keys(normalizedMetadata).length > 0 ? normalizedMetadata : undefined;
    }

    const memberIds = new Set(this.chatMemberRepo.findByChatId(chatId).map((member) => member.user_id));
    const seenUserIds = new Set<number>();
    const mentions = rawMentions
      .map((mention) => {
        const userId = Number(mention?.userId ?? mention?.user_id);
        if (!userId || seenUserIds.has(userId) || !memberIds.has(userId)) {
          return null;
        }

        const user = this.userRepo.findById(userId);
        if (!user) {
          return null;
        }

        seenUserIds.add(userId);
        return {
          userId: user.id,
          username: user.username,
          displayName: user.display_name || user.username,
        };
      })
      .filter((mention): mention is { userId: number; username: string; displayName: string } => Boolean(mention));

    normalizedMetadata.mentions = mentions;
    return mentions.length > 0 ? normalizedMetadata : undefined;
  }

  private buildAttachmentMetadata(message: Message, baseUrl?: string) {
    if (message.type !== 'file') {
      return {
        ...message,
        metadata: this.parseMessageMetadata(message.metadata),
      };
    }

    const fileIds = this.messageAttachmentRepo.findFileIdsByMessageId(message.id);
    const fileId = fileIds[0];
    if (!fileId) {
      return message;
    }

    const file = this.fileRepo.findById(fileId);
    if (!file) {
      return message;
    }

    return {
      ...message,
      metadata: {
        fileId: file.id,
        fileName: normalizeUploadedFileName(file.original_name),
        mimeType: file.mime_type,
        fileSize: file.file_size,
        downloadUrl: baseUrl ? `${baseUrl}/api/chats/attachments/${file.id}` : undefined,
      },
    };
  }

  async getMessages(
    chatId: number,
    userId: number,
    limit: number = 50,
    beforeId?: number,
    baseUrl?: string
  ): Promise<any[]> {
    // 验证用户是否为聊天成员
    const member = this.chatMemberRepo.findByChatAndUser(chatId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该聊天成员');
    }

    return this.messageRepo.findByChatId(chatId, limit, beforeId).map((message) => this.buildAttachmentMetadata(message, baseUrl));
  }

  async sendMessage(
    chatId: number,
    userId: number,
    data: {
      content: string;
      type?: 'text' | 'image' | 'file' | 'code';
      replyToId?: number;
      metadata?: string | Record<string, any>;
    },
    baseUrl?: string
  ): Promise<any> {
    // 验证用户是否为聊天成员
    const member = this.chatMemberRepo.findByChatAndUser(chatId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该聊天成员');
    }

    // 如果是回复消息，验证被回复的消息是否存在
    if (data.replyToId) {
      const replyTo = this.messageRepo.findById(data.replyToId);
      if (!replyTo || replyTo.chat_id !== chatId) {
        throw new NotFoundError('被回复的消息不存在');
      }
    }

    const normalizedMetadata = this.normalizeMessageMetadata(chatId, data.metadata);

    // 创建消息
    const message = this.messageRepo.create({
      chatId,
      senderId: userId,
      content: data.content,
      type: data.type || 'text',
      metadata: normalizedMetadata ? JSON.stringify(normalizedMetadata) : undefined,
      replyToId: data.replyToId,
    });

    // 增加其他成员的未读消息数（排除发送者自己）
    this.chatMemberRepo.incrementUnreadCount(chatId, userId);

    return this.buildAttachmentMetadata(message, baseUrl);
  }

  async sendAttachment(
    chatId: number,
    userId: number,
    file: Express.Multer.File,
    baseUrl?: string
  ): Promise<any> {
    const member = this.chatMemberRepo.findByChatAndUser(chatId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该聊天成员');
    }

    const normalizedOriginalName = normalizeUploadedFileName(file.originalname);
    const uploadDir = path.join(config.upload.dir, 'chat-files');
    await fs.promises.mkdir(uploadDir, { recursive: true });

    const extension = path.extname(normalizedOriginalName);
    const storedName = `${crypto.randomUUID()}${extension}`;
    const targetPath = path.join(uploadDir, storedName);

    await fs.promises.rename(file.path, targetPath);

    const storedFile = this.fileRepo.create({
      uploaderId: userId,
      originalName: normalizedOriginalName,
      storedName,
      filePath: targetPath,
      mimeType: file.mimetype,
      fileSize: file.size,
    });

    const message = this.messageRepo.create({
      chatId,
      senderId: userId,
      content: normalizedOriginalName,
      type: 'file',
    });

    this.messageAttachmentRepo.create(message.id, storedFile.id);
    this.chatMemberRepo.incrementUnreadCount(chatId, userId);

    return this.buildAttachmentMetadata(message, baseUrl);
  }

  async forwardMessage(
    sourceMessageId: number,
    targetChatId: number,
    userId: number,
    baseUrl?: string
  ): Promise<any> {
    const sourceMessage = this.messageRepo.findById(sourceMessageId);
    if (!sourceMessage || sourceMessage.is_deleted) {
      throw new NotFoundError('原消息不存在');
    }

    const sourceMember = this.chatMemberRepo.findByChatAndUser(sourceMessage.chat_id, userId);
    if (!sourceMember) {
      throw new ForbiddenError('您无权转发该消息');
    }

    const targetMember = this.chatMemberRepo.findByChatAndUser(targetChatId, userId);
    if (!targetMember) {
      throw new ForbiddenError('您不是目标聊天成员');
    }

    const sourceSender = this.userRepo.findById(sourceMessage.sender_id);
    const sourceChat = this.chatRepo.findById(sourceMessage.chat_id);
    const sourceMetadata = this.parseMessageMetadata(sourceMessage.metadata);
    const nextMetadata = {
      ...(sourceMetadata && typeof sourceMetadata === 'object' ? sourceMetadata : {}),
      forwardedFrom: {
        messageId: sourceMessage.id,
        chatId: sourceMessage.chat_id,
        chatName: sourceChat?.name || null,
        senderId: sourceMessage.sender_id,
        senderName: sourceSender?.display_name || sourceSender?.username || `用户 ${sourceMessage.sender_id}`,
        type: sourceMessage.type,
      },
    };

    const forwardedMessage = this.messageRepo.create({
      chatId: targetChatId,
      senderId: userId,
      content: sourceMessage.content,
      type: sourceMessage.type,
      metadata: JSON.stringify(nextMetadata),
    });

    if (sourceMessage.type === 'file') {
      const sourceFileIds = this.messageAttachmentRepo.findFileIdsByMessageId(sourceMessage.id);
      sourceFileIds.forEach((fileId) => {
        this.messageAttachmentRepo.create(forwardedMessage.id, fileId);
      });
    }

    this.chatMemberRepo.incrementUnreadCount(targetChatId, userId);

    return this.buildAttachmentMetadata(forwardedMessage, baseUrl);
  }

  async getAttachment(fileId: number, userId: number) {
    const file = this.fileRepo.findById(fileId);
    if (!file) {
      throw new NotFoundError('附件不存在');
    }

    const messageId = this.messageAttachmentRepo.findMessageIdByFileId(fileId);
    if (!messageId) {
      throw new NotFoundError('附件未关联消息');
    }

    const message = this.messageRepo.findById(messageId);
    if (!message) {
      throw new NotFoundError('附件所属消息不存在');
    }

    const member = this.chatMemberRepo.findByChatAndUser(message.chat_id, userId);
    if (!member) {
      throw new ForbiddenError('您不是该聊天成员');
    }

    return {
      file,
      message,
    };
  }

  async updateMessage(
    messageId: number,
    userId: number,
    content: string
  ): Promise<Message> {
    const message = this.messageRepo.findById(messageId);
    if (!message) {
      throw new NotFoundError('消息不存在');
    }

    if (message.sender_id !== userId) {
      throw new ForbiddenError('只能编辑自己的消息');
    }

    return this.messageRepo.update(messageId, content);
  }

  async deleteMessage(messageId: number, userId: number): Promise<void> {
    const message = this.messageRepo.findById(messageId);
    if (!message) {
      throw new NotFoundError('消息不存在');
    }

    // 验证权限：只能删除自己的消息，或者是管理员
    const member = this.chatMemberRepo.findByChatAndUser(message.chat_id, userId);
    if (!member) {
      throw new ForbiddenError('无权限删除消息');
    }

    if (message.sender_id !== userId && member.role !== 'admin') {
      throw new ForbiddenError('只能删除自己的消息');
    }

    this.messageRepo.delete(messageId);
  }

  async searchMessages(
    chatId: number,
    userId: number,
    query: string
  ): Promise<Message[]> {
    // 验证用户是否为聊天成员
    const member = this.chatMemberRepo.findByChatAndUser(chatId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该聊天成员');
    }

    return this.messageRepo.search(chatId, query);
  }
}
