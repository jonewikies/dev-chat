import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { ArrowLeft, Bot, CornerUpRight, Download, File as FileIcon, Forward, Paperclip, Send, Smile, MoreVertical, Trash2, UserPlus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLanguage } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { useChatStore, useMessageStore, useUserStore } from '../../hooks';
import { chatApi, messageApi, projectApi, type ApiChat, type ApiUser } from '../../api';
import { wsService } from '../../services/websocket';
import { DEFAULT_AVATAR_URL, getAvatarUrl, GROUP_CHAT_AVATAR_URL } from '../../constants/avatar';

const MENTION_PATTERN = /(?:^|\s)@([A-Za-z0-9_]*)$/;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getMentionQuery = (value: string, cursorPosition: number) => {
  const inputBeforeCursor = value.slice(0, cursorPosition);
  const match = inputBeforeCursor.match(MENTION_PATTERN);
  if (!match) {
    return null;
  }

  return {
    keyword: match[1] || '',
    start: cursorPosition - match[1].length - 1,
    end: cursorPosition,
  };
};

type ChatMentionMember = {
  id: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  role: 'admin' | 'member';
};

type SummaryRangePreset = 'all' | 'today' | 'today_morning' | 'today_afternoon' | 'custom';

type SummaryPreviewMessage = {
  id: number;
  senderId: number;
  content: string;
  type: 'text' | 'system' | 'ai_summary' | 'file';
  createdAt: Date;
};

const EMOJI_GROUPS = [
  {
    label: '常用',
    emojis: ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '😭', '😡', '👍'],
  },
  {
    label: '互动',
    emojis: ['👏', '🙏', '👀', '🔥', '💯', '🎉', '❤️', '💪', '🤝', '🙌', '👌', '✌️'],
  },
  {
    label: '办公',
    emojis: ['📌', '📣', '📅', '⏰', '✅', '❌', '⚠️', '🚀', '💡', '📝', '📎', '📊'],
  },
];

const getClipboardImageExtension = (mimeType: string) => {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
};

const toDateTimeLocalValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

