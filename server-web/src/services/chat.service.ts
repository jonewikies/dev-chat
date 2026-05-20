import { ChatRepository, ChatMemberRepository } from '../repositories/chat.repository';
import { MessageRepository } from '../repositories/message.repository';
import { UserRepository } from '../repositories/user.repository';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/error.util';
import { Chat } from '../types/db.types';

export class ChatService {
  private chatRepo: ChatRepository;
  private chatMemberRepo: ChatMemberRepository;
  // @ts-ignore - messageRepo will be used in future features
  private messageRepo: MessageRepository;
  private userRepo: UserRepository;

  constructor() {
    this.chatRepo = new ChatRepository();
    this.chatMemberRepo = new ChatMemberRepository();
    this.messageRepo = new MessageRepository();
    this.userRepo = new UserRepository();
  }

  private serializeChatMembers(members: Array<{ user_id: number; role: 'admin' | 'member'; unread_count: number }>) {
    return members.map((member) => {
      const user = this.userRepo.findById(member.user_id);
      return {
        user_id: member.user_id,
        role: member.role,
        unread_count: member.unread_count,
        username: user?.username || null,
        display_name: user?.display_name || null,
        avatar_url: user?.avatar_url || null,
      };
    });
  }

  private buildChatPreview(chatId: number): {
    last_message: string | null;
    last_message_time: string | null;
    last_message_sender_name: string | null;
  } {
    const recentMessages = this.messageRepo.findByChatId(chatId, 20);
    if (recentMessages.length === 0) {
      return {
        last_message: null,
        last_message_time: null,
        last_message_sender_name: null,
      };
    }

    const previewMessage = [...recentMessages].reverse().find((message) => !message.is_deleted) || null;

    if (!previewMessage) {
      return {
        last_message: null,
        last_message_time: null,
        last_message_sender_name: null,
      };
    }

    const sender = this.userRepo.findById(previewMessage.sender_id);

    return {
      last_message: previewMessage.content,
      last_message_time: previewMessage.created_at,
      last_message_sender_name: sender?.display_name || sender?.username || null,
    };
  }

  getUserChats(userId: number): any[] {
    const chats = this.chatRepo.findByUser(userId);
    
    // 为每个聊天添加成员信息
    return chats.map(chat => {
      const members = this.chatMemberRepo.findByChatId(chat.id);
      const preview = this.buildChatPreview(chat.id);
      
      // 对于一对一聊天，查找对方的用户信息
      if (chat.type === 'direct') {
        const otherMember = members.find(m => m.user_id !== userId);
        if (otherMember) {
          const otherUser = this.userRepo.findById(otherMember.user_id);
          if (otherUser) {
            // 返回聊天信息，使用对方的名称和头像
            return {
              ...chat,
              name: otherUser.display_name || otherUser.username,
              avatar_url: otherUser.avatar_url,
              ...preview,
              members: this.serializeChatMembers(members),
            };
          }
        }
      }
      
      // 群聊或项目聊天，返回原有信息
      return {
        ...chat,
        ...preview,
        members: this.serializeChatMembers(members),
      };
    });
  }

  async createDirectChat(userId: number, targetUserId: number): Promise<Chat> {
    // 检查是否为自己聊天
    if (userId === targetUserId) {
      throw new ValidationError('不能与自己创建私聊');
    }

    // 检查目标用户是否存在
    const targetUser = this.userRepo.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError('目标用户不存在');
    }

    // 检查是否已存在私聊
    const existing = this.chatRepo.findDirectChat(userId, targetUserId);
    if (existing) {
      return existing;
    }

    // 创建新的私聊
    const chat = this.chatRepo.create({ type: 'direct', createdBy: userId });

    // 添加成员
    this.chatMemberRepo.addMember(chat.id, userId);
    this.chatMemberRepo.addMember(chat.id, targetUserId);

