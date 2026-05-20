import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useAuth } from '../contexts/AuthContext';
import { useProjectStore, useChatStore, useUserStore } from '../hooks';

const DataLoader = observer(({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuth();
  const projectStore = useProjectStore();
  const chatStore = useChatStore();
  const userStore = useUserStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      let isMounted = true;
      
      // 加载初始数据
      const loadData = async () => {
        try {
          console.log('Loading initial data...');
          
          // 并行加载数据
          await Promise.all([
            projectStore.fetchProjects(),
            chatStore.fetchChats(),
            userStore.getFriends(), // 加载好友列表
          ]);
          
          if (isMounted) {
            console.log('Initial data loaded successfully');
          }
        } catch (error) {
          if (isMounted) {
            console.error('Failed to load initial data:', error);
          }
        }
      };

      loadData();
      
      return () => {
        isMounted = false;
      };
    }
  }, [isAuthenticated, user]);

  return <>{children}</>;
});

export default DataLoader;
