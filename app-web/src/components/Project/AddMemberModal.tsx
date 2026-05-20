import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { projectApi, userApi } from '../../api';
import { getAvatarUrl } from '../../constants/avatar';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onSuccess: () => void;
  existingMemberIds: number[];
}

export default observer(function AddMemberModal({
  isOpen,
  onClose,
  projectId,
  onSuccess,
  existingMemberIds,
}: AddMemberModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<'member' | 'viewer'>('member');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [allResultsAreMembers, setAllResultsAreMembers] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUserId(null);
      setSelectedRole('member');
      setAllResultsAreMembers(false);
    }
  }, [isOpen]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setAllResultsAreMembers(false);
      return;
    }

    setIsSearching(true);
    try {
      const users = await userApi.searchUsers(searchQuery);
      // 过滤掉已经是项目成员的用户
      const filteredUsers = users.filter(user => !existingMemberIds.includes(user.id));
      setSearchResults(filteredUsers);
      // 如果搜索到了用户但过滤后为空，说明所有用户都已是成员
      setAllResultsAreMembers(users.length > 0 && filteredUsers.length === 0);
    } catch (error) {
      console.error('搜索用户失败:', error);
      alert('搜索失败，请重试');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddMember = async () => {
    if (!selectedUserId) {
      alert('请选择要添加的用户');
      return;
    }

    setIsLoading(true);
    try {
      await projectApi.addMember(projectId, selectedUserId, selectedRole);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('添加成员失败:', error);
      alert(error.message || '添加失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">添加项目成员</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 搜索用户 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              搜索用户
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="输入用户名或邮箱搜索..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 搜索结果 */}
          {isSearching ? (
            <div className="text-center py-4 text-gray-500">搜索中...</div>
          ) : searchResults.length > 0 ? (
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 ${
                    selectedUserId === user.id ? 'bg-emerald-50 border-l-4 border-emerald-500' : ''
                  }`}
                >
                  <img
                    src={getAvatarUrl(user.avatar_url)}
                    alt={user.display_name || user.username}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">
                      {user.display_name || user.username}
                    </div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                  {selectedUserId === user.id && (
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="text-center py-4 text-gray-500">
              {allResultsAreMembers ? '所有匹配的用户都已是项目成员' : '未找到用户'}
            </div>
          ) : null}

          {/* 选择角色 */}
          {selectedUserId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择角色
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="role"
                    value="member"
                    checked={selectedRole === 'member'}
                    onChange={(e) => setSelectedRole(e.target.value as 'member')}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <div>
                    <div className="font-medium text-sm text-gray-900">成员 (Member)</div>
                    <div className="text-xs text-gray-500">可以查看和编辑项目内容</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="role"
                    value="viewer"
                    checked={selectedRole === 'viewer'}
                    onChange={(e) => setSelectedRole(e.target.value as 'viewer')}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <div>
                    <div className="font-medium text-sm text-gray-900">查看者 (Viewer)</div>
                    <div className="text-xs text-gray-500">只能查看项目内容</div>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleAddMember}
            disabled={!selectedUserId || isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isLoading ? '添加中...' : '添加成员'}
          </button>
        </div>
      </div>
    </div>
  );
});
