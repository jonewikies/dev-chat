import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { bugApi, projectApi, userApi, ApiProjectMember } from '../../api';

interface CreateBugModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onSuccess: () => void;
}

export default observer(function CreateBugModal({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}: CreateBugModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [status, setStatus] = useState<'open' | 'in-progress' | 'fixed' | 'closed'>('open');
  const [assigneeId, setAssigneeId] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [members, setMembers] = useState<(ApiProjectMember & { user?: any })[]>([]);
  const [images, setImages] = useState<string[]>([]);  // Array of base64 image strings

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setSeverity('medium');
      setStatus('open');
      setAssigneeId(undefined);
      setImages([]);
    } else {
      loadMembers();
    }
  }, [isOpen]);

  const loadMembers = async () => {
    try {
      const membersList = await projectApi.getMembers(projectId);
      const membersWithUsers = await Promise.all(
        membersList.map(async (member) => {
          try {
            const user = await userApi.getUser(member.user_id);
            return {
              ...member,
              user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                avatar: user.avatar_url,
              },
            };
          } catch (error) {
            return member;
          }
        })
      );
      setMembers(membersWithUsers);
    } catch (error) {
      console.error('加载成员失败:', error);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      alert('请输入缺陷标题');
      return;
    }

    setIsLoading(true);
    try {
      await bugApi.create(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        severity,
        status,
        assigneeId,
        images: images.length > 0 ? JSON.stringify(images) : undefined,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('创建缺陷失败:', error);
      alert(error.message || '创建缺陷失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const getSeverityLabel = (sev: string) => {
    switch (sev) {
      case 'critical': return '紧急';
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return sev;
    }
  };

  const getStatusLabel = (st: string) => {
    switch (st) {
      case 'open': return '待处理';
      case 'in-progress': return '处理中';
      case 'fixed': return '已修复';
      case 'closed': return '已关闭';
      default: return st;
    }
  };

  const handleImageUpload = (e: any) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: any) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert(`文件 ${file.name} 不是图片格式`);
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert(`文件 ${file.name} 超过5MB限制`);
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImages((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">报告缺陷</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 缺陷标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              缺陷标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入缺陷标题..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          {/* 缺陷描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              缺陷描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="详细描述缺陷情况..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* 严重程度和状态 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                严重程度
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="low">{getSeverityLabel('low')}</option>
                <option value="medium">{getSeverityLabel('medium')}</option>
                <option value="high">{getSeverityLabel('high')}</option>
                <option value="critical">{getSeverityLabel('critical')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                状态
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="open">{getStatusLabel('open')}</option>
                <option value="in-progress">{getStatusLabel('in-progress')}</option>
                <option value="fixed">{getStatusLabel('fixed')}</option>
                <option value="closed">{getStatusLabel('closed')}</option>
              </select>
            </div>
          </div>

          {/* 指派给 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              指派给
            </label>
            <select
              value={assigneeId || ''}
              onChange={(e) => setAssigneeId(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">未指派</option>
              {members.map((member) => (
                <option key={member.id} value={member.user_id}>
                  {member.user?.displayName || member.user?.username || `用户 ${member.user_id}`}
                </option>
              ))}
            </select>
          </div>

          {/* 图片上传 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              图片附件（可选，最多10张）
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              disabled={images.length >= 10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {images.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image}
                      alt={`上传图片 ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              支持JPG、PNG、GIF等格式，单个文件最大5MB
            </p>
          </div>

          {/* 按钮 */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading || !title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isLoading ? '提交中...' : '报告缺陷'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
