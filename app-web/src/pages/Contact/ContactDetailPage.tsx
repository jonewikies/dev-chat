import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { MessageCircle, Mail, Calendar, Clock, ArrowLeft } from 'lucide-react';
import { useUserStore, useChatStore } from '../../hooks';
import { useLanguage } from '../../i18n';
import { getAvatarUrl } from '../../constants/avatar';
import { formatDateTime } from '../../utils/date-time';

const ContactDetailPage = observer(() => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const userStore = useUserStore();
  const chatStore = useChatStore();
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  const contact = userId ? userStore.getUserById(parseInt(userId)) : null;

  const handleStartChat = async () => {
    if (!contact) return;
    
    setIsCreatingChat(true);
    try {
      // 后端的 createDirectChat 是幂等的，会自动返回已存在的对话
      const chat = await chatStore.createDirectChat(contact.id);
      navigate(`/chat/${chat.id}`);
    } catch (error) {
      console.error('Failed to start chat:', error);
    } finally {
      setIsCreatingChat(false);
    }
  };

  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 text-lg">{t('contactNotFound') || '联系人不存在'}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
          >
            {t('backToHome') || '返回首页'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="h-[60px] bg-white border-b border-gray-200 px-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-semibold text-gray-800">{t('contactDetails') || '联系人详情'}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl shadow-sm p-8 mb-6">
            {/* Avatar and Basic Info */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4">
                <img
                    src={getAvatarUrl(contact.avatar)}
                  alt={contact.displayName || contact.username}
                  className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
                />
                {contact.isOnline && (
                  <div className="absolute bottom-2 right-2 w-6 h-6 bg-emerald-500 border-4 border-white rounded-full" />
                )}
              </div>
              
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                {contact.displayName || contact.username}
              </h2>
              <p className="text-gray-500 text-sm mb-1">@{contact.username}</p>
              <span className={`text-sm font-medium ${contact.isOnline ? 'text-emerald-600' : 'text-gray-400'}`}>
                {contact.isOnline ? t('online') : t('offline')}
              </span>
            </div>

            {/* Action Button */}
            <button
              onClick={handleStartChat}
              disabled={isCreatingChat}
              className="w-full py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              {isCreatingChat ? t('loading') : t('sendMessage')}
            </button>
          </div>

          {/* Details Card */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {t('details') || '详细信息'}
            </h3>
            
            <div className="space-y-4">
              {contact.email && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('email')}</p>
                    <p className="text-sm">{contact.email}</p>
                  </div>
                </div>
              )}

              {contact.role && (
                <div className="flex items-center gap-3 text-gray-600">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <span className="text-gray-400">👤</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('role')}</p>
                    <p className="text-sm">{contact.role}</p>
                  </div>
                </div>
              )}

              {contact.department && (
                <div className="flex items-center gap-3 text-gray-600">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <span className="text-gray-400">🏢</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('department')}</p>
                    <p className="text-sm">{contact.department}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 text-gray-600">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('joinedAt') || '加入时间'}</p>
                  <p className="text-sm">{formatDateTime(contact.createdAt)}</p>
                </div>
              </div>

              {contact.lastSeen && !contact.isOnline && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{t('lastSeen') || '最后在线'}</p>
                    <p className="text-sm">{formatDateTime(contact.lastSeen)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ContactDetailPage;
