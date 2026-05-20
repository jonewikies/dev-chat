import type { ApiMessage } from '../api/types';

/**
 * 浏览器通知服务
 * 处理浏览器通知权限请求和通知显示
 */
class NotificationService {
  private permission: NotificationPermission = 'default';
  private currentUserId: number | null = null;
  private messageAudio: HTMLAudioElement | null = null;

  constructor() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }

    if (typeof Audio !== 'undefined') {
      this.messageAudio = new Audio('/sounds/message-ding.mp3');
      this.messageAudio.preload = 'auto';
    }
  }

  /**
   * 请求通知权限
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('[Notification] Browser does not support notifications');
      return 'denied';
    }

    if (this.permission === 'granted') {
      return 'granted';
    }

    try {
      this.permission = await Notification.requestPermission();
      console.log('[Notification] Permission:', this.permission);
      return this.permission;
    } catch (error) {
      console.error('[Notification] Error requesting permission:', error);
      return 'denied';
    }
  }

  /**
   * 显示通知
   * @param title 通知标题
   * @param options 通知选项
   */
  async showNotification(
    title: string,
    options?: NotificationOptions,
    behavior?: {
      forceWhenVisible?: boolean;
      onClick?: () => void;
    }
  ): Promise<void> {
    // 如果浏览器不支持通知
    if (!('Notification' in window)) {
      console.warn('[Notification] Browser does not support notifications');
      return;
    }

    // 如果页面在前台，不显示通知
    if (!behavior?.forceWhenVisible && !document.hidden) {
      console.log('[Notification] Page is visible, skipping notification');
      return;
    }

    // 如果没有权限，先请求权限
    if (this.permission !== 'granted') {
      const result = await this.requestPermission();
      if (result !== 'granted') {
        console.warn('[Notification] Permission not granted');
        return;
      }
    }

    // 显示通知
    try {
      const notification = new Notification(title, {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        ...options,
      });

      // 点击通知时聚焦窗口
      notification.onclick = () => {
        window.focus();
        behavior?.onClick?.();
        notification.close();
      };

      // 3秒后自动关闭
      setTimeout(() => {
        notification.close();
      }, 3000);

      console.log('[Notification] Notification shown:', title);
    } catch (error) {
      console.error('[Notification] Error showing notification:', error);
    }
  }

  /**
   * 显示新消息通知
   */
  async showMessageNotification(senderName: string, messageContent: string, chatId?: number): Promise<void> {
    await this.showNotification(`${senderName} 发送了新消息`, {
      body: messageContent,
      tag: chatId ? `chat-${chatId}` : undefined,
      icon: '/favicon.svg',
      requireInteraction: false,
    });
  }

  async showAIProposalNotification(projectId: number, projectName: string, proposalCount: number): Promise<void> {
    await this.showNotification(
      `${projectName} 有新的 AI 待确认内容`,
      {
        body: `AI 生成了 ${proposalCount} 条待确认提案，点击进入 AI 管理页处理。`,
        tag: `project-ai-${projectId}`,
        icon: '/favicon.svg',
        requireInteraction: true,
      },
      {
        forceWhenVisible: true,
        onClick: () => {
          window.location.href = `/project/${projectId}/ai`;
        },
      }
    );
  }

  /**
   * 检查是否有通知权限
   */
  hasPermission(): boolean {
    return this.permission === 'granted';
  }

  setCurrentUserId(userId: number | null) {
    this.currentUserId = userId;
  }

  async playMessageSound(): Promise<void> {
    if (!this.messageAudio) {
      return;
    }

    try {
      this.messageAudio.currentTime = 0;
      await this.messageAudio.play();
    } catch (error) {
      console.warn('[Notification] Failed to play message sound:', error);
    }
  }

  async notifyIncomingMessage(message: ApiMessage, senderName: string): Promise<void> {
    if (this.currentUserId && message.sender_id === this.currentUserId) {
      return;
    }

    await this.playMessageSound();
    await this.showMessageNotification(senderName, this.getMessagePreview(message), message.chat_id);
  }

  /**
   * 获取当前权限状态
   */
  getPermission(): NotificationPermission {
    return this.permission;
  }

  private getMessagePreview(message: ApiMessage): string {
    switch (message.type) {
      case 'file':
        return `[文件] ${message.metadata?.fileName || message.content || ''}`.trim();
      case 'ai_summary':
        return '[AI摘要]';
      case 'system':
        return message.content || '[系统消息]';
      case 'text':
      default:
        return message.content || '[消息]';
    }
  }
}

export const notificationService = new NotificationService();
