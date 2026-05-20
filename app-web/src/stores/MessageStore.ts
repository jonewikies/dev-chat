import { types, flow, Instance } from 'mobx-state-tree';
import { messageApi, ApiMessage } from '../api';

export const Message = types.model('Message', {
  id: types.identifierNumber,
  chatId: types.number,
  senderId: types.number,
  content: types.string,
  type: types.optional(types.enumeration(['text', 'image', 'file', 'system', 'ai_summary']), 'text'),
  metadata: types.maybe(types.frozen()),
  replyToMessageId: types.maybeNull(types.number),
  createdAt: types.Date,
  updatedAt: types.Date,
});

export const MessageStore = types
  .model('MessageStore', {
    messages: types.map(Message),
    messagesByChatId: types.map(types.array(types.reference(Message))),
    isLoading: types.optional(types.boolean, false),
    error: types.maybeNull(types.string),
  })
  .actions((self) => ({
    addMessage(message: ApiMessage) {
      // 映射消息类型，将不支持的类型转为 'text'
      let type: 'text' | 'image' | 'file' | 'system' | 'ai_summary' = 'text';
      if (message.type === 'text' || message.type === 'file' || message.type === 'system' || message.type === 'ai_summary') {
        type = message.type;
      }
      
      const messageData = {
        id: message.id,
        chatId: message.chat_id,
        senderId: message.sender_id,
        content: message.content,
        type,
        metadata: message.metadata,
        replyToMessageId: message.reply_to_message_id || null,
        createdAt: new Date(message.created_at),
        updatedAt: new Date(message.updated_at),
      };
      self.messages.set(message.id.toString(), messageData);

      const chatId = message.chat_id.toString();
      if (!self.messagesByChatId.has(chatId)) {
        self.messagesByChatId.set(chatId, [] as any);
      }
      const chatMessages = self.messagesByChatId.get(chatId)!;
      if (!chatMessages.find((m) => m.id === message.id)) {
        chatMessages.push(message.id as any);
      }
    },

    addMessages(messages: ApiMessage[]) {
      messages.forEach((message) => this.addMessage(message));
    },

    removeMessage(messageId: number) {
      const message = self.messages.get(messageId.toString());
      if (message) {
        const chatId = message.chatId.toString();
        const chatMessages = self.messagesByChatId.get(chatId);
        if (chatMessages) {
          const index = chatMessages.findIndex((m) => m.id === messageId);
          if (index !== -1) {
            chatMessages.splice(index, 1);
          }
        }
        self.messages.delete(messageId.toString());
      }
    },

    clearChatMessages(chatId: number) {
      const chatMessages = self.messagesByChatId.get(chatId.toString());
      if (chatMessages) {
        chatMessages.forEach((msg) => {
          self.messages.delete(msg.id.toString());
        });
        self.messagesByChatId.delete(chatId.toString());
      }
    },

    setLoading(loading: boolean) {
      self.isLoading = loading;
    },

    setError(error: string | null) {
      self.error = error;
    },
  }))
  .actions((self) => ({
    fetchMessages: flow(function* (chatId: number, page = 1, perPage = 50) {
      self.setLoading(true);
      self.setError(null);
      try {
        const response: { messages: ApiMessage[] } = yield messageApi.getMessages(
          chatId,
          { page }
        );
        self.addMessages(response.messages);
        return response;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    sendMessage: flow(function* (chatId: number, content: string, type = 'text', metadata?: ApiMessage['metadata'], replyToMessageId?: number) {
      self.setError(null);
      try {
        const response: { message: ApiMessage } = yield messageApi.sendMessage(chatId, { content, type, metadata, replyToMessageId });
        self.addMessage(response.message);
        return response.message;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      }
    }),

    forwardMessage: flow(function* (messageId: number, targetChatId: number) {
      self.setError(null);
      try {
        const response: { message: ApiMessage } = yield messageApi.forwardMessage(messageId, targetChatId);
        self.addMessage(response.message);
        return response.message;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      }
    }),

    uploadAttachment: flow(function* (chatId: number, file: File) {
      self.setError(null);
      try {
        const response: { message: ApiMessage } = yield messageApi.uploadAttachment(chatId, file);
        self.addMessage(response.message);
        return response.message;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      }
    }),

    deleteMessage: flow(function* (messageId: number) {
      self.setError(null);
      try {
        yield messageApi.deleteMessage(messageId);
        self.removeMessage(messageId);
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      }
    }),
  }))
  .views((self) => ({
    getMessagesByChatId(chatId: number) {
      const messages = self.messagesByChatId.get(chatId.toString()) || [];
      return messages.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },

    getMessageById(id: number) {
      return self.messages.get(id.toString());
    },
  }));

export interface IMessage extends Instance<typeof Message> {}
export interface IMessageStore extends Instance<typeof MessageStore> {}
