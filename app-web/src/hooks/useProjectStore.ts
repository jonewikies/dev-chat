import { useRootStore } from '../stores';
import { IProjectStore } from '../stores/ProjectStore';

export function useProjectStore(): IProjectStore {
  const { projectStore } = useRootStore();
  return projectStore;
}
