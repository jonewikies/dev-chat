import { types, flow, Instance } from 'mobx-state-tree';
import { userApi, ApiUser } from '../api';

export const User = types.model('User', {
  id: types.identifierNumber,
  username: types.string,
  displayName: types.maybeNull(types.string),
  email: types.maybeNull(types.string),
  avatar: types.maybeNull(types.string),
  bio: types.maybeNull(types.string),
  role: types.maybeNull(types.string),
  department: types.maybeNull(types.string),
  status: types.optional(types.enumeration(['online', 'offline', 'away']), 'offline'),
  lastSeen: types.maybeNull(types.Date),
  createdAt: types.Date,
  updatedAt: types.Date,
})
.views((self) => ({
  get isOnline() {
    return self.status === 'online';
  },
}));

export const UserStore = types
  .model('UserStore', {
    users: types.map(User),
    friendIds: types.array(types.number), // 好友ID列表
    currentUser: types.maybeNull(types.reference(User)),
    isLoading: types.optional(types.boolean, false),
    error: types.maybeNull(types.string),
  })
  .actions((self) => ({
    setCurrentUser(user: ApiUser | null) {
      if (user) {
        self.users.set(user.id.toString(), {
          id: user.id,
          username: user.username,
          displayName: user.display_name || null,
          email: user.email || null,
          avatar: user.avatar_url || null,
          bio: null,
          role: null,
          department: null,
          status: user.is_online ? 'online' : 'offline',
          lastSeen: user.last_seen_at ? new Date(user.last_seen_at) : null,
          createdAt: new Date(user.created_at),
          updatedAt: new Date(user.updated_at),
        });
        self.currentUser = user.id as any;
      } else {
        self.currentUser = null;
      }
    },

    addUser(user: ApiUser) {
      self.users.set(user.id.toString(), {
        id: user.id,
        username: user.username,
        displayName: user.display_name || null,
        email: user.email || null,
        avatar: user.avatar_url || null,
        bio: null,
        role: null,
        department: null,
        status: user.is_online ? 'online' : 'offline',
        lastSeen: user.last_seen_at ? new Date(user.last_seen_at) : null,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
      });
    },

    addUsers(users: ApiUser[]) {
      users.forEach((user) => {
        self.users.set(user.id.toString(), {
          id: user.id,
          username: user.username,
          displayName: user.display_name || null,
          email: user.email || null,
          avatar: user.avatar_url || null,
          bio: null,
          role: null,
          department: null,
          status: user.is_online ? 'online' : 'offline',
          lastSeen: user.last_seen_at ? new Date(user.last_seen_at) : null,
          createdAt: new Date(user.created_at),
          updatedAt: new Date(user.updated_at),
        });
      });
    },

    updateUserStatus(userId: number, status: 'online' | 'offline' | 'away') {
      const user = self.users.get(userId.toString());
      if (user) {
        user.status = status;
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
    fetchUser: flow(function* (userId: number) {
      self.setLoading(true);
      self.setError(null);
      try {
        const user: ApiUser = yield userApi.getUser(userId);
        self.addUser(user);
        return user;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    searchUsers: flow(function* (query: string) {
      self.setLoading(true);
      self.setError(null);
      try {
        const users: ApiUser[] = yield userApi.searchUsers(query);
        self.addUsers(users);
        return users;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    updateProfile: flow(function* (updates: Partial<ApiUser>) {
      self.setLoading(true);
      self.setError(null);
      try {
        const updatedUser: ApiUser = yield userApi.updateUser(updates);
        self.addUser(updatedUser);
        return updatedUser;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    addFriend: flow(function* (userId: number) {
      self.setError(null);
      try {
        const friendship = yield userApi.sendFriendRequest(userId);
        console.log('[UserStore] Friend request sent:', friendship);
        return friendship;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      }
    }),

    getFriends: flow(function* () {
      self.setLoading(true);
      self.setError(null);
      try {
        const friends: ApiUser[] = yield userApi.getFriends();
        console.log('[UserStore] Friends loaded:', friends);
        
        // 清空旧的好友ID列表
        self.friendIds.clear();
        
        // 添加好友信息到 users map，并记录好友ID
        friends.forEach((friend) => {
          self.addUser(friend);
          if (!self.friendIds.includes(friend.id)) {
            self.friendIds.push(friend.id);
          }
        });
        
        return friends;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    refreshFriends: flow(function* () {
      // 刷新好友列表（静默刷新，不显示loading状态）
      try {
        const friends: ApiUser[] = yield userApi.getFriends();
        self.friendIds.clear();
        friends.forEach((friend) => {
          self.addUser(friend);
          if (!self.friendIds.includes(friend.id)) {
            self.friendIds.push(friend.id);
          }
        });
      } catch (error: any) {
        console.error('[UserStore] Failed to refresh friends:', error);
      }
    }),
  }))
  .views((self) => ({
    get allUsers() {
      return Array.from(self.users.values());
    },

    getUserById(id: number) {
      return self.users.get(id.toString());
    },

    get onlineUsers() {
      return Array.from(self.users.values()).filter((u) => u.status === 'online');
    },

    get friends() {
      // 返回好友列表（根据 friendIds 从 users map 中获取）
      return self.friendIds
        .map((id) => self.users.get(id.toString()))
        .filter((user): user is typeof User.Type => user !== undefined);
    },
  }));

export interface IUser extends Instance<typeof User> {}
export interface IUserStore extends Instance<typeof UserStore> {}
