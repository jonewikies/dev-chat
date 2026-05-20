import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BookOpenText, FolderGit2, FolderPlus, GitBranch, GitPullRequest, Globe, LockKeyhole, Pencil, Settings2, Sparkles, TimerReset, Trash2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import {
  repositoryApi,
  type ApiRepository,
  type ApiRepositoryDetail,
  type CreateRepositoryData,
  type UpdateRepositoryData,
} from '../../api/repository';
import { formatDateTime } from '../../utils/date-time';
import IconActionButton from '../IconActionButton';

interface RepositoryManagementProps {
  projectId: number;
  canEdit: boolean;
}

interface RepositoryFormModalProps {
  repository?: ApiRepository | null;
  onCancel: () => void;
  onSubmit: (data: CreateRepositoryData | UpdateRepositoryData) => Promise<void>;
}

function RepositoryFormModal({ repository, onCancel, onSubmit }: RepositoryFormModalProps) {
  const [name, setName] = useState(repository?.name || '');
  const [url, setUrl] = useState(repository?.url || '');
  const [platform, setPlatform] = useState<'gitlab' | 'github' | 'gitea'>(repository?.platform || 'gitlab');
  const [accessToken, setAccessToken] = useState(repository?.access_token || '');
  const [isActive, setIsActive] = useState(repository?.is_active ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAccessTokenHelp, setShowAccessTokenHelp] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      alert('请输入仓库名称');
      return;
    }

    if (!url.trim()) {
      alert('请输入仓库 URL');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        url: url.trim(),
        platform,
        accessToken: accessToken.trim() || undefined,
        isActive,
      });
    } catch (error: any) {
      alert(error.message || '保存仓库失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{repository ? '编辑代码仓库' : '新增代码仓库'}</h2>
            <p className="mt-1 text-sm text-gray-500">支持 GitLab 仓库地址和授权令牌配置</p>
          </div>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm text-gray-700">
              <span className="mb-2 block font-medium">仓库名称</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：dev-chat-web"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>

            <label className="block text-sm text-gray-700">
              <span className="mb-2 block font-medium">平台</span>
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value as 'gitlab' | 'github' | 'gitea')}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="gitlab">GitLab</option>
                <option value="github">GitHub</option>
                <option value="gitea">Gitea</option>
              </select>
            </label>
          </div>

          <label className="block text-sm text-gray-700">
            <span className="mb-2 block font-medium">仓库 URL</span>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://gitlab.example.com/group/project.git"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>

          <label className="block text-sm text-gray-700">
            <span className="mb-2 flex items-center gap-2 font-medium">
              <span>GitLab 访问令牌</span>
              <button
                type="button"
                onClick={() => setShowAccessTokenHelp(true)}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                aria-label="查看 GitLab 访问令牌获取说明"
                title="查看 GitLab 访问令牌获取说明"
              >
                i
              </button>
            </span>
            <input
              type="password"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              placeholder="填写具有读取仓库和 Merge Request 权限的 Token"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="mt-2 block text-xs text-gray-500">用于读取 README、分支和 Merge Request 信息。留空则仅保存仓库基础信息。</span>
          </label>

          <label className="flex items-center gap-3 rounded-2xl bg-emerald-50/70 px-4 py-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>启用仓库详情聚合</span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
              取消
            </button>
            <button type="submit" disabled={isSubmitting} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300">
              {isSubmitting ? '保存中...' : '保存仓库'}
            </button>
          </div>
        </form>
      </div>

      {showAccessTokenHelp && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">如何获取 GitLab 访问令牌</h3>
                <p className="mt-1 text-sm text-gray-500">建议使用专门的只读令牌，不要直接使用个人主账号的高权限令牌。</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAccessTokenHelp(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm text-gray-700">
              <div className="rounded-2xl bg-gray-50 px-4 py-4">
                <div className="font-medium text-gray-900">获取路径</div>
                <div className="mt-2 text-gray-600">登录 GitLab 后，进入 User Settings → Access Tokens。</div>
                <div className="mt-1 text-gray-600">如果你的 GitLab 版本较新，也可能在 Preferences → Access Tokens 或 Personal Access Tokens。</div>
              </div>

              <div className="rounded-2xl bg-gray-50 px-4 py-4">
                <div className="font-medium text-gray-900">推荐配置</div>
                <div className="mt-2 text-gray-600">Token 名称：例如 dev-chat-readonly。</div>
                <div className="mt-1 text-gray-600">过期时间：按你们团队安全策略设置，建议定期轮换。</div>
                <div className="mt-1 text-gray-600">Scope：至少勾选 <span className="font-medium text-gray-900">read_api</span>；部分 GitLab 实例如果读取仓库文件受限，可再补充 <span className="font-medium text-gray-900">read_repository</span>。</div>
              </div>

              <div className="rounded-2xl bg-amber-50 px-4 py-4 text-amber-900">
                <div className="font-medium">使用说明</div>
                <div className="mt-2">当前令牌用于读取 README、分支和 Merge Request 信息。</div>
                <div className="mt-1">生成后 GitLab 只会显示一次完整令牌，请立即复制并粘贴到这里保存。</div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAccessTokenHelp(false)}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RepositoryManagement({ projectId, canEdit }: RepositoryManagementProps) {
  const [repositories, setRepositories] = useState<ApiRepository[]>([]);
  const [repositoriesLoading, setRepositoriesLoading] = useState(false);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<number | null>(null);
  const [repositoryDetail, setRepositoryDetail] = useState<ApiRepositoryDetail | null>(null);
  const [repositoryDetailLoading, setRepositoryDetailLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRepository, setEditingRepository] = useState<ApiRepository | null>(null);

  useEffect(() => {
    void fetchRepositories();
  }, [projectId]);

  useEffect(() => {
    if (repositories.length === 0) {
      setSelectedRepositoryId(null);
      setRepositoryDetail(null);
      return;
    }

    if (!selectedRepositoryId || !repositories.some((repository) => repository.id === selectedRepositoryId)) {
      setSelectedRepositoryId(repositories[0].id);
    }
  }, [repositories, selectedRepositoryId]);

  useEffect(() => {
    if (!selectedRepositoryId) {
      setRepositoryDetail(null);
      return;
    }

    void fetchRepositoryDetail(selectedRepositoryId);
  }, [selectedRepositoryId]);

  const readmeHtml = useMemo(() => {
    if (!repositoryDetail?.readme?.content) return '';
    return DOMPurify.sanitize(marked.parse(repositoryDetail.readme.content, { async: false }) as string);
  }, [repositoryDetail?.readme?.content]);

  const fetchRepositories = async () => {
    setRepositoriesLoading(true);
    try {
      const nextRepositories = await repositoryApi.list(projectId);
      setRepositories(nextRepositories);
    } catch (error) {
      console.error('加载仓库列表失败:', error);
      setRepositories([]);
    } finally {
      setRepositoriesLoading(false);
    }
  };

  const fetchRepositoryDetail = async (repositoryId: number) => {
    setRepositoryDetailLoading(true);
    try {
      const detail = await repositoryApi.getDetail(projectId, repositoryId);
      setRepositoryDetail(detail);
    } catch (error) {
      console.error('加载仓库详情失败:', error);
      setRepositoryDetail(null);
    } finally {
      setRepositoryDetailLoading(false);
    }
  };

  const handleCreateRepository = async (data: CreateRepositoryData | UpdateRepositoryData) => {
    await repositoryApi.create(projectId, data as CreateRepositoryData);
    setFormOpen(false);
    setEditingRepository(null);
    await fetchRepositories();
  };

  const handleUpdateRepository = async (data: CreateRepositoryData | UpdateRepositoryData) => {
    if (!editingRepository) return;
    await repositoryApi.update(projectId, editingRepository.id, data);
    setFormOpen(false);
    setEditingRepository(null);
    await fetchRepositories();
    await fetchRepositoryDetail(editingRepository.id);
  };

  const handleDeleteRepository = async (repositoryId: number) => {
    if (!window.confirm('确定删除该代码仓库吗？')) return;

    try {
      await repositoryApi.delete(projectId, repositoryId);
      if (selectedRepositoryId === repositoryId) {
        setSelectedRepositoryId(null);
      }
      await fetchRepositories();
    } catch (error: any) {
      alert(error.message || '删除仓库失败');
    }
  };

  const openCreateModal = () => {
    setEditingRepository(null);
    setFormOpen(true);
  };

  const openEditModal = (repository: ApiRepository) => {
    setEditingRepository(repository);
    setFormOpen(true);
  };

  const formatDate = (value?: string) => {
    return formatDateTime(value, '暂无');
  };

  const selectedRepository = repositories.find((repository) => repository.id === selectedRepositoryId) || null;
  const branchCount = repositoryDetail?.branches.length || 0;
  const mergeRequestCount = repositoryDetail?.mergeRequests.length || 0;
  const hasReadme = Boolean(repositoryDetail?.readme);
  const summaryDescription = repositoryDetail?.summary?.description?.trim() || '';

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">代码仓库</h2>
                <p className="mt-1 text-sm text-gray-500">支持 GitLab 仓库入录、授权配置和详情聚合</p>
              </div>
              {canEdit && (
                <IconActionButton
                  icon={FolderPlus}
                  label="新增仓库"
                  variant="emerald"
                  styleType="solid"
                  onClick={openCreateModal}
                />
              )}
            </div>
          </div>

          <div>
            {repositoriesLoading && <div className="p-6 text-center text-sm text-gray-500">加载中...</div>}
            {!repositoriesLoading && repositories.length === 0 && <div className="p-6 text-center text-sm text-gray-500">暂无代码仓库</div>}

            <div className="divide-y divide-gray-100">
              {repositories.map((repository) => (
                <div
                  key={repository.id}
                  onClick={() => setSelectedRepositoryId(repository.id)}
                  className={`cursor-pointer p-4 transition-colors hover:bg-gray-50 ${selectedRepositoryId === repository.id ? 'bg-emerald-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-medium text-gray-900">{repository.name}</h3>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{repository.platform}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${repository.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {repository.is_active ? '已启用' : '已停用'}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-xs text-gray-500">{repository.url}</p>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <IconActionButton
                          icon={Pencil}
                          label="编辑仓库"
                          variant="emerald"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditModal(repository);
                          }}
                        />
                        <IconActionButton
                          icon={Trash2}
                          label="删除仓库"
                          variant="red"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeleteRepository(repository.id);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-[720px]">
          {!selectedRepository ? (
            <div className="flex min-h-[720px] items-center justify-center rounded-lg border border-gray-100 bg-white text-sm text-gray-500 shadow-sm">
              请选择左侧仓库查看详情
            </div>
          ) : (
            <div className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_24px_70px_rgba(16,24,40,0.08)]">
              <div className="border-b border-emerald-100 bg-[linear-gradient(135deg,#f5fbf7_0%,#ffffff_48%,#eef7f2_100%)] px-6 py-6 lg:px-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-xs font-medium text-emerald-700">
                        <FolderGit2 className="h-3.5 w-3.5" />
                        {selectedRepository.platform}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${selectedRepository.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {selectedRepository.is_active ? '启用中' : '未启用'}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${repositoryDetail?.integrationStatus === 'configured' ? 'bg-emerald-100 text-emerald-700' : repositoryDetail?.integrationStatus === 'missing-token' ? 'bg-amber-100 text-amber-700' : repositoryDetail?.integrationStatus === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {repositoryDetail?.integrationStatus === 'configured' ? '已授权' : repositoryDetail?.integrationStatus === 'missing-token' ? '缺少令牌' : repositoryDetail?.integrationStatus === 'error' ? '连接失败' : '暂不支持'}
                      </span>
                    </div>

                    <h2 className="text-3xl font-semibold tracking-tight text-gray-950">{selectedRepository.name}</h2>
                    <p className="mt-3 max-w-4xl break-all text-sm leading-6 text-gray-600">{selectedRepository.url}</p>
                    <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-600">
                      {repositoryDetail?.message || summaryDescription || '当前仓库详情页已按概览、文档和工程动态重新组织，方便快速浏览关键状态。'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    {repositoryDetail?.summary?.webUrl && (
                      <a
                        href={repositoryDetail.summary.webUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <Globe className="h-4 w-4" />
                        打开仓库
                      </a>
                    )}
                    {canEdit && (
                      <IconActionButton
                        icon={Settings2}
                        label="修改仓库配置"
                        variant="emerald"
                        styleType="solid"
                        onClick={() => openEditModal(selectedRepository)}
                      />
                    )}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-gray-400">
                      <LockKeyhole className="h-4 w-4" />
                      可见性
                    </div>
                    <div className="mt-3 text-base font-semibold text-gray-900">{repositoryDetail?.summary?.visibility || '暂无'}</div>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-gray-400">
                      <GitBranch className="h-4 w-4" />
                      默认分支
                    </div>
                    <div className="mt-3 text-base font-semibold text-gray-900">{repositoryDetail?.summary?.defaultBranch || '暂无'}</div>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-gray-400">
                      <Sparkles className="h-4 w-4" />
                      活跃概览
                    </div>
                    <div className="mt-3 text-base font-semibold text-gray-900">{branchCount} 分支 · {mergeRequestCount} MR</div>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-gray-400">
                      <TimerReset className="h-4 w-4" />
                      最近活动
                    </div>
                    <div className="mt-3 text-base font-semibold text-gray-900">{formatDate(repositoryDetail?.summary?.lastActivityAt)}</div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 lg:px-8">
                {repositoryDetailLoading && (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-sm text-gray-500">
                    仓库详情加载中...
                  </div>
                )}

                {!repositoryDetailLoading && repositoryDetail && (
                  <div className="flex flex-col mt-4 space-y-0 divide-y divide-gray-100 border-t border-gray-100">
                    
                    {/* 命名空间 */}
                    <div className="flex flex-col sm:flex-row py-4">
                       <div className="w-full sm:w-48 text-sm font-medium text-gray-500 mb-1 sm:mb-0 shrink-0">命名空间</div>
                       <div className="flex-1 text-sm text-gray-900 break-all font-medium">
                         {repositoryDetail.summary?.pathWithNamespace || '暂无'}
                       </div>
                    </div>

                    {/* GitLab 授权状态 */}
                    <div className="flex flex-col sm:flex-row py-4">
                       <div className="w-full sm:w-48 text-sm font-medium text-gray-500 mb-1 sm:mb-0 shrink-0">GitLab 授权状态</div>
                       <div className="flex-1">
                          <div className="flex items-center gap-3">
                             <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${repositoryDetail.integrationStatus === 'configured' ? 'bg-emerald-100 text-emerald-800' : repositoryDetail.integrationStatus === 'missing-token' ? 'bg-amber-100 text-amber-800' : repositoryDetail.integrationStatus === 'error' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                               {repositoryDetail.integrationStatus === 'configured' ? '连接正常' : repositoryDetail.integrationStatus === 'missing-token' ? '需要令牌' : repositoryDetail.integrationStatus === 'error' ? '连接异常' : '当前平台未聚合'}
                             </span>
                             <span className="text-sm text-gray-500">
                               {repositoryDetail.message || '用于判断当前仓库是否可读取 README、分支和 Merge Request 详情。'}
                             </span>
                          </div>
                       </div>
                    </div>

                    {/* 分支信息 */}
                    <div className="flex flex-col sm:flex-row py-4">
                       <div className="w-full sm:w-48 text-sm font-medium text-gray-500 mb-2 sm:mb-0 shrink-0 flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          <span>分支 ({branchCount})</span>
                       </div>
                       <div className="flex-1 space-y-2">
                          {branchCount === 0 && <div className="text-sm text-gray-500">暂无分支信息</div>}
                          {repositoryDetail.branches.map((branch) => (
                             <div key={branch.name} className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                               <div className="flex items-center gap-2">
                                 <div className="font-medium text-gray-900">{branch.name}</div>
                                 {branch.default && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">默认</span>}
                                 {branch.protected && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700">保护</span>}
                               </div>
                               {branch.lastCommit && (
                                 <div className="text-xs text-gray-500 flex items-center gap-2 sm:ml-auto">
                                    <span className="text-gray-700">{branch.lastCommit.shortId} · {branch.lastCommit.title}</span>
                                    <span>{formatDate(branch.lastCommit.authoredDate)}</span>
                                 </div>
                               )}
                             </div>
                          ))}
                       </div>
                    </div>

                    {/* Merge Requests */}
                    <div className="flex flex-col sm:flex-row py-4">
                       <div className="w-full sm:w-48 text-sm font-medium text-gray-500 mb-2 sm:mb-0 shrink-0 flex items-center gap-2">
                          <GitPullRequest className="h-4 w-4" />
                          <span>Merge Requests ({mergeRequestCount})</span>
                       </div>
                       <div className="flex-1 space-y-2">
                          {mergeRequestCount === 0 && <div className="text-sm text-gray-500">暂无打开中的 Merge Request</div>}
                          {repositoryDetail.mergeRequests.map((mergeRequest) => (
                             <div key={mergeRequest.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                                <div>
                                  <div className="font-medium text-gray-900 hover:text-emerald-600 transition-colors">
                                     <a href={mergeRequest.webUrl} target="_blank" rel="noreferrer">
                                       !{mergeRequest.iid} {mergeRequest.title}
                                     </a>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                     <span>{mergeRequest.sourceBranch} → {mergeRequest.targetBranch}</span>
                                     <span>作者: {mergeRequest.authorName || '未知'}</span>
                                     <span>更新于: {formatDate(mergeRequest.updatedAt)}</span>
                                  </div>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>

                    {/* README 状态 */}
                    <div className="flex flex-col sm:flex-row py-4">
                       <div className="w-full sm:w-48 text-sm font-medium text-gray-500 mb-1 sm:mb-0 shrink-0 mt-1">README 状态</div>
                       <div className="flex-1 flex gap-3 items-center">
                         <span className="text-sm font-medium text-gray-900">
                            {hasReadme ? `${repositoryDetail.readme?.fileName} · ${repositoryDetail.readme?.ref}` : '仓库根目录未找到 README 文件'}
                         </span>
                         {hasReadme ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">已接入</span> : <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">未发现</span>}
                       </div>
                    </div>

                    {/* README 内容区 */}
                    <div className="flex flex-col py-4">
                        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-500">
                            <BookOpenText className="h-4 w-4" />
                            <span>README 内容</span>
                        </div>
                        <div className="flex-1 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm overflow-hidden">
                          {repositoryDetail.readme ? (
                            <div className="document-detail-shell max-w-none">
                              <div className="document-detail-body document-detail-body-markdown" dangerouslySetInnerHTML={{ __html: readmeHtml }} />
                            </div>
                          ) : (
                            <div className="text-center text-sm text-gray-400 py-10">暂无 README 内容</div>
                          )}
                        </div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {formOpen && (
        <RepositoryFormModal
          repository={editingRepository}
          onCancel={() => {
            setFormOpen(false);
            setEditingRepository(null);
          }}
          onSubmit={editingRepository ? handleUpdateRepository : handleCreateRepository}
        />
      )}
    </>
  );
}