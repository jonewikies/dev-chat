import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

export interface WSAuthData {
  token: string;
}

export interface WSJoinChatData {
  chatId: number;
}

export interface WSSendMessageData {
  chatId: number;
  content: string;
  type?: 'text' | 'file';
  replyToMessageId?: number;
}

export interface WSTypingData {
  chatId: number;
}

export interface WSMessageReadData {
  chatId: number;
  lastReadMessageId: number;
}

// Socket.io 事件类型定义
export interface ClientToServerEvents {
  auth: (data: WSAuthData) => void;
  joinChat: (chatId: number) => void;
  leaveChat: (chatId: number) => void;
  sendMessage: (data: WSSendMessageData) => void;
  typing: (data: number) => void;
  stopTyping: (data: number) => void;
  markAsRead: (data: WSMessageReadData) => void;
}

export interface ServerToClientEvents {
  authenticated: () => void;
  authError: (error: string) => void;
  newMessage: (message: any) => void;
  messageUpdated: (message: any) => void;
  messageDeleted: (data: { chatId: number; messageId: number }) => void;
  aiProposalCreated: (data: { projectId: number; projectName: string; analysisId: number; proposalCount: number; triggeredByUserId: number }) => void;
  userTyping: (data: { chatId: number; userId: number; username: string }) => void;
  userStoppedTyping: (data: { chatId: number; userId: number }) => void;
  userStopTyping: (data: { chatId: number; userId: number }) => void;
  messageRead: (data: { chatId: number; messageId: number; userId: number }) => void;
  chatUpdated: (chat: any) => void;
  userStatusChanged: (data: { userId: number; isOnline: boolean }) => void;
  error: (error: string | { message: string }) => void;
}

export interface SocketData {
  userId?: number;
  username?: string;
}