    return chat;
  }

  async createGroupChat(
    userId: number,
    name: string,
    memberIds: number[]
  ): Promise<Chat> {
    if (memberIds.length < 2) {
      throw new ValidationError('群聊至少需要3个成员');
    }

    // 创建群聊
    const chat = this.chatRepo.create({ type: 'group', name, createdBy: userId });

    // 添加创建者为管理员
    this.chatMemberRepo.addMember(chat.id, userId, 'admin');

    // 添加其他成员
    for (const memberId of memberIds) {
      if (memberId !== userId) {
        this.chatMemberRepo.addMember(chat.id, memberId);
      }
    }

    return chat;
  }

  getChatDetail(chatId: number, userId: number): any {
    const chat = this.chatRepo.findById(chatId);
    if (!chat) {
      throw new NotFoundError('聊天不存在');
    }

    // 验证用户是否为成员
    const member = this.chatMemberRepo.findByChatAndUser(chatId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该聊天成员');
    }

    // 为聊天添加成员信息（包含未读数）
    const members = this.chatMemberRepo.findByChatId(chatId);
    const preview = this.buildChatPreview(chatId);
    
    // 对于一对一聊天，查找对方的用户信息
    if (chat.type === 'direct') {
      const otherMember = members.find(m => m.user_id !== userId);
      if (otherMember) {
        const otherUser = this.userRepo.findById(otherMember.user_id);
        if (otherUser) {
          // 返回聊天信息，使用对方的名称和头像
          return {
            ...chat,
            name: otherUser.display_name || otherUser.username,
            avatar_url: otherUser.avatar_url,
            ...preview,
            members: this.serializeChatMembers(members),
          };
        }
      }
    }
    
    // 群聊或项目聊天，返回原有信息
    return {
      ...chat,
      ...preview,
      members: this.serializeChatMembers(members),
    };
  }

  updateChat(
    chatId: number,
    userId: number,
    data: { name?: string; avatarUrl?: string }
  ): Chat {
    // 验证权限
    const member = this.chatMemberRepo.findByChatAndUser(chatId, userId);
    if (!member || member.role !== 'admin') {
      throw new ForbiddenError('无权限修改聊天信息');
    }

    return this.chatRepo.update(chatId, {
      name: data.name,
      avatar_url: data.avatarUrl,
    });
  }

  addMember(chatId: number, userId: number, newMemberId: number): void {
    const chat = this.chatRepo.findById(chatId);
    if (!chat) {
      throw new NotFoundError('聊天不存在');
    }

    if (chat.type === 'direct') {
      throw new ValidationError('私聊不支持添加成员');
    }

    // 验证权限
    const member = this.chatMemberRepo.findByChatAndUser(chatId, userId);
    if (!member || member.role !== 'admin') {
      throw new ForbiddenError('无权限添加成员');
    }

    // 检查新成员是否存在
    const newUser = this.userRepo.findById(newMemberId);
    if (!newUser) {
      throw new NotFoundError('用户不存在');
    }

    const existingMember = this.chatMemberRepo.findByChatAndUser(chatId, newMemberId);
    if (existingMember) {
      throw new ValidationError('用户已在群聊中');
    }

    this.chatMemberRepo.addMember(chatId, newMemberId);
  }

  removeMember(chatId: number, userId: number, targetMemberId: number): void {
    const chat = this.chatRepo.findById(chatId);
    if (!chat) {
      throw new NotFoundError('聊天不存在');
    }

    // 验证权限
    const member = this.chatMemberRepo.findByChatAndUser(chatId, userId);
    if (!member || member.role !== 'admin') {
      throw new ForbiddenError('无权限移除成员');
    }

    if (targetMemberId === chat.created_by && chat.type !== 'direct') {
      throw new ValidationError('不能移除群创建者');
    }

    this.chatMemberRepo.removeMember(chatId, targetMemberId);
  }

  leaveChat(chatId: number, userId: number): void {
    const chat = this.chatRepo.findById(chatId);
    if (!chat) {
      throw new NotFoundError('聊天不存在');
    }

    if (chat.type === 'direct') {
      throw new ValidationError('私聊不支持退出，请使用删除聊天');
    }

    const member = this.chatMemberRepo.findByChatAndUser(chatId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该聊天成员');
    }

    this.chatMemberRepo.removeMember(chatId, userId);

    const remainingMembers = this.chatMemberRepo.findByChatId(chatId);
    if (remainingMembers.length === 0) {
      this.chatRepo.delete(chatId);
      return;
    }

    const hasAdmin = remainingMembers.some((chatMember) => chatMember.role === 'admin');
    if (member.role === 'admin' && !hasAdmin) {
      const promotedMember = remainingMembers[Math.floor(Math.random() * remainingMembers.length)];
      this.chatMemberRepo.updateRole(chatId, promotedMember.user_id, 'admin');
    }
  }

  deleteDirectChat(chatId: number, userId: number): void {
    const chat = this.chatRepo.findById(chatId);
    if (!chat) {
      throw new NotFoundError('聊天不存在');
    }

    if (chat.type !== 'direct') {
      throw new ValidationError('只有一对一聊天支持删除聊天');
    }

    const member = this.chatMemberRepo.findByChatAndUser(chatId, userId);
    if (!member) {
      throw new ForbiddenError('您不是该聊天成员');
    }

    this.chatMemberRepo.removeMember(chatId, userId);

    const remainingMembers = this.chatMemberRepo.findByChatId(chatId);
    if (remainingMembers.length === 0) {
      this.chatRepo.delete(chatId);
    }
  }

  markAsRead(chatId: number, userId: number, messageId: number): void {
    this.chatMemberRepo.updateLastRead(chatId, userId, messageId);
  }
}
