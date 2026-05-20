import { types, flow, Instance } from 'mobx-state-tree';
import { chatApi, ApiChat, ApiChatMember } from '../api';

export const Chat = types.model('Chat', {
  id: types.identifierNumber,
  name: types.maybeNull(types.string),
  type: types.enumeration(['direct', 'group', 'project']),
  avatar: types.maybeNull(types.string),
  lastMessage: types.maybeNull(types.string),
  lastMessageSenderName: types.maybeNull(types.string),
  lastMessageTime: types.maybeNull(types.Date),
  unreadCount: types.optional(types.number, 0),
  projectId: types.maybeNull(types.number),
  createdAt: types.Date,
  updatedAt: types.Date,
});

export const ChatStore = types
  .model('ChatStore', {
    chats: types.map(Chat),
    activeChat: types.maybeNull(types.reference(Chat)),
    isLoading: types.optional(types.boolean, false),
    error: types.maybeNull(types.string),
    currentUserId: types.maybeNull(types.number), // 当前用户ID
  })
  .actions((self) => ({
    buildChatSnapshot(chat: ApiChat) {
      const existingChat = self.chats.get(chat.id.toString());

      // 从成员信息中获取当前用户的未读消息数
      let unreadCount = existingChat?.unreadCount || 0;
      if (chat.members && self.currentUserId) {
        const currentUserMember = chat.members.find(m => m.user_id === self.currentUserId);
        if (currentUserMember) {
          unreadCount = currentUserMember.unread_count;
        }
      }

      return {
        id: chat.id,
        name: chat.name || null,
        type: chat.type,
        avatar: chat.avatar_url || null,
        lastMessage: chat.last_message ?? existingChat?.lastMessage ?? null,
        lastMessageSenderName: chat.last_message_sender_name ?? existingChat?.lastMessageSenderName ?? null,
        lastMessageTime: chat.last_message_time
          ? new Date(chat.last_message_time)
          : (existingChat?.lastMessageTime ?? null),
        unreadCount,
        projectId: chat.project_id || null,
        createdAt: new Date(chat.created_at),
        updatedAt: new Date(chat.updated_at),
      };
    },

    setCurrentUserId(userId: number | null) {
      self.currentUserId = userId;
    },

    removeChat(chatId: number) {
      if (self.activeChat?.id === chatId) {
        self.activeChat = null;
      }
      self.chats.delete(chatId.toString());
    },

    addChat(chat: ApiChat) {
      self.chats.set(chat.id.toString(), this.buildChatSnapshot(chat));
    },

    addChats(chats: ApiChat[]) {
      chats.forEach((chat) => {
        self.chats.set(chat.id.toString(), this.buildChatSnapshot(chat));
      });
    },

    setActiveChat(chatId: number | null) {
      if (chatId === null) {
        self.activeChat = null;
      } else {
        self.activeChat = chatId as any;
      }
    },

    updateUnreadCount(chatId: number, count: number) {
      const chat = self.chats.get(chatId.toString());
      if (chat) {
        chat.unreadCount = count;
      }
    },

    updateLastMessage(chatId: number, message: string, time: Date, senderName?: string | null) {
      const chat = self.chats.get(chatId.toString());
      if (chat) {
        chat.lastMessage = message;
        chat.lastMessageSenderName = senderName || null;
        chat.lastMessageTime = time;
      }
    },

    incrementUnreadCount(chatId: number) {
      const chat = self.chats.get(chatId.toString());
      if (chat) {
        chat.unreadCount += 1;
      }
    },

    handleNewMessage(message: any, currentChatId: number | null) {
      const chatId = message.chat_id;
      console.log('💬 [ChatStore.handleNewMessage] Processing message for chat:', chatId, 'currentChat:', currentChatId);
      const chat = self.chats.get(chatId.toString());
      
      if (chat) {
        console.log('✅ [ChatStore.handleNewMessage] Chat found, updating lastMessage');
        // 仅更新最后一条消息显示
        chat.lastMessage = message.content || '';
        chat.lastMessageSenderName = data.senderUsername || null;
        chat.lastMessageTime = new Date(message.created_at);
        // 不在客户端维护未读数，未读数由服务端管理
      } else {
        console.warn('⚠️ [ChatStore.handleNewMessage] Chat not found:', chatId);
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
    refreshChatFromServer: flow(function* (chatId: number) {
      try {
        console.log(`🔄 [ChatStore.refreshChatFromServer] START - Refreshing chat ${chatId}`);
        console.log(`🔄 [ChatStore.refreshChatFromServer] Current user ID:`, self.currentUserId);
        
        // 重新从服务器获取单个聊天的最新数据（包括未读数）
        const chat: ApiChat = yield chatApi.getChatDetail(chatId);
        console.log(`📦 [ChatStore.refreshChatFromServer] Received chat data:`, {
          id: chat.id,
          name: chat.name,
          members: chat.members,
          hasMembersField: !!chat.members
        });
        
        // 更新聊天数据
        const existingChat = self.chats.get(chat.id.toString());
        if (existingChat) {
          console.log(`✅ [ChatStore.refreshChatFromServer] Chat found in store`);
          // 从成员信息中获取当前用户的未读消息数
          let unreadCount = 0;
          if (chat.members && self.currentUserId) {
            const currentUserMember = chat.members.find(m => m.user_id === self.currentUserId);
            console.log(`👤 [ChatStore.refreshChatFromServer] Current user member:`, currentUserMember);
            if (currentUserMember) {
              unreadCount = currentUserMember.unread_count;
            }
          } else {
            console.warn(`⚠️ [ChatStore.refreshChatFromServer] No members data or no current user ID`);
          }
          
          console.log(`📊 [ChatStore.refreshChatFromServer] Updating chat ${chatId}:`, {
            oldUnreadCount: existingChat.unreadCount,
            newUnreadCount: unreadCount
          });
          
          // 更新现有聊天
          existingChat.name = chat.name || null;
          existingChat.avatar = chat.avatar_url || null;
          existingChat.lastMessage = chat.last_message || existingChat.lastMessage;
          existingChat.lastMessageSenderName = chat.last_message_sender_name || existingChat.lastMessageSenderName;
          existingChat.lastMessageTime = chat.last_message_time ? new Date(chat.last_message_time) : existingChat.lastMessageTime;
          existingChat.unreadCount = unreadCount;
          existingChat.updatedAt = new Date(chat.updated_at);
          
          console.log(`✅ [ChatStore.refreshChatFromServer] DONE - Chat ${chatId} updated, final unreadCount: ${existingChat.unreadCount}`);
        } else {
          console.error(`❌ [ChatStore.refreshChatFromServer] Chat ${chatId} NOT FOUND in store`);
        }
      } catch (error: any) {
        console.error('❌ [ChatStore.refreshChatFromServer] ERROR:', error);
      }
    }),
    fetchChats: flow(function* () {
      self.setLoading(true);
      self.setError(null);
      try {
        const chats: ApiChat[] = yield chatApi.getChats();
        self.addChats(chats);
        return chats;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    fetchChatDetail: flow(function* (chatId: number) {
      self.setLoading(true);
      self.setError(null);
      try {
        const chat: ApiChat = yield chatApi.getChatDetail(chatId);
        self.addChat(chat);
        return chat;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    createDirectChat: flow(function* (userId: number) {
      self.setLoading(true);
      self.setError(null);
      try {
        const chat: ApiChat = yield chatApi.createDirectChat(userId);
        self.addChat(chat);
        return chat;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    createGroupChat: flow(function* (name: string, memberIds: number[]) {
      self.setLoading(true);
      self.setError(null);
      try {
        const chat: ApiChat = yield chatApi.createGroupChat({ name, memberIds });
        self.addChat(chat);
        return chat;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    markAsRead: flow(function* (chatId: number) {
      try {
        // 调用API标记已读
        yield chatApi.markAsRead(chatId, 0); // messageId为0表示标记所有未读为已读
        
        // 从服务器刷新该聊天的数据（包括未读数）
        const chat: ApiChat = yield chatApi.getChatDetail(chatId);
        
        // 更新聊天数据
        const existingChat = self.chats.get(chat.id.toString());
        if (existingChat) {
          // 从成员信息中获取当前用户的未读消息数
          let unreadCount = 0;
          if (chat.members && self.currentUserId) {
            const currentUserMember = chat.members.find(m => m.user_id === self.currentUserId);
            if (currentUserMember) {
              unreadCount = currentUserMember.unread_count;
            }
          }
          
          // 更新现有聊天
          existingChat.name = chat.name || null;
          existingChat.avatar = chat.avatar_url || null;
          existingChat.lastMessage = chat.last_message || existingChat.lastMessage;
          existingChat.lastMessageTime = chat.last_message_time ? new Date(chat.last_message_time) : existingChat.lastMessageTime;
          existingChat.unreadCount = unreadCount;
          existingChat.updatedAt = new Date(chat.updated_at);
        }
      } catch (error: any) {
        console.error('Failed to mark as read:', error);
      }
    }),
  }))
  .views((self) => ({
    get allChats() {
      return Array.from(self.chats.values()).sort((a, b) => {
        const timeA = a.lastMessageTime?.getTime() || 0;
        const timeB = b.lastMessageTime?.getTime() || 0;
        return timeB - timeA;
      });
    },

    getChatById(id: number) {
      return self.chats.get(id.toString());
    },

    get unreadChatsCount() {
      return Array.from(self.chats.values()).reduce((sum, chat) => sum + chat.unreadCount, 0);
    },
  }));

export interface IChat extends Instance<typeof Chat> {}
export interface IChatStore extends Instance<typeof ChatStore> {}
