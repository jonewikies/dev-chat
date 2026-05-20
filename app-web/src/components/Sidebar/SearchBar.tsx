import React from 'react';
import { Search } from 'lucide-react';
import { useLanguage } from '../../i18n';

interface SearchBarProps {
  sidebarTab: 'chats' | 'contacts' | 'projects';
}

export default function SearchBar({ sidebarTab }: SearchBarProps) {
  const { t } = useLanguage();

  return (
    <div className="p-2">
      <div className="bg-[#F0F2F5] rounded-lg flex items-center px-3 py-1.5">
        <Search className="w-5 h-5 text-[#54656F] mr-3" />
        <input 
          type="text" 
          placeholder={`${t('search')} ${t(sidebarTab)}...`} 
          className="bg-transparent border-none outline-none text-sm w-full"
        />
      </div>
    </div>
  );
}
