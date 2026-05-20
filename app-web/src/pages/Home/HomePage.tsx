import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckSquare, FileText } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { bugApi, documentApi, projectApi, taskApi } from '../../api';
import { getDocumentTypeLabel, type DocumentType } from '../../constants/document';
import { formatDateTime } from '../../utils/date-time';

type DashboardTaskItem = {
  kind: 'task';
  projectId: number;
  projectName: string;
  id: number;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  updatedAt: string;
};

type DashboardBugItem = {
  kind: 'bug';
  projectId: number;
  projectName: string;
  id: number;
  title: string;
  status: 'open' | 'in-progress' | 'fixed' | 'closed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  updatedAt: string;
};

type DashboardDocumentItem = {
  kind: 'document';
  projectId: number;
  projectName: string;
  id: number;
  title: string;
  type: DocumentType;
  updatedAt: string;
  matchedKeyword: string;
};

type DashboardInitiatedItem = {
  kind: 'task' | 'bug' | 'document';
  projectId: number;
  projectName: string;
  id: number;
  title: string;
  updatedAt: string;
  metaLabel: string;
  route: string;
};

const getTaskViewTab = (status: DashboardTaskItem['status']) => (status === 'done' ? 'done' : 'in-progress');
const getBugViewTab = (status: DashboardBugItem['status']) => (status === 'fixed' || status === 'closed' ? 'resolved' : 'pending');

const getTaskPriorityLabel = (priority: DashboardTaskItem['priority']) => {
  if (priority === 'high') return '高优先级';
  if (priority === 'medium') return '中优先级';
  return '低优先级';
};

const getBugSeverityLabel = (severity: DashboardBugItem['severity']) => {
  if (severity === 'critical') return '紧急';
  if (severity === 'high') return '高';
  if (severity === 'medium') return '中';
  return '低';
};

