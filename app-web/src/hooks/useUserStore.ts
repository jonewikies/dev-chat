import { useRootStore } from '../stores';
import { IUserStore } from '../stores/UserStore';

export function useUserStore(): IUserStore {
  const { userStore } = useRootStore();
  return userStore;
}
