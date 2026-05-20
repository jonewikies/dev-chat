import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  House,
  MessageSquare, 
  Users, 
  LayoutDashboard,
  Plus,
  LogOut
} from 'lucide-react';
import { useLanguage } from '../../i18n';
import { getAvatarUrl } from '../../constants/avatar';

interface SidebarHeaderProps {
  user: any;
  sidebarTab: 'chats' | 'contacts' | 'projects';
  onTabChange: (tab: 'chats' | 'contacts' | 'projects') => void;
  onGoHome: () => void;
  showPlusMenu: boolean;
  onTogglePlusMenu: () => void;
  onCreateProject: () => void;
  onAddContact: () => void;
  onOpenProfile: () => void;
  onLogout: () => Promise<void>;
}

export default function SidebarHeader({
  user,
  sidebarTab,
  onTabChange,
  onGoHome,
  showPlusMenu,
  onTogglePlusMenu,
  onCreateProject,
  onAddContact,
  onOpenProfile,
  onLogout,
}: SidebarHeaderProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-[76px] bg-[#F0F2F5] px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={onOpenProfile} className="flex items-center gap-3 text-left group">
            <img
            src={getAvatarUrl(user?.avatar_url)}
            alt="Profile"
            className="w-11 h-11 rounded-full border border-white/80 shadow-sm"
          />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">
              {user?.username || 'Guest'}
            </div>
            <div className="text-xs text-slate-500">
              {user?.display_name || '个人中心'}
            </div>
          </div>
        </button>
        <div className="flex bg-white/50 rounded-full p-1 border border-gray-200">
          <button 
            onClick={() => onTabChange('chats')}
            className={`p-1.5 rounded-full transition-all ${sidebarTab === 'chats' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
            title={t('chats')}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onTabChange('contacts')}
            className={`p-1.5 rounded-full transition-all ${sidebarTab === 'contacts' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
            title={t('contacts')}
          >
            <Users className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onTabChange('projects')}
            className={`p-1.5 rounded-full transition-all ${sidebarTab === 'projects' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
            title={t('projects')}
          >
            <LayoutDashboard className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex gap-4 text-[#54656F] items-center relative">
        <button 
          onClick={onGoHome}
          className="p-1.5 hover:bg-gray-200 rounded-full transition-colors text-gray-600 hover:text-emerald-600"
          title={t('backToHome') || '返回首页'}
        >
          <House className="w-5 h-5" />
        </button>
        <div className="relative">
          <Plus 
            className={`w-6 h-6 cursor-pointer hover:text-emerald-600 transition-colors ${showPlusMenu ? 'text-emerald-600 rotate-45' : ''}`} 
            onClick={onTogglePlusMenu} 
          />
          <AnimatePresence>
            {showPlusMenu && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 py-2"
              >
                <button 
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
                  onClick={() => { /* TODO: Create group chat */ }}
                >
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                  {t('newGroupChat')}
                </button>
                <button 
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3"
                  onClick={onAddContact}
                >
                  <Users className="w-4 h-4 text-blue-500" />
                  {t('addContact')}
                </button>
                <button 
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3 border-t border-gray-50 mt-1 pt-3"
                  onClick={onCreateProject}
                >
                  <LayoutDashboard className="w-4 h-4 text-orange-500" />
                  {t('newProject')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={async () => {
            if (confirm(t('confirmLogout') || '确定要退出登录吗？')) {
              await onLogout();
            }
          }}
          className="p-1.5 hover:bg-red-50 rounded-full transition-colors text-gray-600 hover:text-red-600"
          title={t('logout') || '退出登录'}
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
