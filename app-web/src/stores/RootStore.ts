import { types, Instance } from 'mobx-state-tree';
import { UserStore } from './UserStore';
import { ChatStore } from './ChatStore';
import { MessageStore } from './MessageStore';
import { ProjectStore } from './ProjectStore';
import { TaskStore } from './TaskStore';

export const RootStore = types.model('RootStore', {
  userStore: types.optional(UserStore, {}),
  chatStore: types.optional(ChatStore, {}),
  messageStore: types.optional(MessageStore, {}),
  projectStore: types.optional(ProjectStore, {}),
  taskStore: types.optional(TaskStore, {}),
});

export interface IRootStore extends Instance<typeof RootStore> {}

let rootStoreInstance: IRootStore | null = null;

export function createRootStore(): IRootStore {
  if (!rootStoreInstance) {
    rootStoreInstance = RootStore.create({});
  }
  return rootStoreInstance;
}

export function getRootStore(): IRootStore {
  if (!rootStoreInstance) {
    throw new Error('RootStore has not been created yet');
  }
  return rootStoreInstance;
}
