import { useRootStore } from '../stores';
import { IMessageStore } from '../stores/MessageStore';

export function useMessageStore(): IMessageStore {
  const { messageStore } = useRootStore();
  return messageStore;
}
