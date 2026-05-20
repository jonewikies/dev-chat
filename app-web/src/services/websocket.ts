import { io, Socket } from 'socket.io-client';
import { ApiMessage } from '../api/types';
import { APP_BASE_URL } from '../api/config';
import { notificationService } from './notification';

interface ServerToClientEvents {
  newMessage: (data: { message: ApiMessage; senderUsername: string }) => void;
  aiProposalCreated: (data: { projectId: number; projectName: string; analysisId: number; proposalCount: number; triggeredByUserId: number }) => void;
  userStatusChanged: (data: { userId: number; isOnline: boolean }) => void;
  userTyping: (data: { chatId: number; userId: number; username: string }) => void;
  userStopTyping: (data: { chatId: number; userId: number }) => void;
  messageRead: (data: { chatId: number; messageId: number; userId: number }) => void;
  error: (data: { message: string }) => void;
}

interface ClientToServerEvents {
  joinChat: (chatId: number) => void;
  leaveChat: (chatId: number) => void;
  typing: (chatId: number) => void;
  stopTyping: (chatId: number) => void;
  markAsRead: (data: { chatId: number; lastReadMessageId: number }) => void;
}

class WebSocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token: string) {
    if (this.socket?.connected) {
      console.log('[WebSocket] Already connected');
      return this.socket;
    }

    console.log('[WebSocket] Connecting...');
    
    this.socket = io(APP_BASE_URL, {
      auth: {
        token,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached');
        this.disconnect();
      }
    });

    // 设置全局的新消息监听器，自动显示浏览器通知
    this.socket.on('newMessage', (data: { message: ApiMessage; senderUsername: string }) => {
      console.log('🔔 [WebSocket] New message received:', {
        chatId: data.message.chat_id,
        sender: data.senderUsername,
        content: data.message.content.substring(0, 30),
        messageId: data.message.id
      });

      notificationService.notifyIncomingMessage(data.message, data.senderUsername);
    });

    this.socket.on('aiProposalCreated', (data) => {
      console.log('[WebSocket] AI proposals ready:', data);
      notificationService.showAIProposalNotification(data.projectId, data.projectName, data.proposalCount);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      console.log('[WebSocket] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinChat(chatId: number) {
    if (this.socket?.connected) {
      console.log(`[WebSocket] Joining chat ${chatId}`);
      this.socket.emit('joinChat', chatId);
    }
  }

  leaveChat(chatId: number) {
    if (this.socket?.connected) {
      console.log(`[WebSocket] Leaving chat ${chatId}`);
      this.socket.emit('leaveChat', chatId);
    }
  }

  startTyping(chatId: number) {
    if (this.socket?.connected) {
      this.socket.emit('typing', chatId);
    }
  }

  stopTyping(chatId: number) {
    if (this.socket?.connected) {
      this.socket.emit('stopTyping', chatId);
    }
  }

  markAsRead(chatId: number, lastReadMessageId: number) {
    if (this.socket?.connected) {
      this.socket.emit('markAsRead', { chatId, lastReadMessageId });
    }
  }

  onNewMessage(callback: (data: { message: ApiMessage; senderUsername: string }) => void) {
    this.socket?.on('newMessage', callback);
  }

  onUserStatusChanged(callback: (data: { userId: number; isOnline: boolean }) => void) {
    this.socket?.on('userStatusChanged', callback);
  }

  onUserTyping(callback: (data: { chatId: number; userId: number; username: string }) => void) {
    this.socket?.on('userTyping', callback);
  }

  onUserStopTyping(callback: (data: { chatId: number; userId: number }) => void) {
    this.socket?.on('userStopTyping', callback);
  }

  onError(callback: (data: { message: string }) => void) {
    this.socket?.on('error', callback);
  }

  onAIProposalCreated(callback: (data: { projectId: number; projectName: string; analysisId: number; proposalCount: number; triggeredByUserId: number }) => void) {
    this.socket?.on('aiProposalCreated', callback);
  }

  offNewMessage(callback?: (data: { message: ApiMessage; senderUsername: string }) => void) {
    if (callback) {
      this.socket?.off('newMessage', callback);
    } else {
      this.socket?.off('newMessage');
    }
  }

  offUserStatusChanged(callback?: (data: { userId: number; isOnline: boolean }) => void) {
    if (callback) {
      this.socket?.off('userStatusChanged', callback);
    } else {
      this.socket?.off('userStatusChanged');
    }
  }

  offUserTyping(callback?: (data: { chatId: number; userId: number; username: string }) => void) {
    if (callback) {
      this.socket?.off('userTyping', callback);
    } else {
      this.socket?.off('userTyping');
    }
  }

  offUserStopTyping(callback?: (data: { chatId: number; userId: number }) => void) {
    if (callback) {
      this.socket?.off('userStopTyping', callback);
    } else {
      this.socket?.off('userStopTyping');
    }
  }

  offError(callback?: (data: { message: string }) => void) {
    if (callback) {
      this.socket?.off('error', callback);
    } else {
      this.socket?.off('error');
    }
  }

  offAIProposalCreated(
    callback?: (data: { projectId: number; projectName: string; analysisId: number; proposalCount: number; triggeredByUserId: number }) => void
  ) {
    if (callback) {
      this.socket?.off('aiProposalCreated', callback);
    } else {
      this.socket?.off('aiProposalCreated');
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export const wsService = new WebSocketService();