function DashboardSection({
  title,
  count,
  icon,
  emptyText,
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#d7d2ca] bg-white/95 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef5ff] text-[#175cd3]">
            {icon}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#1f1e1a]">{title}</h2>
            <p className="mt-1 text-sm text-[#736b61]">共 {count} 项</p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        {count === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#ddd7ce] bg-[#faf7f2] px-4 py-8 text-center text-sm text-[#7f776d]">
            {emptyText}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export default function HomePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<DashboardTaskItem[]>([]);
  const [bugs, setBugs] = useState<DashboardBugItem[]>([]);
  const [documents, setDocuments] = useState<DashboardDocumentItem[]>([]);
  const [initiatedItems, setInitiatedItems] = useState<DashboardInitiatedItem[]>([]);

  const mentionKeywords = useMemo(() => {
    if (!user) {
      return [] as string[];
    }

    return Array.from(
      new Set(
        [`@${user.username}`, user.display_name ? `@${user.display_name}` : null].filter(Boolean) as string[]
      )
    );
  }, [user]);

  const initiatedGroups = useMemo(
    () => ({
      documents: initiatedItems.filter((item) => item.kind === 'document'),
      bugs: initiatedItems.filter((item) => item.kind === 'bug'),
      tasks: initiatedItems.filter((item) => item.kind === 'task'),
    }),
    [initiatedItems]
  );

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setBugs([]);
      setDocuments([]);
      setInitiatedItems([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadDashboard = async () => {
      setIsLoading(true);
      try {
        const projects = await projectApi.getProjects();

        const results = await Promise.all(
          projects.map(async (project) => {
            const [taskResponse, bugResponse, documentResponse] = await Promise.all([
              taskApi.getTasks(project.id, {
                assigneeId: user.id,
                page: 1,
                pageSize: 50,
              }),
              bugApi.list(project.id, {
                assigneeId: user.id,
                page: 1,
                pageSize: 50,
              }),
              documentApi.list(project.id, {
                page: 1,
                pageSize: 50,
              }),
            ]);

            const projectTasks: DashboardTaskItem[] = taskResponse.items
              .filter((item) => item.status !== 'done')
              .map((item) => ({
                kind: 'task',
                projectId: project.id,
                projectName: project.name,
                id: item.id,
                title: item.title,
                status: item.status,
                priority: item.priority,
                updatedAt: item.updated_at,
              }));

            const projectBugs: DashboardBugItem[] = bugResponse.items
              .filter((item) => item.status !== 'fixed' && item.status !== 'closed')
              .map((item) => ({
                kind: 'bug',
                projectId: project.id,
                projectName: project.name,
                id: item.id,
                title: item.title,
                status: item.status,
                severity: item.severity,
                updatedAt: item.updated_at,
              }));

            const projectDocuments: DashboardDocumentItem[] = documentResponse.items
              .map((item) => {
                const searchableText = `${item.title}\n${item.content || ''}`;
                const matchedKeyword = mentionKeywords.find((keyword) => searchableText.includes(keyword));
                if (!matchedKeyword) {
                  return null;
                }

                return {
                  kind: 'document' as const,
                  projectId: project.id,
                  projectName: project.name,
                  id: item.id,
                  title: item.title,
                  type: item.type,
                  updatedAt: item.updated_at,
                  matchedKeyword,
                };
              })
              .filter((item): item is DashboardDocumentItem => Boolean(item));

            const projectInitiatedItems: DashboardInitiatedItem[] = [
              ...taskResponse.items
                .filter((item) => item.created_by === user.id)
                .map((item) => ({
                  kind: 'task' as const,
                  projectId: project.id,
                  projectName: project.name,
                  id: item.id,
                  title: item.title,
                  updatedAt: item.updated_at,
                  metaLabel: `任务 · ${item.status === 'done' ? '已完成' : item.status === 'in-progress' ? '进行中' : '待办'}`,
                  route: `/project/${project.id}/tasks/${getTaskViewTab(item.status)}/${item.id}`,
                })),
              ...bugResponse.items
                .filter((item) => item.reporter_id === user.id)
                .map((item) => ({
                  kind: 'bug' as const,
                  projectId: project.id,
                  projectName: project.name,
                  id: item.id,
                  title: item.title,
                  updatedAt: item.updated_at,
                  metaLabel: `缺陷 · ${item.status === 'fixed' || item.status === 'closed' ? '已解决' : item.status === 'in-progress' ? '处理中' : '待处理'}`,
                  route: `/project/${project.id}/bugs/${getBugViewTab(item.status)}/${item.id}`,
                })),
              ...documentResponse.items
                .filter((item) => item.author_id === user.id)
                .map((item) => ({
                  kind: 'document' as const,
                  projectId: project.id,
                  projectName: project.name,
                  id: item.id,
                  title: item.title,
                  updatedAt: item.updated_at,
                  metaLabel: `${getDocumentTypeLabel(item.type)} · 我发起`,
                  route: `/project/${project.id}/documents/${item.id}`,
                })),
            ];

            return {
              tasks: projectTasks,
              bugs: projectBugs,
              documents: projectDocuments,
              initiatedItems: projectInitiatedItems,
            };
          })
        );

        if (cancelled) {
          return;
        }

        setTasks(
          results.flatMap((item) => item.tasks).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        );
        setBugs(
          results.flatMap((item) => item.bugs).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        );
        setDocuments(
          results.flatMap((item) => item.documents).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        );
        setInitiatedItems(
          results.flatMap((item) => item.initiatedItems).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        );
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load dashboard todos:', error);
          setTasks([]);
          setBugs([]);
          setDocuments([]);
          setInitiatedItems([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [mentionKeywords, user]);

  if (isLoading) {
    return (
      <div className="flex-1 bg-[#EFEAE2] px-8 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[32px] bg-white/70 px-8 py-10 text-sm text-[#6f675d] shadow-sm">
            正在加载我的待办...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#EFEAE2] px-8 py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[32px] bg-[linear-gradient(135deg,#10203a_0%,#183b63_52%,#0f6d7a_100%)] px-7 py-6 text-white shadow-[0_20px_48px_rgba(15,23,42,0.16)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/65">Dashboard</div>
              <h1 className="mt-2 text-2xl font-semibold">我的工作台</h1>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-white/78 lg:text-right">
              查看分配给我的任务和缺陷、提及 <span className="font-semibold">{mentionKeywords.join(' / ') || '@我'}</span> 的文档，以及我发起的内容。
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <DashboardSection
            title="我的任务"
            count={tasks.length}
            icon={<CheckSquare className="h-5 w-5" />}
            emptyText="当前没有分配给你的未完成任务。"
          >
            <div className="space-y-3">
              {tasks.map((task) => (
                <button
                  key={`${task.projectId}-${task.id}`}
                  type="button"
                  onClick={() => navigate(`/project/${task.projectId}/tasks/${getTaskViewTab(task.status)}/${task.id}`)}
                  className="w-full rounded-3xl border border-[#e7dfd3] bg-[#fcfaf7] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-[#cfd9e8] hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-[#1f1e1a]">{task.title}</div>
                      <div className="mt-1 truncate text-sm text-[#6f675d]">{task.projectName}</div>
                    </div>
                    <span className="rounded-full bg-[#eef5ff] px-2.5 py-1 text-xs font-medium text-[#175cd3]">
                      {getTaskPriorityLabel(task.priority)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-[#857c71]">
                    <span>{task.status === 'in-progress' ? '进行中' : '待办'}</span>
                    <span>{formatDateTime(task.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </DashboardSection>

          <DashboardSection
            title="我的缺陷"
            count={bugs.length}
            icon={<AlertCircle className="h-5 w-5" />}
            emptyText="当前没有分配给你的未解决缺陷。"
          >
            <div className="space-y-3">
              {bugs.map((bug) => (
                <button
                  key={`${bug.projectId}-${bug.id}`}
                  type="button"
                  onClick={() => navigate(`/project/${bug.projectId}/bugs/${getBugViewTab(bug.status)}/${bug.id}`)}
                  className="w-full rounded-3xl border border-[#e7dfd3] bg-[#fcfaf7] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-[#f0c4c4] hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-[#1f1e1a]">{bug.title}</div>
                      <div className="mt-1 truncate text-sm text-[#6f675d]">{bug.projectName}</div>
                    </div>
                    <span className="rounded-full bg-[#fff1f2] px-2.5 py-1 text-xs font-medium text-[#b42318]">
                      {getBugSeverityLabel(bug.severity)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-[#857c71]">
                    <span>{bug.status === 'in-progress' ? '处理中' : '待处理'}</span>
                    <span>{formatDateTime(bug.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </DashboardSection>

          <DashboardSection
            title="提及我的文档"
            count={documents.length}
            icon={<FileText className="h-5 w-5" />}
            emptyText="当前没有文档内容提及你。"
          >
            <div className="space-y-3">
              {documents.map((document) => (
                <button
                  key={`${document.projectId}-${document.id}`}
                  type="button"
                  onClick={() => navigate(`/project/${document.projectId}/documents/${document.id}`)}
                  className="w-full rounded-3xl border border-[#e7dfd3] bg-[#fcfaf7] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-[#cfe0d1] hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-[#1f1e1a]">{document.title}</div>
                      <div className="mt-1 truncate text-sm text-[#6f675d]">{document.projectName}</div>
                    </div>
                    <span className="rounded-full bg-[#eefbf3] px-2.5 py-1 text-xs font-medium text-[#067647]">
                      {document.matchedKeyword}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-[#857c71]">
                    <span>{getDocumentTypeLabel(document.type)}</span>
                    <span>{formatDateTime(document.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </DashboardSection>

          <DashboardSection
            title="我发起的内容"
            count={initiatedItems.length}
            icon={<FileText className="h-5 w-5" />}
            emptyText="当前没有你发起的任务、缺陷或文档。"
          >
            <div className="space-y-5">
              {[
                { key: 'documents', label: '文档', items: initiatedGroups.documents },
                { key: 'bugs', label: '缺陷', items: initiatedGroups.bugs },
                { key: 'tasks', label: '任务', items: initiatedGroups.tasks },
              ].map((group) => (
                <div key={group.key}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#4a4339]">{group.label}</h3>
                    <span className="text-xs text-[#8a8378]">{group.items.length} 项</span>
                  </div>
                  {group.items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#e2ddd5] bg-[#faf7f2] px-4 py-4 text-sm text-[#8a8378]">
                      暂无{group.label}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {group.items.map((item) => (
                        <button
                          key={`${item.kind}-${item.projectId}-${item.id}`}
                          type="button"
                          onClick={() => navigate(item.route)}
                          className="w-full rounded-3xl border border-[#e7dfd3] bg-[#fcfaf7] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-[#d7d8ef] hover:bg-white"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-base font-semibold text-[#1f1e1a]">{item.title}</div>
                              <div className="mt-1 truncate text-sm text-[#6f675d]">{item.projectName}</div>
                            </div>
                            <span className="rounded-full bg-[#f3f1ff] px-2.5 py-1 text-xs font-medium text-[#5b4fbd]">
                              {group.label}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-[#857c71]">
                            <span>{item.metaLabel}</span>
                            <span>{formatDateTime(item.updatedAt)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </DashboardSection>
        </div>

        {tasks.length === 0 && bugs.length === 0 && documents.length === 0 && initiatedItems.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-[#d5cec4] bg-white/70 px-6 py-10 text-center text-sm text-[#7b7369]">
            当前没有需要你处理的待办，先从左侧选择聊天、联系人或项目开始。
          </div>
        ) : null}

        <div className="text-center text-xs text-[#8a8378]">{t('selectToStart')}</div>
      </div>
    </div>
  );
}
