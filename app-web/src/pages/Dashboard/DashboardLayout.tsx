import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import Sidebar from '../../components/Sidebar/Sidebar';
import ProjectModal from '../../components/ProjectModal';
import ProfileModal from '../../components/ProfileModal';
import DataLoader from '../../components/DataLoader';
import { useChatStore } from '../../hooks';

const DEFAULT_PAGE_TITLE = 'DevChat - AI-Powered R&D Management';

export default observer(function DashboardLayout() {
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const chatStore = useChatStore();

  useEffect(() => {
    const unreadCount = chatStore.unreadChatsCount;
    document.title = unreadCount > 0 ? `(${unreadCount}) ${DEFAULT_PAGE_TITLE}` : DEFAULT_PAGE_TITLE;

    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };

    if (unreadCount > 0) {
      nav.setAppBadge?.(unreadCount).catch(() => undefined);
    } else {
      nav.clearAppBadge?.().catch(() => undefined);
    }
  }, [chatStore.unreadChatsCount]);

  return (
    <DataLoader>
      <div className="flex h-screen bg-[#F0F2F5] text-[#111B21] font-sans overflow-hidden">
        <Sidebar
          onCreateProject={() => setIsProjectModalOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />
        <Outlet />
        <ProjectModal 
          isOpen={isProjectModalOpen} 
          onClose={() => setIsProjectModalOpen(false)} 
        />
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
      </div>
    </DataLoader>
  );
});
