import { useRootStore } from '../stores';
import { ITaskStore } from '../stores/TaskStore';

export function useTaskStore(): ITaskStore {
  const { taskStore } = useRootStore();
  return taskStore;
}