function ChatAddMemberModal({
  isOpen,
  onClose,
  onSearch,
  onAdd,
  existingMemberIds,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => Promise<ApiUser[]>;
  onAdd: (userId: number) => Promise<void>;
  existingMemberIds: number[];
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setIsSearching(false);
      setIsSubmitting(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const keyword = query.trim();
    if (!keyword) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const users = await onSearch(keyword);
      setResults(users.filter((user) => !existingMemberIds.includes(user.id)));
    } catch (error: any) {
      alert(error.message || '搜索用户失败');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = async (userId: number) => {
    setIsSubmitting(userId);
    try {
      await onAdd(userId);
      setResults((current) => current.filter((user) => user.id !== userId));
    } catch (error: any) {
      alert(error.message || '添加成员失败');
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">添加群成员</h2>
            <p className="mt-1 text-sm text-gray-500">搜索用户并加入当前项目群聊。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="border-b border-gray-100 px-6 py-4">
          <div className="flex gap-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入用户名或邮箱搜索"
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-600 disabled:bg-gray-300"
            >
              {isSearching ? '搜索中...' : '搜索'}
            </button>
          </div>
        </form>

        <div className="max-h-[420px] overflow-y-auto px-6 py-4">
          {results.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">{query.trim() ? '暂无可添加用户' : '搜索后显示可添加成员'}</div>
          ) : (
            <div className="space-y-3">
              {results.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-gray-900">{user.display_name || user.username}</div>
                    <div className="truncate text-sm text-gray-500">{user.username}{user.email ? ` · ${user.email}` : ''}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(user.id)}
                    disabled={isSubmitting === user.id}
                    className="rounded-xl border border-emerald-200 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:border-gray-200 disabled:text-gray-400"
                  >
                    {isSubmitting === user.id ? '添加中...' : '添加'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectMembersDrawer({
  isOpen,
  onClose,
  chat,
  members,
  canManage,
  onAddMember,
}: {
  isOpen: boolean;
  onClose: () => void;
  chat: ApiChat;
  members: ChatMentionMember[];
  canManage: boolean;
  onAddMember: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-30 bg-black/20"
          />
          <motion.aside
            initial={{ x: '100%', opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.6 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="absolute inset-y-0 right-0 z-40 flex w-full max-w-[380px] flex-col border-l border-[#d8d5cf] bg-[#f8f5ef] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#e6e0d7] px-5 py-5">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7f7a70]">群组成员</div>
                <h3 className="mt-2 truncate text-xl font-semibold text-[#1f1e1a]">{chat.name || '项目管理群'}</h3>
                <p className="mt-1 text-sm text-[#6f6a62]">{members.length} 位成员，管理员已高亮标识</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-[#6f6a62] hover:bg-white hover:text-[#1f1e1a]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {canManage && (
              <div className="border-b border-[#e6e0d7] px-5 py-4">
                <button
                  type="button"
                  onClick={onAddMember}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <UserPlus className="h-4 w-4" />
                  添加成员
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 rounded-3xl border border-[#e8e1d8] bg-white/90 px-4 py-3 shadow-sm">
                    <img
                      src={getAvatarUrl(member.avatarUrl)}
                      alt={member.displayName || member.username}
                      className="h-12 w-12 rounded-full border border-[#ede6db] object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-medium text-[#1f1e1a]">{member.displayName || member.username}</div>
                        {member.role === 'admin' && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                            管理员
                          </span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-sm text-[#7a746b]">@{member.username}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function ImagePreviewLightbox({
  isOpen,
  imageUrl,
  fileName,
  onClose,
}: {
  isOpen: boolean;
  imageUrl: string | null;
  fileName?: string;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && imageUrl && (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
          >
            <div className="relative max-h-full max-w-6xl">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 z-10 rounded-full bg-black/55 p-2 text-white hover:bg-black/70"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={imageUrl}
                alt={fileName || '图片预览'}
                className="max-h-[88vh] max-w-[92vw] rounded-3xl object-contain shadow-2xl"
              />
              {fileName && (
                <div className="mt-3 text-center text-sm text-white/90">{fileName}</div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ChatAttachmentBubble({
  message,
  onDownload,
  onPreviewImage,
}: {
  message: {
    content: string;
    metadata?: {
      fileId?: number;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    };
  };
  onDownload: (fileId: number, fallbackName?: string) => Promise<void>;
  onPreviewImage: (fileId: number, fallbackName?: string) => Promise<void>;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);

  const fileId = message.metadata?.fileId;
  const fileName = message.metadata?.fileName || message.content;
  const mimeType = message.metadata?.mimeType || '';
  const isImage = mimeType.startsWith('image/');

  useEffect(() => {
    let revokedUrl: string | null = null;
    let cancelled = false;

    const loadThumbnail = async () => {
      if (!isImage || !fileId) {
        setThumbnailUrl(null);
        return;
      }

      setIsLoadingThumbnail(true);
      try {
        const { blob } = await messageApi.downloadAttachment(fileId);
        if (cancelled) return;
        revokedUrl = URL.createObjectURL(blob);
        setThumbnailUrl(revokedUrl);
      } catch {
        if (!cancelled) {
          setThumbnailUrl(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingThumbnail(false);
        }
      }
    };

    void loadThumbnail();

    return () => {
      cancelled = true;
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [fileId, isImage]);

  const formatFileSize = (value?: number) => {
    if (!value) return '未知大小';
    if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${value} B`;
  };

  if (isImage && fileId) {
    return (
      <div className="min-w-[240px] max-w-[320px]">
        <div className="group overflow-hidden rounded-2xl border border-black/5 bg-white/70 text-left hover:bg-white">
          <button
            type="button"
            onClick={() => void onPreviewImage(fileId, fileName)}
            className="block w-full text-left"
          >
          <div className="flex h-[220px] items-center justify-center bg-gray-100">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt={fileName} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-sm text-gray-500">
                <FileIcon className="h-8 w-8" />
                <span>{isLoadingThumbnail ? '加载图片中...' : '图片不可预览'}</span>
              </div>
            )}
          </div>
          </button>
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-gray-900">{fileName}</div>
              <div className="mt-1 text-xs text-gray-500">{formatFileSize(message.metadata?.fileSize)}</div>
            </div>
            <button
              type="button"
              onClick={() => void onDownload(fileId, fileName)}
              className="rounded-full bg-gray-100 p-2 text-gray-600 hover:bg-gray-200"
              aria-label={`下载 ${fileName}`}
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => fileId && void onDownload(fileId, fileName)}
      className="flex min-w-[240px] max-w-[320px] items-center gap-3 rounded-2xl border border-black/5 bg-white/60 px-3 py-3 text-left hover:bg-white"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
        <FileIcon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-900">{fileName}</div>
        <div className="mt-1 text-xs text-gray-500">{formatFileSize(message.metadata?.fileSize)}</div>
      </div>
      <div className="rounded-full bg-gray-100 p-2 text-gray-600">
        <Download className="h-4 w-4" />
      </div>
    </button>
  );
}

const ChatPage = observer(() => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const chatStore = useChatStore();
  const messageStore = useMessageStore();
  const userStore = useUserStore();

  const [messageInput, setMessageInput] = useState('');
  const [mentionQuery, setMentionQuery] = useState<{ keyword: string; start: number; end: number } | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [isInputComposing, setIsInputComposing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [chatDetail, setChatDetail] = useState<ApiChat | null>(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isMembersDrawerOpen, setIsMembersDrawerOpen] = useState(false);
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const [isEmojiPanelOpen, setIsEmojiPanelOpen] = useState(false);
  const [isCreatingAISummary, setIsCreatingAISummary] = useState(false);
  const [isAISummaryPanelOpen, setIsAISummaryPanelOpen] = useState(false);
  const [summaryRangePreset, setSummaryRangePreset] = useState<SummaryRangePreset>('all');
  const [summaryPreviewMessages, setSummaryPreviewMessages] = useState<SummaryPreviewMessage[]>([]);
  const [summaryPreviewLoading, setSummaryPreviewLoading] = useState(false);
  const [customSummaryStartTime, setCustomSummaryStartTime] = useState('');
  const [customSummaryEndTime, setCustomSummaryEndTime] = useState('');
  const [deletingMessageId, setDeletingMessageId] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<{ url: string; fileName?: string } | null>(null);
  const [quotedMessageId, setQuotedMessageId] = useState<number | null>(null);
  const [forwardingMessageId, setForwardingMessageId] = useState<number | null>(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardSearch, setForwardSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const chat = chatId ? chatStore.getChatById(parseInt(chatId)) : null;
  const messages = chatId ? messageStore.getMessagesByChatId(parseInt(chatId)) : [];

  // 获取对话中的对方用户（仅适用于私聊）
  const getOtherUser = () => {
    if (!chat || chat.type !== 'direct') return null;
    
    // 从消息列表中找到第一个不是当前用户的发送者
    if (messages.length > 0 && currentUser) {
      for (const message of messages) {
        if (message.senderId !== currentUser.id) {
          return userStore.getUserById(message.senderId);
        }
      }
    }
    
    // 如果没有消息，尝试从好友列表中查找
    // 这是一个临时解决方案，理想情况下应该从 chat_members 获取
    return null;
  };

  const otherUser = getOtherUser();
  const directContactId = chatDetail?.members?.find((member) => member.user_id !== currentUser?.id)?.user_id || null;
  const currentChatMember = chatDetail?.members?.find((member) => member.user_id === currentUser?.id) || null;
  const canManageGroupChat = (chat?.type === 'group' || chat?.type === 'project') && currentChatMember?.role === 'admin';
  const canCreateAISummary = chat?.type === 'project' && !!chat.projectId;
  const projectChatMembers = useMemo(() => {
    const members = chatDetail?.members || [];
    return members
      .map((member) => {
        const user = userStore.getUserById(member.user_id);
        if (!user && currentUser?.id !== member.user_id) {
          return {
            id: member.user_id,
            username: member.username || `用户 ${member.user_id}`,
            displayName: member.display_name || undefined,
            avatarUrl: member.avatar_url || undefined,
            role: member.role,
          };
        }

        return {
          id: member.user_id,
          username:
            member.username ||
            user?.username ||
            (currentUser?.id === member.user_id ? currentUser.username : `用户 ${member.user_id}`),
          displayName:
            member.display_name ||
            user?.displayName ||
            (currentUser?.id === member.user_id ? currentUser.display_name || currentUser.username : undefined),
          avatarUrl:
            member.avatar_url ||
            user?.avatar ||
            (currentUser?.id === member.user_id ? currentUser.avatar_url : undefined),
          role: member.role,
        };
      })
      .sort((left, right) => {
        if (left.role !== right.role) {
          return left.role === 'admin' ? -1 : 1;
        }
        return (left.displayName || left.username).localeCompare(right.displayName || right.username, 'zh-CN');
      });
  }, [chatDetail?.members, currentUser, userStore]);

  const mentionableMembers = useMemo(() => {
    if (chat?.type === 'direct') {
      return [] as ChatMentionMember[];
    }

    return projectChatMembers.filter((member) => member.id !== currentUser?.id);
  }, [chat?.type, currentUser?.id, projectChatMembers]);

  const mentionCandidates = useMemo(() => {
    if (!mentionQuery || mentionableMembers.length === 0) {
      return [] as typeof mentionableMembers;
    }

    const keyword = mentionQuery.keyword.trim().toLowerCase();
    return mentionableMembers.filter((member) => {
      if (!keyword) {
        return true;
      }

      return member.username.toLowerCase().includes(keyword)
        || (member.displayName || '').toLowerCase().includes(keyword);
    });
  }, [mentionQuery, mentionableMembers]);

  useEffect(() => {
    const memberIds = chatDetail?.members?.map((member) => member.user_id) || [];
    if (memberIds.length === 0) {
      return;
    }

    memberIds.forEach((memberId) => {
      if (memberId === currentUser?.id) {
        return;
      }

      if (!userStore.getUserById(memberId)) {
        userStore.fetchUser(memberId).catch((error) => {
          console.error(`[ChatPage] Failed to load member profile for user ${memberId}:`, error);
        });
      }
    });
  }, [chatDetail?.members, currentUser?.id, userStore]);

  const summaryMessages = useMemo<SummaryPreviewMessage[]>(() => {
    if (summaryPreviewMessages.length > 0) {
      return summaryPreviewMessages;
    }

    return messages.map((message) => ({
      id: message.id,
      senderId: message.senderId,
      content: message.content,
      type: message.type === 'file' ? 'file' : message.type,
      createdAt: message.createdAt,
    }));
  }, [messages, summaryPreviewMessages]);

  const filteredSummaryMessages = useMemo(() => {
    if (summaryRangePreset === 'all') {
      return summaryMessages;
    }

    if (summaryRangePreset === 'custom') {
      const customStart = customSummaryStartTime ? new Date(customSummaryStartTime) : null;
      const customEnd = customSummaryEndTime ? new Date(customSummaryEndTime) : null;

      if (!customStart || !customEnd || Number.isNaN(customStart.getTime()) || Number.isNaN(customEnd.getTime()) || customStart.getTime() > customEnd.getTime()) {
        return [] as SummaryPreviewMessage[];
      }

      return summaryMessages.filter((message) => {
        const timestamp = message.createdAt.getTime();
        return timestamp >= customStart.getTime() && timestamp <= customEnd.getTime();
      });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return summaryMessages.filter((message) => {
      const timestamp = message.createdAt.getTime();
      if (summaryRangePreset === 'today') {
        return timestamp >= startOfToday.getTime() && timestamp <= endOfToday.getTime();
      }

      if (summaryRangePreset === 'today_morning') {
        return timestamp >= startOfToday.getTime() && timestamp < noon.getTime();
      }

      return timestamp >= noon.getTime() && timestamp <= endOfToday.getTime();
    });
  }, [customSummaryEndTime, customSummaryStartTime, summaryMessages, summaryRangePreset]);

  const summaryStartMessage = filteredSummaryMessages[0] || null;
  const summaryEndMessage = filteredSummaryMessages[filteredSummaryMessages.length - 1] || null;

  useEffect(() => {
    setActiveMentionIndex(0);
  }, [mentionQuery?.keyword, mentionCandidates.length]);

  // 获取显示名称
  const getChatDisplayName = () => {
    if (!chat) return '';
    if (chat.type === 'direct' && otherUser) {
      return otherUser.displayName || otherUser.username;
    }
    return chat.name || t('chat');
  };

  // 获取头像
  const getChatAvatar = () => {
    if (!chat) return '';
    if (chat.type === 'direct' && otherUser) {
      return getAvatarUrl(otherUser.avatar);
    }
    if (chat.type === 'group') {
      return GROUP_CHAT_AVATAR_URL;
    }
    if (chat.avatar) {
      return getAvatarUrl(chat.avatar);
    }
    return DEFAULT_AVATAR_URL;
  };

  // 加载对话和消息
  useEffect(() => {
    if (!chatId) return;
    
    const loadChat = async () => {
      try {
        const id = parseInt(chatId);
        // 加载对话详情
        const detail = await chatStore.fetchChatDetail(id);
        setChatDetail(detail);
        // 加载消息列表
        await messageStore.fetchMessages(id);
        
        // 加入聊天室（WebSocket）
        wsService.joinChat(id);
        console.log(`[ChatPage] Joined chat room ${id}`);
      } catch (error) {
        console.error('Failed to load chat:', error);
      }
    };

    loadChat();
    
    // 离开时清理
    return () => {
      if (chatId) {
        const id = parseInt(chatId);
        wsService.leaveChat(id);
        console.log(`[ChatPage] Left chat room ${id}`);
      }
    };
  }, [chatId]);

  useEffect(() => {
    setIsMembersDrawerOpen(false);
    setIsChatMenuOpen(false);
    setIsEmojiPanelOpen(false);
    setIsAISummaryPanelOpen(false);
    setSummaryRangePreset('all');
    setSummaryPreviewMessages([]);
    setCustomSummaryStartTime('');
    setCustomSummaryEndTime('');
    setQuotedMessageId(null);
    setForwardingMessageId(null);
    setIsForwardModalOpen(false);
    setForwardSearch('');
  }, [chatId]);

  useEffect(() => {
    if (summaryRangePreset !== 'custom' || summaryMessages.length === 0) {
      return;
    }

    if (!customSummaryStartTime) {
      setCustomSummaryStartTime(toDateTimeLocalValue(summaryMessages[0].createdAt));
    }

    if (!customSummaryEndTime) {
      setCustomSummaryEndTime(toDateTimeLocalValue(summaryMessages[summaryMessages.length - 1].createdAt));
    }
  }, [customSummaryEndTime, customSummaryStartTime, summaryMessages, summaryRangePreset]);

  useEffect(() => {
    if (!isEmojiPanelOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (emojiPanelRef.current && !emojiPanelRef.current.contains(event.target as Node)) {
        setIsEmojiPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isEmojiPanelOpen]);

  useEffect(() => {
    const members = chatDetail?.members || [];
    if (members.length === 0) {
      return;
    }

    members.forEach((member) => {
      if (member.user_id !== currentUser?.id && !userStore.getUserById(member.user_id)) {
        void userStore.fetchUser(member.user_id).catch(() => undefined);
      }
    });
  }, [chatDetail?.members, currentUser?.id, userStore]);

  const refreshChatDetail = async (id: number) => {
    const detail = await chatStore.fetchChatDetail(id);
    setChatDetail(detail);
    return detail;
  };

  const handleAddChatMember = async (userId: number) => {
    if (!chatId) return;

    await chatApi.addMember(parseInt(chatId, 10), userId);
    await refreshChatDetail(parseInt(chatId, 10));
  };

  const handleOpenGroupInfo = () => {
    setIsChatMenuOpen(false);
    setIsMembersDrawerOpen(true);
  };

  const handleOpenAddMember = () => {
    setIsChatMenuOpen(false);
    setIsAddMemberModalOpen(true);
  };

  const handleContactInfo = () => {
    if (!directContactId) return;
    setIsChatMenuOpen(false);
    navigate(`/contact/${directContactId}`);
  };

  const handleLeaveGroup = async () => {
    if (!chatId || !window.confirm('确定退出该群组吗？退出后仅影响你自己，其他成员不受影响。')) {
      return;
    }

    try {
      await chatApi.leaveChat(parseInt(chatId, 10));
      chatStore.removeChat(parseInt(chatId, 10));
      setIsChatMenuOpen(false);
      setIsMembersDrawerOpen(false);
      navigate('/');
    } catch (error: any) {
      alert(error.message || '退出群组失败');
    }
  };

  const handleDeleteDirectChat = async () => {
    if (!chatId || !window.confirm('确定删除该聊天吗？删除后仅对你自己生效，对方不受影响。')) {
      return;
    }

    try {
      await chatApi.deleteDirectChat(parseInt(chatId, 10));
      chatStore.removeChat(parseInt(chatId, 10));
      setIsChatMenuOpen(false);
      navigate('/');
    } catch (error: any) {
      alert(error.message || '删除聊天失败');
    }
  };

  const formatSummaryMessageTime = (date: Date) => {
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMessageTimestamp = (date: Date) => {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSummaryMessageSenderName = (senderId: number) => {
    if (senderId === currentUser?.id) {
      return currentUser.display_name || currentUser.username;
    }

    const member = projectChatMembers.find((item) => item.id === senderId);
    return member?.displayName || member?.username || `用户 ${senderId}`;
  };

  const loadSummaryPreviewMessages = async () => {
    if (!chat) {
      return;
    }

    setSummaryPreviewLoading(true);
    try {
      const response = await messageApi.getMessages(chat.id, { limit: 500 });
      setSummaryPreviewMessages(
        response.messages
          .map((message) => ({
            id: message.id,
            senderId: message.sender_id,
            content: message.content,
            type: message.type === 'file' ? 'file' : message.type,
            createdAt: new Date(message.created_at),
          }))
          .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      );
    } catch (error: any) {
      alert(error.message || '加载总结范围失败');
    } finally {
      setSummaryPreviewLoading(false);
    }
  };

  const handleOpenAISummaryPanel = async () => {
    if (!chat || chat.type !== 'project' || !chat.projectId || isCreatingAISummary) {
      return;
    }

    setIsAISummaryPanelOpen(true);
    if (summaryPreviewMessages.length === 0) {
      await loadSummaryPreviewMessages();
    }
  };

  const handleSelectSummaryPreset = (preset: SummaryRangePreset) => {
    setSummaryRangePreset(preset);

    if (preset === 'custom' && summaryMessages.length > 0) {
      if (!customSummaryStartTime) {
        setCustomSummaryStartTime(toDateTimeLocalValue(summaryMessages[0].createdAt));
      }
      if (!customSummaryEndTime) {
        setCustomSummaryEndTime(toDateTimeLocalValue(summaryMessages[summaryMessages.length - 1].createdAt));
      }
    }
  };

  const handleCreateAISummary = async () => {
    if (!chat || chat.type !== 'project' || !chat.projectId || isCreatingAISummary) {
      return;
    }

    if (filteredSummaryMessages.length === 0) {
      alert('当前时间范围内没有可总结的聊天记录');
      return;
    }

    setIsCreatingAISummary(true);
    try {
      const requestData = {
        chatId: chat.id,
        ...(summaryRangePreset === 'all'
          ? {}
          : {
              startMessageId: summaryStartMessage?.id,
              endMessageId: summaryEndMessage?.id,
              startTime: summaryStartMessage?.createdAt.toISOString(),
              endTime: summaryEndMessage?.createdAt.toISOString(),
            }),
      };
      const result = await projectApi.createAISummary(chat.projectId, {
        ...requestData,
      });
      await messageStore.fetchMessages(chat.id);
      setIsAISummaryPanelOpen(false);
      alert(`AI 总结已生成，沟通纪要草稿“${result.archiveDocumentTitle || '未命名纪要'}”待 keep，待确认内容 ${result.proposalCount} 条。`);
      navigate(`/project/${chat.projectId}/ai`);
    } catch (error: any) {
      alert(error.message || 'AI 总结生成失败');
    } finally {
      setIsCreatingAISummary(false);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (deletingMessageId === messageId) {
      return;
    }

    if (!window.confirm('确定删除这条聊天记录吗？删除后不可恢复。')) {
      return;
    }

    setDeletingMessageId(messageId);
    try {
      await messageStore.deleteMessage(messageId);
    } catch (error: any) {
      alert(error.message || '删除聊天记录失败');
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessageInput((current) => `${current}${emoji}`);
      setIsEmojiPanelOpen(false);
      return;
    }

    const start = textarea.selectionStart ?? messageInput.length;
    const end = textarea.selectionEnd ?? messageInput.length;
    const nextValue = `${messageInput.slice(0, start)}${emoji}${messageInput.slice(end)}`;
    setMessageInput(nextValue);
    setIsEmojiPanelOpen(false);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + emoji.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const updateMentionQueryState = (value: string, cursorPosition?: number | null) => {
    if (chat?.type === 'direct') {
      setMentionQuery(null);
      return;
    }

    const resolvedCursor = cursorPosition ?? value.length;
    setMentionQuery(getMentionQuery(value, resolvedCursor));
  };

  const buildMentionMetadata = () => {
    if (mentionableMembers.length === 0) {
      return undefined;
    }

    const mentionMap = new Map<string, ChatMentionMember>(mentionableMembers.map((member) => [member.username.toLowerCase(), member]));
    const seenUserIds = new Set<number>();
    const mentions: Array<{ userId: number; username: string; displayName?: string }> = [];

    for (const match of messageInput.matchAll(/(^|\s)@([A-Za-z0-9_]+)/g)) {
      const username = match[2]?.toLowerCase();
      if (!username) {
        continue;
      }

      const member = mentionMap.get(username);
      if (!member || seenUserIds.has(member.id)) {
        continue;
      }

      seenUserIds.add(member.id);
      mentions.push({
        userId: member.id,
        username: member.username,
        displayName: member.displayName || member.username,
      });
    }

    return mentions.length > 0 ? { mentions } : undefined;
  };

  const handleSelectMention = (member: ChatMentionMember) => {
    if (!mentionQuery) {
      return;
    }

    const nextValue = `${messageInput.slice(0, mentionQuery.start)}@${member.username} ${messageInput.slice(mentionQuery.end)}`;
    setMessageInput(nextValue);
    setMentionQuery(null);

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      const cursorPosition = mentionQuery.start + member.username.length + 2;
      textarea.focus();
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const getMessageSenderSummary = (senderId: number) => {
    if (senderId === currentUser?.id) {
      return {
        username: currentUser.username,
        displayName: currentUser.display_name || currentUser.username,
        avatarUrl: currentUser.avatar_url,
      };
    }

    const user = userStore.getUserById(senderId);
    const member = projectChatMembers.find((item) => item.id === senderId);
    return {
      username: user?.username || member?.username || `用户 ${senderId}`,
      displayName: user?.displayName || member?.displayName || user?.username || member?.username || `用户 ${senderId}`,
      avatarUrl: user?.avatar || member?.avatarUrl,
    };
  };

  const getMessagePreview = (message: { type: string; content: string; metadata?: any }) => {
    const rawText = message.type === 'file'
      ? `[附件] ${message.metadata?.fileName || message.content || '未命名附件'}`
      : message.content || '';

    return rawText.replace(/\s+/g, ' ').trim().slice(0, 120) || '暂无内容';
  };

  const handleQuoteMessage = (messageId: number) => {
    setQuotedMessageId(messageId);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleOpenForwardModal = async (messageId: number) => {
    setForwardingMessageId(messageId);
    setForwardSearch('');
    setIsForwardModalOpen(true);

    try {
      await chatStore.fetchChats();
    } catch (error) {
      console.error('Failed to load chats for forwarding:', error);
    }
  };

  const handleCloseForwardModal = () => {
    setIsForwardModalOpen(false);
    setForwardingMessageId(null);
    setForwardSearch('');
  };

  const handleForwardMessage = async (targetChatId: number) => {
    if (!forwardingMessageId) {
      return;
    }

    setIsForwarding(true);
    try {
      await messageStore.forwardMessage(forwardingMessageId, targetChatId);
      await chatStore.fetchChats();
      handleCloseForwardModal();
    } catch (error: any) {
      alert(error.message || '转发失败，请重试');
    } finally {
      setIsForwarding(false);
    }
  };

  const renderMessageText = (message: (typeof messages)[number], isMe: boolean) => {
    const mentions = Array.isArray(message.metadata?.mentions) ? message.metadata.mentions : [];
    if (mentions.length === 0) {
      return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
    }

    const mentionUsernames = mentions.map((mention) => mention.username).filter(Boolean);
    if (mentionUsernames.length === 0) {
      return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
    }

    const mentionRegex = new RegExp(`(@(?:${mentionUsernames.map((username) => escapeRegExp(username)).join('|')}))`, 'g');
    const parts = message.content.split(mentionRegex);

    return (
      <p className="whitespace-pre-wrap break-words">
        {parts.map((part, index) => {
          const mention = mentions.find((item) => `@${item.username}` === part);
          if (!mention) {
            return <React.Fragment key={`${message.id}-part-${index}`}>{part}</React.Fragment>;
          }

          const isMentioningCurrentUser = mention.userId === currentUser?.id;
          return (
            <span
              key={`${message.id}-mention-${mention.userId}-${index}`}
              title={mention.displayName || mention.username}
              className={`mx-[1px] inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-semibold leading-5 shadow-sm ${
                isMentioningCurrentUser
                  ? isMe
                    ? 'border border-emerald-300 bg-emerald-100 text-emerald-950'
                    : 'border border-cyan-300 bg-cyan-100 text-cyan-900'
                  : isMe
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border border-slate-200 bg-slate-100 text-slate-700'
              }`}
            >
              {part}
            </span>
          );
        })}
      </p>
    );
  };

  const formatFileSize = (value?: number) => {
    if (!value) return '未知大小';
    if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${value} B`;
  };

  const handleAttachmentClick = () => {
    attachmentInputRef.current?.click();
  };

  const uploadAttachmentFile = async (file: File) => {
    if (!chatId) {
      return;
    }

    setIsUploadingAttachment(true);
    try {
      await messageStore.uploadAttachment(parseInt(chatId, 10), file);
    } catch (error) {
      console.error('Failed to upload attachment:', error);
      alert('附件上传失败，请重试');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleAttachmentSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await uploadAttachmentFile(file);
    event.target.value = '';
  };

  const handleInputPaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!chatId || isUploadingAttachment) {
      return;
    }

    const items = Array.from(event.clipboardData.items || []);
    const imageItem = items.find((item: any) => item.kind === 'file' && item.type.startsWith('image/')) as any;
    if (!imageItem) {
      return;
    }

    const pastedFile = imageItem.getAsFile();
    if (!pastedFile) {
      return;
    }

    event.preventDefault();

    const extension = getClipboardImageExtension(pastedFile.type);
    const fileName = pastedFile.name && pastedFile.name.trim()
      ? pastedFile.name
      : `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;

    const uploadFile = new File([pastedFile], fileName, {
      type: pastedFile.type || 'image/png',
      lastModified: Date.now(),
    });

    await uploadAttachmentFile(uploadFile);
  };

  const handleDownloadAttachment = async (fileId: number, fallbackName?: string) => {
    try {
      const { blob, fileName } = await messageApi.downloadAttachment(fileId);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName || fallbackName || 'attachment';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error: any) {
      alert(error.message || '附件下载失败');
    }
  };

  const handlePreviewAttachmentImage = async (fileId: number, fallbackName?: string) => {
    try {
      const { blob, fileName } = await messageApi.downloadAttachment(fileId);
      const objectUrl = URL.createObjectURL(blob);
      setImagePreview((current) => {
        if (current?.url) {
          URL.revokeObjectURL(current.url);
        }
        return {
          url: objectUrl,
          fileName: fileName || fallbackName,
        };
      });
    } catch (error: any) {
      alert(error.message || '图片预览失败');
    }
  };

  const closeImagePreview = () => {
    setImagePreview((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  };

  useEffect(() => {
    return () => {
      if (imagePreview?.url) {
        URL.revokeObjectURL(imagePreview.url);
      }
    };
  }, [imagePreview?.url]);

  // 监听实时消息
  useEffect(() => {
    const handleNewMessage = (data: { message: any; senderUsername: string }) => {
      console.log('[ChatPage] Received new message:', data);
      if (data.message.chat_id === parseInt(chatId || '0')) {
        messageStore.addMessage(data.message);
        // 不在这里立即标记已读，让下面的useEffect处理
      }
    };

    wsService.onNewMessage(handleNewMessage);

    return () => {
      wsService.offNewMessage(handleNewMessage);
    };
  }, [chatId, messageStore]);

  // 当页面可见且有消息时，标记已读
  useEffect(() => {
    if (!chatId || messages.length === 0) return;
    
    // 检查页面是否可见
    const isPageVisible = !document.hidden;
    
    if (isPageVisible) {
      const id = parseInt(chatId);
      // 延迟标记已读，确保用户真正看到了消息
      const timer = setTimeout(() => {
        chatStore.markAsRead(id);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [chatId, messages.length, chatStore]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !chatId || isSending) return;

    setIsSending(true);
    try {
      // 通过 HTTP API 发送消息并保存到数据库
      // WebSocket 会将消息广播给其他在线用户
      await messageStore.sendMessage(parseInt(chatId), messageInput.trim(), 'text', buildMentionMetadata(), quotedMessageId || undefined);
      setMessageInput('');
      setMentionQuery(null);
      setQuotedMessageId(null);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isInputComposing || e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }

    if (mentionCandidates.length > 0 && mentionQuery) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveMentionIndex((current) => (current + 1) % mentionCandidates.length);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveMentionIndex((current) => (current - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSelectMention(mentionCandidates[activeMentionIndex] || mentionCandidates[0]);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 text-lg">{t('chatNotFound') || '对话不存在'}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
          >
            {t('backToHome')}
          </button>
        </div>
      </div>
    );
  }

  const quotedMessage = quotedMessageId ? messageStore.getMessageById(quotedMessageId) : null;
  const forwardingMessage = forwardingMessageId ? messageStore.getMessageById(forwardingMessageId) : null;
  const forwardableChats = chatStore.allChats;
  const filteredForwardChats = forwardableChats.filter((item) => {
    const keyword = forwardSearch.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return (item.name || `聊天 ${item.id}`).toLowerCase().includes(keyword);
  });

  return (
    <div className="relative flex-1 overflow-hidden bg-[#EFEAE2]">
      <div className="flex h-full flex-col">
      {/* Header */}
      <div className="h-[60px] bg-[#F0F2F5] border-b border-[#D1D7DB] px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors lg:hidden"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <img
            src={getChatAvatar()}
            alt={getChatDisplayName()}
            className="w-10 h-10 rounded-full"
          />
          <button
            type="button"
            onClick={() => {
              if (chat.type !== 'direct') {
                setIsMembersDrawerOpen(true);
              }
            }}
            className={`min-w-0 text-left ${chat.type !== 'direct' ? 'rounded-2xl px-2 py-1 transition-colors hover:bg-white/70' : ''}`}
          >
            <h2 className="truncate font-semibold text-[17px]">{getChatDisplayName()}</h2>
            {chat.type === 'direct' && otherUser && (
              <p className="text-xs text-gray-500">
                {otherUser.isOnline ? t('online') : t('offline')}
              </p>
            )}
            {chat.type === 'group' && (
              <p className="text-xs text-gray-500">{t('groupChat')}，点击查看群组信息</p>
            )}
            {chat.type === 'project' && (
              <p className="text-xs text-gray-500">项目管理群，点击查看成员</p>
            )}
          </button>
        </div>
        <div className="relative flex items-center gap-2">
          {canCreateAISummary && (
            <button
              type="button"
              onClick={() => void handleOpenAISummaryPanel()}
              disabled={isCreatingAISummary}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Bot className="h-4 w-4" />
              {isCreatingAISummary ? 'AI 总结中...' : 'AI 总结对话'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsChatMenuOpen((open) => !open)}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>
          <AnimatePresence>
            {isChatMenuOpen && (
              <>
                <motion.button
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsChatMenuOpen(false)}
                  className="fixed inset-0 z-10"
                />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  className="absolute right-0 top-12 z-20 w-52 rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl"
                >
                  {(chat.type === 'group' || chat.type === 'project') && (
                    <>
                      {canManageGroupChat && (
                        <button
                          type="button"
                          onClick={handleOpenAddMember}
                          className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                          添加成员
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleOpenGroupInfo}
                        className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        群组信息
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleLeaveGroup()}
                        className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        退出群组
                      </button>
                    </>
                  )}
                  {chat.type === 'direct' && (
                    <>
                      <button
                        type="button"
                        onClick={handleContactInfo}
                        className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        联系人信息
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteDirectChat()}
                        className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        删除聊天
                      </button>
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {isAISummaryPanelOpen && canCreateAISummary && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAISummaryPanelOpen(false)}
              className="fixed inset-0 z-40 bg-black/30"
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              className="fixed inset-x-4 top-20 z-50 mx-auto w-full max-w-3xl rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
                <div>
                  <div className="text-sm font-medium text-emerald-600">AI 总结范围</div>
                  <h3 className="mt-1 text-xl font-semibold text-gray-900">选择本次要总结的群聊内容</h3>
                  <p className="mt-2 text-sm text-gray-500">默认总结全部聊天内容，也可以快捷切到今日、今日上午或今日下午，并预览本次范围的起止聊天记录。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAISummaryPanelOpen(false)}
                  className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 px-6 py-5">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'all', label: '全部' },
                    { key: 'today', label: '今日' },
                    { key: 'today_morning', label: '今日上午' },
                    { key: 'today_afternoon', label: '今日下午' },
                    { key: 'custom', label: '自定义范围' },
                  ].map((item) => {
                    const isActive = summaryRangePreset === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleSelectSummaryPreset(item.key as SummaryRangePreset)}
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          isActive
                            ? 'bg-emerald-600 text-white'
                            : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {summaryRangePreset === 'custom' ? (
                  <div className="grid gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 md:grid-cols-2">
                    <label className="block text-sm text-gray-700">
                      <span className="mb-2 block font-medium text-gray-900">开始时间</span>
                      <input
                        type="datetime-local"
                        value={customSummaryStartTime}
                        onChange={(event) => setCustomSummaryStartTime(event.target.value)}
                        className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-500"
                      />
                    </label>
                    <label className="block text-sm text-gray-700">
                      <span className="mb-2 block font-medium text-gray-900">结束时间</span>
                      <input
                        type="datetime-local"
                        value={customSummaryEndTime}
                        onChange={(event) => setCustomSummaryEndTime(event.target.value)}
                        className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-500"
                      />
                    </label>
                    {customSummaryStartTime && customSummaryEndTime && new Date(customSummaryStartTime).getTime() > new Date(customSummaryEndTime).getTime() ? (
                      <div className="md:col-span-2 text-sm text-rose-600">开始时间不能晚于结束时间。</div>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  {summaryPreviewLoading
                    ? '正在加载聊天记录范围...'
                    : filteredSummaryMessages.length > 0
                      ? `当前范围共 ${filteredSummaryMessages.length} 条消息，起止记录如下。`
                      : '当前快捷范围内没有聊天记录。'}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">开始记录</div>
                    {summaryStartMessage ? (
                      <>
                        <div className="mt-2 text-sm font-medium text-gray-900">
                          {getSummaryMessageSenderName(summaryStartMessage.senderId)} · {formatSummaryMessageTime(summaryStartMessage.createdAt)}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-gray-600">{summaryStartMessage.content || '无文本内容'}</div>
                      </>
                    ) : (
                      <div className="mt-2 text-sm text-gray-400">暂无开始记录</div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">结束记录</div>
                    {summaryEndMessage ? (
                      <>
                        <div className="mt-2 text-sm font-medium text-gray-900">
                          {getSummaryMessageSenderName(summaryEndMessage.senderId)} · {formatSummaryMessageTime(summaryEndMessage.createdAt)}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-gray-600">{summaryEndMessage.content || '无文本内容'}</div>
                      </>
                    ) : (
                      <div className="mt-2 text-sm text-gray-400">暂无结束记录</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-5">
                <div className="text-sm text-gray-500">总结完成后会生成一份待 keep 的沟通纪要草稿，并进入项目 AI 管理页。</div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAISummaryPanelOpen(false)}
                    className="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCreateAISummary()}
                    disabled={isCreatingAISummary || summaryPreviewLoading || filteredSummaryMessages.length === 0}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingAISummary ? 'AI 总结中...' : '开始总结'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isForwardModalOpen && forwardingMessage ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseForwardModal}
              className="fixed inset-0 z-40 bg-black/30"
            />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              className="fixed inset-x-4 top-24 z-50 mx-auto w-full max-w-xl rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
                <div>
                  <div className="text-sm font-medium text-emerald-600">转发消息</div>
                  <h3 className="mt-1 text-xl font-semibold text-gray-900">选择转发到的聊天</h3>
                  <p className="mt-2 text-sm text-gray-500">{getMessagePreview(forwardingMessage)}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseForwardModal}
                  className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="border-b border-gray-100 px-6 py-4">
                <input
                  value={forwardSearch}
                  onChange={(event) => setForwardSearch(event.target.value)}
                  placeholder="搜索聊天名称"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="max-h-[420px] overflow-y-auto px-4 py-4">
                {filteredForwardChats.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-500">没有可转发的聊天</div>
                ) : (
                  <div className="space-y-3">
                    {filteredForwardChats.map((targetChat) => (
                      <button
                        key={targetChat.id}
                        type="button"
                        onClick={() => void handleForwardMessage(targetChat.id)}
                        disabled={isForwarding}
                        className="flex w-full items-center justify-between rounded-2xl border border-gray-100 px-4 py-3 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-gray-900">{targetChat.name || `聊天 ${targetChat.id}`}</div>
                          <div className="mt-1 truncate text-sm text-gray-500">
                            {targetChat.type === 'project' ? '项目群' : targetChat.type === 'group' ? '群聊' : '私聊'}
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          {isForwarding ? '转发中...' : '转发'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">{t('noMessages') || '暂无消息'}</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMe = message.senderId === currentUser?.id;
            const sender = getMessageSenderSummary(message.senderId);
            const mentions = Array.isArray(message.metadata?.mentions) ? message.metadata.mentions : [];
            const mentionsCurrentUser = mentions.some((mention) => mention.userId === currentUser?.id);
            const repliedMessage = message.replyToMessageId ? messageStore.getMessageById(message.replyToMessageId) : null;
            const forwardedFrom = message.metadata?.forwardedFrom;
            
            return (
              <div
                key={message.id}
                className={`group flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}
              >
                <div className={`flex gap-2 max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <img
                    src={getAvatarUrl(sender.avatarUrl)}
                    alt={sender.username || 'User'}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                  <div>
                    <p className={`text-xs text-gray-500 mb-1 px-2 ${isMe ? 'text-right' : 'text-left'}`}>
                      {sender.displayName}
                    </p>
                    <div className={`flex items-start gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <button
                        type="button"
                        onClick={() => void handleOpenForwardModal(message.id)}
                        className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-500 opacity-0 transition hover:bg-sky-50 hover:text-sky-600 group-hover:opacity-100"
                        title="转发消息"
                      >
                        <Forward className="h-4 w-4" />
                      </button>
                      {isMe ? (
                        <button
                          type="button"
                          onClick={() => void handleDeleteMessage(message.id)}
                          disabled={deletingMessageId === message.id}
                          className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-100"
                          title="删除这条消息"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                      <div
                        onDoubleClick={() => handleQuoteMessage(message.id)}
                        className={`px-4 py-2 rounded-lg ${
                          isMe
                            ? mentionsCurrentUser
                              ? 'border border-emerald-300 bg-emerald-100 text-gray-900 shadow-sm'
                              : 'bg-[#D9FDD3] text-gray-800'
                            : mentionsCurrentUser
                              ? 'border border-cyan-300 bg-cyan-50 text-gray-900 shadow-sm'
                            : 'bg-white text-gray-800 shadow-sm'
                        }`}
                        title="双击引用这条消息"
                      >
                        {forwardedFrom ? (
                          <div className="mb-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                            已转发 · 来自 {forwardedFrom.senderName || `用户 ${forwardedFrom.senderId || ''}`}
                          </div>
                        ) : null}
                        {message.replyToMessageId ? (
                          <div className="mb-2 rounded-xl border border-gray-200 bg-black/5 px-3 py-2 text-xs text-gray-600">
                            <div className="font-medium text-gray-800">
                              {repliedMessage ? getMessageSenderSummary(repliedMessage.senderId).displayName : `引用消息 #${message.replyToMessageId}`}
                            </div>
                            <div className="mt-1 line-clamp-2">
                              {repliedMessage ? getMessagePreview(repliedMessage) : '原消息暂不可见'}
                            </div>
                          </div>
                        ) : null}
                        {mentions.length > 0 ? (
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            {mentions.map((mention) => {
                              const isMentioningCurrentUser = mention.userId === currentUser?.id;
                              return (
                                <span
                                  key={`${message.id}-mention-badge-${mention.userId}`}
                                  className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
                                    isMentioningCurrentUser
                                      ? isMe
                                        ? 'bg-emerald-200 text-emerald-950'
                                        : 'bg-cyan-200 text-cyan-950'
                                      : isMe
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  提及 @{mention.username}
                                </span>
                              );
                            })}
                          </div>
                        ) : null}
                        {message.type === 'file' ? (
                          <ChatAttachmentBubble
                            message={message}
                            onDownload={handleDownloadAttachment}
                            onPreviewImage={handlePreviewAttachmentImage}
                          />
                        ) : message.type === 'ai_summary' ? (
                          <div className="min-w-[260px] rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-800">
                              <Bot className="h-4 w-4" />
                              AI 总结
                            </div>
                            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-cyan-900">{message.content}</p>
                            {chat.projectId ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/project/${chat.projectId}/ai`)}
                                className="mt-3 rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs text-cyan-700 hover:bg-cyan-50"
                              >
                                查看 AI 管理
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          renderMessageText(message, isMe)
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {formatMessageTimestamp(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-[#F0F2F5] px-4 py-3 border-t border-[#D1D7DB]">
        {quotedMessage ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                <CornerUpRight className="h-4 w-4" />
                引用 {getMessageSenderSummary(quotedMessage.senderId).displayName}
              </div>
              <div className="mt-1 line-clamp-2 text-sm text-emerald-900">{getMessagePreview(quotedMessage)}</div>
            </div>
            <button
              type="button"
              onClick={() => setQuotedMessageId(null)}
              className="rounded-full p-1 text-emerald-700 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <div className="relative" ref={emojiPanelRef}>
            <button
              type="button"
              onClick={() => setIsEmojiPanelOpen((open) => !open)}
              className={`p-2 mb-1 rounded-full transition-colors ${isEmojiPanelOpen ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-gray-200 text-gray-600'}`}
            >
              <Smile className="w-6 h-6" />
            </button>

            <AnimatePresence>
              {isEmojiPanelOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.96 }}
                  className="absolute bottom-14 left-0 z-30 w-[320px] rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl"
                >
                  <div className="mb-3 text-sm font-semibold text-gray-900">选择表情</div>
                  <div className="space-y-4">
                    {EMOJI_GROUPS.map((group) => (
                      <div key={group.label}>
                        <div className="mb-2 text-xs font-medium text-gray-500">{group.label}</div>
                        <div className="grid grid-cols-6 gap-2">
                          {group.emojis.map((emoji) => (
                            <button
                              key={`${group.label}-${emoji}`}
                              type="button"
                              onClick={() => handleSelectEmoji(emoji)}
                              className="flex h-11 w-11 items-center justify-center rounded-2xl text-2xl transition-colors hover:bg-gray-100"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <input
            ref={attachmentInputRef}
            type="file"
            className="hidden"
            onChange={handleAttachmentSelected}
          />
          <button
            type="button"
            onClick={handleAttachmentClick}
            disabled={isUploadingAttachment}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors mb-1 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            <Paperclip className="w-6 h-6 text-gray-600" />
          </button>
          <div className="relative flex-1 bg-white rounded-lg border border-gray-300 flex items-center">
            <textarea
              ref={textareaRef}
              value={messageInput}
              onChange={(e) => {
                setMessageInput(e.target.value);
                updateMentionQueryState(e.target.value, e.target.selectionStart);
              }}
              onClick={(event) => updateMentionQueryState(event.currentTarget.value, event.currentTarget.selectionStart)}
              onKeyUp={(event) => updateMentionQueryState(event.currentTarget.value, event.currentTarget.selectionStart)}
              onPaste={(event) => void handleInputPaste(event)}
              onCompositionStart={() => setIsInputComposing(true)}
              onCompositionEnd={(event) => {
                setIsInputComposing(false);
                updateMentionQueryState(event.currentTarget.value, event.currentTarget.selectionStart);
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('typeMessage')}
              className="flex-1 px-4 py-2 resize-none outline-none bg-transparent max-h-32"
              rows={1}
            />
            {mentionQuery && mentionCandidates.length > 0 ? (
              <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-30 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                <div className="border-b border-gray-100 px-3 py-2 text-xs font-medium text-gray-500">
                  选择要 @ 的群成员
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {mentionCandidates.map((member, index) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleSelectMention(member)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left ${index === activeMentionIndex ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                    >
                      <img
                        src={getAvatarUrl(member.avatarUrl)}
                        alt={member.displayName || member.username}
                        className="h-9 w-9 rounded-full border border-[#ede6db] object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-gray-900">{member.displayName || member.username}</div>
                        <div className="truncate text-xs text-gray-500">@{member.username}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || isSending || isUploadingAttachment}
            className="p-3 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors mb-1"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {isUploadingAttachment && (
          <div className="mt-2 text-xs text-gray-500">附件上传中...</div>
        )}
      </div>
      </div>

      {chat.type !== 'direct' && chatDetail && (
        <ProjectMembersDrawer
          isOpen={isMembersDrawerOpen}
          onClose={() => setIsMembersDrawerOpen(false)}
          chat={chatDetail}
          members={projectChatMembers}
          canManage={!!canManageGroupChat}
          onAddMember={() => setIsAddMemberModalOpen(true)}
        />
      )}

      <ChatAddMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        onSearch={(query) => userStore.searchUsers(query)}
        onAdd={handleAddChatMember}
        existingMemberIds={chatDetail?.members?.map((member) => member.user_id) || []}
      />

      <ImagePreviewLightbox
        isOpen={!!imagePreview}
        imageUrl={imagePreview?.url || null}
        fileName={imagePreview?.fileName}
        onClose={closeImagePreview}
      />
    </div>
  );
});

export default ChatPage;
