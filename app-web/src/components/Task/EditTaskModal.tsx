import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { taskApi, projectApi, userApi, ApiProjectMember, ApiTask } from '../../api';
import { DEFAULT_AVATAR_URL } from '../../constants/avatar';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  task: ApiTask | null;
  onSuccess: () => void;
}

export default observer(function EditTaskModal({
  isOpen,
  onClose,
  projectId,
  task,
  onSuccess,
}: EditTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [status, setStatus] = useState<'todo' | 'in-progress' | 'done'>('todo');
  const [statusNote, setStatusNote] = useState('');
  const [progress, setProgress] = useState(0);
  const [assigneeId, setAssigneeId] = useState<number | undefined>();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [members, setMembers] = useState<(ApiProjectMember & { user?: any })[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('todo');
      setStatusNote('');
      setProgress(0);
      setAssigneeId(undefined);
      setStartDate('');
      setEndDate('');
    } else {
      // 加载项目成员列表
      loadMembers();
      
      // 填充任务数据
      if (task) {
        setTitle(task.title);
        setDescription(task.description || '');
        setPriority(task.priority);
        setStatus(task.status);
        setStatusNote('');
        setProgress(task.progress || 0);
        setAssigneeId(task.assignee_id);
        setStartDate(task.start_date || '');
        setEndDate(task.end_date || '');
      }
    }
  }, [isOpen, task]);

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
    
    if (!title.trim() || !task) {
      alert('任务信息不完整');
      return;
    }

    if (status !== task.status && !statusNote.trim()) {
      alert('修改任务状态时必须填写说明');
      return;
    }

    setIsLoading(true);
    try {
      await taskApi.updateTask(projectId, task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        statusNote: status !== task.status ? statusNote.trim() : undefined,
        progress,
        assigneeId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('更新任务失败:', error);
      alert(error.message || '更新任务失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">编辑任务</h2>
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
          {/* 任务标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              任务标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入任务标题..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {/* 任务描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              任务描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入任务描述..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 优先级和状态 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                优先级
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                状态
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="todo">待办</option>
                <option value="in-progress">进行中</option>
                <option value="done">已完成</option>
              </select>
            </div>
          </div>

          {task && status !== task.status && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                状态变更说明 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="请输入本次状态变更的说明..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          )}

          {/* 完成进度 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              完成进度: {progress}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress}
              onChange={(e) => setProgress(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          {/* 负责人 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              任务负责人
            </label>
            <select
              value={assigneeId || ''}
              onChange={(e) => setAssigneeId(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">未分配</option>
              {members.map((member) => (
                <option key={member.id} value={member.user_id}>
                  {member.user?.displayName || member.user?.username || `用户 ${member.user_id}`}
                </option>
              ))}
            </select>
          </div>

          {/* 时间范围 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                开始时间
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                结束时间
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
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
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isLoading ? '保存中...' : '保存修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
