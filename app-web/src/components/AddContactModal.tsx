import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, UserPlus, Loader2, Check } from 'lucide-react';
import { useLanguage } from '../i18n';
import { useUserStore } from '../hooks/useUserStore';
import { observer } from 'mobx-react-lite';
import { getAvatarUrl } from '../constants/avatar';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddContactModal: React.FC<AddContactModalProps> = observer(({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const userStore = useUserStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [addingUserId, setAddingUserId] = useState<number | null>(null);
  const [addedUserIds, setAddedUserIds] = useState<Set<number>>(new Set());

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await userStore.searchUsers(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddContact = async (userId: number) => {
    setAddingUserId(userId);
    try {
      await userStore.addFriend(userId);
      setAddedUserIds(new Set([...addedUserIds, userId]));
      
      // 刷新好友列表
      await userStore.refreshFriends();
      
      setTimeout(() => {
        setAddingUserId(null);
      }, 1000);
    } catch (error) {
      console.error('Add contact failed:', error);
      setAddingUserId(null);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setAddedUserIds(new Set());
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              {t('addContact')}
            </h2>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Search Input */}
          <div className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('searchUserPlaceholder') || '搜索用户名或邮箱...'}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="w-full mt-3 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('searching')}
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  {t('search')}
                </>
              )}
            </button>
          </div>

          {/* Search Results */}
          <div className="max-h-96 overflow-y-auto px-6 pb-6">
            {searchResults.length === 0 && !isSearching && searchQuery && (
              <div className="text-center py-8 text-gray-400">
                <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('noUsersFound') || '未找到用户'}</p>
              </div>
            )}

            {searchResults.map((user) => {
              const isAdded = addedUserIds.has(user.id);
              const isAdding = addingUserId === user.id;

              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl mb-2 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={getAvatarUrl(user.avatar_url)}
                      alt={user.display_name || user.username}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="font-medium text-gray-800">
                        {user.display_name || user.username}
                      </p>
                      <p className="text-xs text-gray-500">@{user.username}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddContact(user.id)}
                    disabled={isAdded || isAdding}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      isAdded
                        ? 'bg-green-100 text-green-600 cursor-default'
                        : isAdding
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600'
                    }`}
                  >
                    {isAdding ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('adding')}
                      </>
                    ) : isAdded ? (
                      <>
                        <Check className="w-4 h-4" />
                        {t('added')}
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        {t('add')}
                      </>
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

export default AddContactModal;
