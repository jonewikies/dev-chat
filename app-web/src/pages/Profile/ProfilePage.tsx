import React, { useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, Save, UserCircle2 } from 'lucide-react';
import { userApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_AVATAR_URL, PRESET_ANIMAL_AVATARS } from '../../constants/avatar';
import { formatDateTime } from '../../utils/date-time';

export default function ProfilePage() {
  const { user, setCurrentUser } = useAuth();
  const [profileForm, setProfileForm] = useState({
    displayName: user?.display_name || '',
    email: user?.email || '',
    avatarUrl: user?.avatar_url || DEFAULT_AVATAR_URL,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const selectedAvatar = useMemo(
    () => profileForm.avatarUrl || DEFAULT_AVATAR_URL,
    [profileForm.avatarUrl]
  );

  useEffect(() => {
    if (!user) {
      return;
    }

    setProfileForm({
      displayName: user.display_name || '',
      email: user.email || '',
      avatarUrl: user.avatar_url || DEFAULT_AVATAR_URL,
    });
  }, [user]);

  if (!user) {
    return null;
  }

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    setProfileMessage('');

    try {
      const updatedUser = await userApi.updateUser({
        displayName: profileForm.displayName || undefined,
        email: profileForm.email || undefined,
        avatarUrl: profileForm.avatarUrl,
      });
      setCurrentUser(updatedUser);
      setProfileMessage('个人资料已更新');
    } catch (error: any) {
      setProfileError(error.message || '保存个人资料失败');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordError('');
    setPasswordMessage('');

    try {
      if (passwordForm.newPassword.length < 6) {
        throw new Error('新密码长度至少为6位');
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error('两次输入的新密码不一致');
      }

      await userApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordMessage('密码修改成功');
    } catch (error: any) {
      setPasswordError(error.message || '密码修改失败');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-[#F7F9FB]">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="rounded-[28px] bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-800 text-white p-6 shadow-xl">
          <div className="flex items-center gap-4">
            <img
              src={selectedAvatar}
              alt={user.username}
              className="w-20 h-20 rounded-3xl border border-white/20 bg-white/10"
            />
            <div>
              <h1 className="text-3xl font-bold">个人中心</h1>
              <div className="mt-1 text-slate-200">登录名：{user.username}</div>
              <div className="mt-1 text-sm text-slate-300">
                注册时间：{formatDateTime(user.created_at)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserCircle2 className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">个人资料</h2>
            </div>

            {(profileError || profileMessage) && (
              <div className={`mb-4 rounded-2xl px-4 py-3 text-sm ${profileError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                {profileError || profileMessage}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">登录名</label>
                <input
                  value={user.username}
                  disabled
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">显示名</label>
                <input
                  value={profileForm.displayName}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, displayName: event.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">邮箱</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                保存资料
              </button>
            </form>
          </section>

          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">预制动物 Emoji 头像</h2>
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
              {PRESET_ANIMAL_AVATARS.map((avatar) => {
                const active = selectedAvatar === avatar.url;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setProfileForm((prev) => ({ ...prev, avatarUrl: avatar.url }))}
                    className={`relative rounded-2xl border p-1 transition-all ${active ? 'border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                    title={avatar.label}
                  >
                    <img src={avatar.url} alt={avatar.label} className="w-full rounded-xl" />
                    {active && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-bold text-slate-900">修改密码</h2>
          </div>

          {(passwordError || passwordMessage) && (
            <div className={`mb-4 rounded-2xl px-4 py-3 text-sm ${passwordError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {passwordError || passwordMessage}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">当前密码</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">新密码</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">确认新密码</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
            </div>
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={savingPassword}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                修改密码
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
