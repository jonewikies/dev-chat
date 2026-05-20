import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useLanguage } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { useProjectStore, useChatStore, useUserStore } from '../../hooks';
import { wsService } from '../../services/websocket';
import SidebarHeader from './SidebarHeader';
import SearchBar from './SearchBar';
import ChatList from './ChatList';
import ContactList from './ContactList';
import ProjectList from './ProjectList';
import AddContactModal from '../AddContactModal';

interface SidebarProps {
  onCreateProject: () => void;
  onOpenProfile: () => void;
}

const Sidebar = observer(({ onCreateProject, onOpenProfile }: SidebarProps) => {
  const { t } = useLanguage();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'contacts' | 'projects'>('chats');
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);

  const chatStore = useChatStore();
  const userStore = useUserStore();
  const projectStore = useProjectStore();
  const chatRouteMatch = location.pathname.match(/^\/chat\/(\d+)$/);
  const activeChatId = chatRouteMatch ? parseInt(chatRouteMatch[1], 10) : null;
  const projectRouteMatch = location.pathname.match(/^\/project\/(\d+)/);
  const activeProjectId = projectRouteMatch ? parseInt(projectRouteMatch[1], 10) : null;

  // 设置当前用户ID到 ChatStore
  useEffect(() => {
    if (user) {
      chatStore.setCurrentUserId(user.id);
    }
  }, [user, chatStore]);

  useEffect(() => {
    if (location.pathname.startsWith('/project/') || location.pathname === '/projects') {
      setSidebarTab('projects');
      return;
    }

    if (location.pathname.startsWith('/contact/') || location.pathname === '/contacts') {
      setSidebarTab('contacts');
      return;
    }

    setSidebarTab('chats');
  }, [location.pathname]);

  // 全局监听WebSocket新消息，更新聊天列表
  useEffect(() => {
    console.log('📡 [Sidebar] Setting up WebSocket listener');
    
    const handleNewMessage = (data: { message: any; senderUsername: string }) => {
      console.log('📨 [Sidebar] Received new message:', {
        chatId: data.message.chat_id,
        sender: data.senderUsername,
        currentPath: location.pathname
      });
      
      // 获取当前打开的聊天ID
      const match = location.pathname.match(/^\/chat\/(\d+)$/);
      const currentChatId = match ? parseInt(match[1]) : null;
      
      console.log('📝 [Sidebar] Calling handleNewMessage, currentChatId:', currentChatId);
      // 更新聊天列表的最后消息显示
      chatStore.handleNewMessage(data.message, currentChatId);
      
      console.log('🔄 [Sidebar] Calling refreshChatFromServer for chat:', data.message.chat_id);
      // 从服务器刷新该聊天的完整数据（包括未读数）
      chatStore.refreshChatFromServer(data.message.chat_id);
    };

    wsService.onNewMessage(handleNewMessage);

    return () => {
      console.log('🔌 [Sidebar] Cleaning up WebSocket listener');
      wsService.offNewMessage(handleNewMessage);
    };
  }, [location.pathname, chatStore]);

  const handleTabChange = (tab: 'chats' | 'contacts' | 'projects') => {
    setSidebarTab(tab);
    if (tab === 'chats') navigate('/');
    else if (tab === 'contacts') navigate('/contacts');
    else if (tab === 'projects') navigate('/projects');
  };

  return (
    <div className="w-[400px] border-r border-[#D1D7DB] bg-white flex flex-col">
      {/* Sidebar Header */}
      <SidebarHeader
        user={user}
        sidebarTab={sidebarTab}
        onTabChange={handleTabChange}
        onGoHome={() => navigate('/')}
        showPlusMenu={showPlusMenu}
        onTogglePlusMenu={() => setShowPlusMenu(!showPlusMenu)}
        onCreateProject={() => {
          setShowPlusMenu(false);
          onCreateProject();
        }}
        onAddContact={() => {
          setShowPlusMenu(false);
          setShowAddContactModal(true);
        }}
        onOpenProfile={onOpenProfile}
        onLogout={logout}
      />

      {/* Search */}
      <SearchBar sidebarTab={sidebarTab} />

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto">
        {sidebarTab === 'chats' && (
          <ChatList
            chats={chatStore.allChats}
            activeChatId={activeChatId}
            onChatClick={(chatId) => navigate(`/chat/${chatId}`)}
          />
        )}

        {sidebarTab === 'contacts' && (
          <ContactList
            users={userStore.friends}
            onContactClick={(userId) => navigate(`/contact/${userId}`)}
            onStartChat={async (userId) => {
              const chat = await chatStore.createDirectChat(userId);
              navigate(`/chat/${chat.id}`);
            }}
          />
        )}

        {sidebarTab === 'projects' && (
          <ProjectList
            projects={Array.from(projectStore.projects.values())}
            activeProjectId={activeProjectId}
            onProjectClick={(projectId) => navigate(`/project/${projectId}/overview`)}
          />
        )}
      </div>

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
      />
    </div>
  );
});

export default Sidebar;
