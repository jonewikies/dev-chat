import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { MessageSquare } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { getAvatarUrl } from '../../constants/avatar';

interface User {
  id: number;
  username: string;
  displayName?: string | null;
  avatar?: string | null;
  isOnline?: boolean;
}

interface ContactListProps {
  users: User[];
  onContactClick: (userId: number) => void;
  onStartChat: (userId: number) => void;
}

const ContactList = observer(({ users, onContactClick, onStartChat }: ContactListProps) => {
  const { t } = useLanguage();
  const [loadingChatUserId, setLoadingChatUserId] = useState<number | null>(null);

  const handleStartChat = async (e: React.MouseEvent, userId: number) => {
    e.stopPropagation();
    setLoadingChatUserId(userId);
    try {
      await onStartChat(userId);
    } finally {
      setLoadingChatUserId(null);
    }
  };

  return (
    <>
      {users.map(user => (
        <div 
          key={user.id}
          onClick={() => onContactClick(user.id)}
          className="flex items-center px-3 py-3 cursor-pointer hover:bg-[#F5F6F6] transition-colors"
        >
          <div className="relative mr-3">
            <img 
              src={getAvatarUrl(user.avatar)} 
              alt={user.displayName || user.username} 
              className="w-12 h-12 rounded-full" 
            />
            {user.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />}
          </div>
          <div className="flex-1 border-b border-[#F0F2F5] pb-3 mr-2">
            <div className="flex justify-between items-center">
              <span className="font-medium text-[17px]">{user.displayName || user.username}</span>
            </div>
            <p className="text-sm text-[#667781]">{user.isOnline ? t('online') : t('offline')}</p>
          </div>
          <button 
            onClick={(e) => handleStartChat(e, user.id)}
            disabled={loadingChatUserId === user.id}
            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('sendMessage') || '发送消息'}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      ))}
    </>
  );
});

export default ContactList;
