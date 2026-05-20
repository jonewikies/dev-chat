import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCcw, Shield, UserPlus, KeyRound, Search } from 'lucide-react';
import { userApi } from '../../api';
import { ApiAdminBatchCreateResponse, ApiUser } from '../../api/types';

const parseBatchInput = (raw: string) => {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [username = '', password = '', displayName = '', email = '', isSuperAdmin = 'false'] = line
        .split(',')
        .map((item) => item.trim());

      return {
        username,
        password: password || undefined,
        displayName: displayName || undefined,
        email: email || undefined,
        isSuperAdmin: ['1', 'true', 'yes', 'y'].includes(isSuperAdmin.toLowerCase()),
      };
    });
};

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [batchResult, setBatchResult] = useState<ApiAdminBatchCreateResponse | null>(null);
  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    displayName: '',
    email: '',
    isSuperAdmin: false,
  });
  const [batchForm, setBatchForm] = useState({
    defaultPassword: '',
    raw: '',
  });

  const loadUsers = async (targetPage: number = page, query: string = search) => {
    setLoading(true);
    setError('');
    try {
      const response = await userApi.adminListUsers(query || undefined, {
        page: targetPage,
        pageSize: 20,
      });
      setUsers(response.users);
      setPage(response.pagination.page);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (err: any) {
      setError(err.message || '加载用户失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(1, '');
  }, []);

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await userApi.adminCreateUser({
        username: createForm.username,
        password: createForm.password,
        displayName: createForm.displayName || undefined,
        email: createForm.email || undefined,
        isSuperAdmin: createForm.isSuperAdmin,
      });

      setCreateForm({
        username: '',
        password: '',
        displayName: '',
        email: '',
        isSuperAdmin: false,
      });
      setSuccess('用户创建成功');
      await loadUsers(1, search);
    } catch (err: any) {
      setError(err.message || '创建用户失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    setBatchResult(null);

    try {
      const parsedUsers = parseBatchInput(batchForm.raw);
      const response = await userApi.adminBatchCreateUsers({
        users: parsedUsers,
        defaultPassword: batchForm.defaultPassword || undefined,
      });
      setBatchResult(response);
      setSuccess(`批量创建完成，成功 ${response.summary.created} 个`);
      await loadUsers(1, search);
    } catch (err: any) {
      setError(err.message || '批量创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (user: ApiUser) => {
    const newPassword = window.prompt(`为用户 ${user.username} 输入新密码`, '');
    if (!newPassword) {
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await userApi.adminResetPassword(user.id, newPassword);
      setSuccess(`已重置 ${user.username} 的密码`);
    } catch (err: any) {
      setError(err.message || '重置密码失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-[#F7F9FB]">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-800 text-white p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-7 h-7 text-amber-300" />
            <h1 className="text-2xl font-bold">超级管理员用户管理</h1>
          </div>
          <p className="text-sm text-slate-200">
            管理全部用户、批量创建账号、重置密码。只有 `is_super_admin = true` 的账号可以访问该页面。
          </p>
        </div>

        {(error || success) && (
          <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {error || success}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">用户列表</h2>
                <p className="text-sm text-slate-500">当前共 {total} 个用户</p>
              </div>
              <button
                onClick={() => loadUsers(page, search)}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                loadUsers(1, search);
              }}
              className="flex gap-3 mb-4"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="按用户名、显示名或邮箱搜索"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
              >
                查询
              </button>
            </form>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3">用户名</th>
                    <th className="text-left px-4 py-3">显示名</th>
                    <th className="text-left px-4 py-3">邮箱</th>
                    <th className="text-left px-4 py-3">权限</th>
                    <th className="text-left px-4 py-3">创建时间</th>
                    <th className="text-left px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        正在加载用户
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        没有匹配的用户
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-900">{user.username}</td>
                        <td className="px-4 py-3">{user.display_name || '-'}</td>
                        <td className="px-4 py-3">{user.email || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${user.is_super_admin ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                            {user.is_super_admin ? '超级管理员' : '普通用户'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{user.created_at}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleResetPassword(user)}
                            disabled={submitting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                          >
                            <KeyRound className="w-4 h-4" />
                            重置密码
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-slate-500">
                第 {page} / {Math.max(totalPages, 1)} 页
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => loadUsers(page - 1, search)}
                  disabled={page <= 1 || loading}
                  className="px-3 py-2 rounded-xl border border-slate-200 disabled:opacity-50"
                >
                  上一页
                </button>
                <button
                  onClick={() => loadUsers(page + 1, search)}
                  disabled={page >= totalPages || loading}
                  className="px-3 py-2 rounded-xl border border-slate-200 disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-900">单个创建</h2>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3">
                <input
                  value={createForm.username}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, username: event.target.value }))}
                  placeholder="用户名"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="初始密码"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <input
                  value={createForm.displayName}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
                  placeholder="显示名"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="邮箱"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={createForm.isSuperAdmin}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, isSuperAdmin: event.target.checked }))}
                  />
                  设为超级管理员
                </label>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  创建用户
                </button>
              </form>
            </section>

            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-lg font-bold text-slate-900 mb-2">批量创建</h2>
              <p className="text-sm text-slate-500 mb-4">
                每行一条，格式：`username,password,displayName,email,isSuperAdmin`
              </p>

              <form onSubmit={handleBatchCreate} className="space-y-3">
                <input
                  type="password"
                  value={batchForm.defaultPassword}
                  onChange={(event) => setBatchForm((prev) => ({ ...prev, defaultPassword: event.target.value }))}
                  placeholder="默认密码（当某行未填写 password 时使用）"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <textarea
                  value={batchForm.raw}
                  onChange={(event) => setBatchForm((prev) => ({ ...prev, raw: event.target.value }))}
                  placeholder={'alice,Pass123,Alice,alice@example.com,false\nbob,Pass123,Bob,bob@example.com,true'}
                  className="w-full min-h-[220px] px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
                  required
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  批量创建
                </button>
              </form>

              {batchResult && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700">
                    请求 {batchResult.summary.requested} 条，成功 {batchResult.summary.created} 条，失败 {batchResult.summary.failed} 条
                  </div>
                  {batchResult.failed.length > 0 && (
                    <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
                      <div className="text-sm font-semibold text-red-700 mb-2">失败记录</div>
                      <div className="space-y-2 text-sm text-red-700">
                        {batchResult.failed.map((item, index) => (
                          <div key={`${item.username}-${index}`}>
                            {item.username}: {item.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
