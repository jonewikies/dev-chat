import React from 'react';
import { observer } from 'mobx-react-lite';
import { getAvatarUrl, GROUP_CHAT_AVATAR_URL } from '../../constants/avatar';
import { formatDateTime } from '../../utils/date-time';

interface Chat {
  id: number;
  name: string;
  type?: 'direct' | 'group' | 'project';
  avatar?: string | null;
  lastMessage?: string;
  lastMessageSenderName?: string | null;
  lastMessageTime?: Date;
  unreadCount?: number;
}

interface ChatListProps {
  chats: Chat[];
  activeChatId: number | null;
  onChatClick: (chatId: number) => void;
}

const ChatList = observer(({ chats, activeChatId, onChatClick }: ChatListProps) => {
  const renderPreview = (chat: Chat) => {
    if (!chat.lastMessage) {
      return '';
    }

    if (chat.lastMessageSenderName) {
      return `${chat.lastMessageSenderName}: ${chat.lastMessage}`;
    }

    return chat.lastMessage;
  };

  return (
    <>
      {chats.map(chat => {
        const isActive = activeChatId === chat.id;

        return (
        <div 
          key={chat.id}
          onClick={() => onChatClick(chat.id)}
          className={`relative flex items-center px-3 py-3 cursor-pointer transition-colors ${
            isActive ? 'bg-[#F0FDF4]' : 'hover:bg-[#F5F6F6]'
          }`}
        >
          {isActive && <div className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-emerald-500" />}
          <img 
            src={chat.type === 'group' ? GROUP_CHAT_AVATAR_URL : getAvatarUrl(chat.avatar)} 
            alt={chat.name} 
            className="ml-2 w-12 h-12 rounded-full mr-3" 
          />
          <div className={`flex-1 border-b pb-3 ${isActive ? 'border-emerald-100' : 'border-[#F0F2F5]'}`}>
            <div className="flex justify-between items-center mb-1">
              <span className={`font-medium text-[17px] ${isActive ? 'text-emerald-900' : 'text-gray-900'}`}>{chat.name}</span>
              <span className={`text-xs ${isActive ? 'text-emerald-700' : 'text-[#667781]'}`}>
                {formatDateTime(chat.lastMessageTime, '')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <p className={`text-sm truncate w-64 ${isActive ? 'text-emerald-800' : 'text-[#667781]'}`}>{renderPreview(chat)}</p>
              {Number(chat.unreadCount) > 0 && (
                <span className="bg-[#25D366] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {chat.unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      )})}
    </>
  );
});

export default ChatList;
