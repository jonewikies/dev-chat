import { useRootStore } from '../stores';
import { IChatStore } from '../stores/ChatStore';

export function useChatStore(): IChatStore {
  const { chatStore } = useRootStore();
  return chatStore;
}
