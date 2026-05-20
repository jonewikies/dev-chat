import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../i18n';
import { useProjectStore, useUserStore } from '../hooks';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarUrl } from '../constants/avatar';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectModal({ isOpen, onClose }: ProjectModalProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const projectStore = useProjectStore();
  const userStore = useUserStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [content, setContent] = useState('');
  const [milestone, setMilestone] = useState('');
  const [managerId, setManagerId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      userStore.getFriends().catch(console.error);
    }
  }, [isOpen, userStore]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-md p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-emerald-600 px-8 py-6 flex justify-between items-center text-white">
          <div>
            <h3 className="font-bold text-2xl tracking-tight">{t('initializeNewProject')}</h3>
            <p className="text-emerald-100 text-sm opacity-80">{t('defineCoreParameters')}</p>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Left Column: Basic Info */}
            <div className="space-y-6">
              <div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">{t('projectName')}</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('projectNamePlaceholder')}
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 focus:bg-white transition-all font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">{t('creator') || '项目创建人'}</label>
                      <div className="w-full bg-gray-100 border-2 border-gray-100 rounded-2xl px-3 py-3 font-medium text-gray-600 flex items-center gap-2">
                        <img 
                          src={getAvatarUrl(user?.avatar_url)} 
                          alt={user?.display_name || user?.username} 
                          className="w-6 h-6 rounded-full"
                        />
                        <span className="truncate">{user?.display_name || user?.username}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">{t('manager') || '项目负责人'}</label>
                      <select 
                        value={managerId}
                        onChange={(e) => setManagerId(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-3 py-3 outline-none focus:border-emerald-500 focus:bg-white transition-all font-medium"
                      >
                        <option value="">自己 (You)</option>
                        {userStore.friends.map(friend => (
                          <option key={friend.id} value={friend.id}>
                            {friend.displayName || friend.username}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">{t('primaryObjective')}</label>
                    <input 
                      type="text" 
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      placeholder={t('goalPlaceholder')}
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 focus:bg-white transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">{t('timelinePlan')}</label>
                    <div className="grid grid-cols-2 gap-3">
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 focus:bg-white transition-all font-medium"
                      />
                      <input 
                        type="date" 
                        value={endDate}
                        min={startDate || undefined}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 focus:bg-white transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">{t('shortDescription')}</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 focus:bg-white transition-all text-sm"
                />
              </div>
            </div>

            {/* Right Column: Content */}
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">{t('projectMilestone') || '项目里程碑'}</label>
                <textarea 
                  value={milestone}
                  onChange={(e) => setMilestone(e.target.value)}
                  placeholder={t('milestonePlaceholder') || '请输入项目里程碑...'}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 focus:bg-white transition-all h-24 resize-none text-sm leading-relaxed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">{t('projectContentDetails')}</label>
                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t('contentPlaceholder')}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 focus:bg-white transition-all h-40 resize-none text-sm leading-relaxed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-6 flex justify-end items-center gap-4 border-t border-gray-100">
          <button 
            onClick={onClose}
            className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors"
          >
            {t('discardChanges')}
          </button>
          <button 
            onClick={async () => {
              if (!name || !goal) return;
              if ((startDate && !endDate) || (!startDate && endDate)) {
                alert('Please select both start and end dates.');
                return;
              }
              
              setIsSubmitting(true);
              try {
                const timeline = startDate && endDate ? `${startDate} to ${endDate}` : undefined;
                await projectStore.createProject({
                  name,
                  description,
                  goal,
                  content,
                  timeline,
                  milestone,
                  ownerId: managerId ? parseInt(managerId) : undefined,
                });
                
                // 重置表单
                setName('');
                setDescription('');
                setGoal('');
                setStartDate('');
                setEndDate('');
                setContent('');
                setMilestone('');
                setManagerId('');
                
                onClose();
              } catch (error) {
                console.error('Failed to create project:', error);
                alert('Failed to create project. Please try again.');
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={!name || !goal || isSubmitting}
            className="px-10 py-3 bg-emerald-600 text-white text-sm font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg hover:shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isSubmitting ? t('creating') || 'Creating...' : t('createProject')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
