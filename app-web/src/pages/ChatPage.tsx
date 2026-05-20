import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useChatStore } from '../hooks/useChatStore';
import { useMessageStore } from '../hooks/useMessageStore';

export default observer(function ChatPage() {
  const chatStore = useChatStore();
  const messageStore = useMessageStore();

  useEffect(() => {
    // 加载聊天列表
    chatStore.fetchChats();
  }, []);

  useEffect(() => {
    // 当选中聊天时，加载消息
    if (chatStore.activeChat) {
      messageStore.fetchMessages(chatStore.activeChat.id);
    }
  }, [chatStore.activeChat]);

  const handleSendMessage = async (content: string) => {
    if (chatStore.activeChat) {
      await messageStore.sendMessage(chatStore.activeChat.id, content);
    }
  };

  return (
    <div className="flex h-screen">
      {/* 聊天列表 */}
      <div className="w-80 border-r bg-white">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">聊天列表</h2>
        </div>
        <div className="overflow-y-auto">
          {chatStore.isLoading ? (
            <div className="p-4 text-center text-gray-500">加载中...</div>
          ) : (
            chatStore.allChats.map((chat) => (
              <div
                key={chat.id}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                  chatStore.activeChat?.id === chat.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => chatStore.setActiveChat(chat.id)}
              >
                <div className="font-semibold">{chat.name || `Chat ${chat.id}`}</div>
                <div className="text-sm text-gray-600 truncate">{chat.lastMessage}</div>
                {chat.unreadCount > 0 && (
                  <span className="inline-block mt-1 px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                    {chat.unreadCount}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 消息区域 */}
      <div className="flex-1 flex flex-col">
        {chatStore.activeChat ? (
          <>
            {/* 聊天头部 */}
            <div className="p-4 border-b bg-white">
              <h3 className="text-lg font-semibold">
                {chatStore.activeChat.name || `Chat ${chatStore.activeChat.id}`}
              </h3>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {messageStore.isLoading ? (
                <div className="text-center text-gray-500">加载消息中...</div>
              ) : (
                messageStore
                  .getMessagesByChatId(chatStore.activeChat.id)
                  .map((message) => (
                    <div key={message.id} className="mb-4">
                      <div className="bg-white p-3 rounded-lg shadow-sm">
                        <div className="text-sm text-gray-500 mb-1">
                          User {message.senderId}
                        </div>
                        <div>{message.content}</div>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* 输入框 */}
            <div className="p-4 border-t bg-white">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem('message') as HTMLInputElement;
                  if (input.value.trim()) {
                    handleSendMessage(input.value);
                    input.value = '';
                  }
                }}
              >
                <input
                  name="message"
                  type="text"
                  placeholder="输入消息..."
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            选择一个聊天开始对话
          </div>
        )}
      </div>
    </div>
  );
});
