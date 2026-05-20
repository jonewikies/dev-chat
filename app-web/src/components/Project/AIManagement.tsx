import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Check, RotateCcw, Sparkles } from 'lucide-react';
import {
  projectApi,
  type ApiProjectAISummary,
  type ApiProjectAIProposal,
  type ApiProjectAIProposalDetail,
} from '../../api/project';
import { getDocumentTypeLabel } from '../../constants/document';
import { formatDateTime } from '../../utils/date-time';

interface AIManagementProps {
  projectId: number;
  isOwner: boolean;
  canTriggerSummary?: boolean;
  onProjectChanged?: () => void | Promise<void>;
}

type ProposalFilter = 'all' | 'pending' | 'applied' | 'rejected';
type ProposalTypeFilter = 'all' | 'project' | 'task' | 'bug' | 'document';
type ProposalSourceFilter = 'all' | 'gemini' | 'local';
type ProposalRiskFilter = 'all' | 'needs_review' | 'low_confidence';
type SummaryTriggerFilter = 'all' | 'manual' | 'auto';
type SummaryBatchFilter = 'all' | number;

interface ProposalDiffItem {
  label: string;
  before: string;
  after: string;
}

export default function AIManagement({ projectId, isOwner, canTriggerSummary = false, onProjectChanged }: AIManagementProps) {
  const navigate = useNavigate();
  const [summaries, setSummaries] = useState<ApiProjectAISummary[]>([]);
  const [proposals, setProposals] = useState<ApiProjectAIProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<ApiProjectAIProposalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [actingProposalId, setActingProposalId] = useState<number | null>(null);
  const [isBulkActing, setIsBulkActing] = useState(false);
  const [selectedProposalIds, setSelectedProposalIds] = useState<number[]>([]);
  const [proposalFilter, setProposalFilter] = useState<ProposalFilter>('pending');
  const [proposalTypeFilter, setProposalTypeFilter] = useState<ProposalTypeFilter>('all');
  const [proposalSourceFilter, setProposalSourceFilter] = useState<ProposalSourceFilter>('all');
  const [proposalRiskFilter, setProposalRiskFilter] = useState<ProposalRiskFilter>('all');
  const [summaryTriggerFilter, setSummaryTriggerFilter] = useState<SummaryTriggerFilter>('all');
  const [summaryBatchFilter, setSummaryBatchFilter] = useState<SummaryBatchFilter>('all');
  const [editingTitle, setEditingTitle] = useState('');
  const [editingSummary, setEditingSummary] = useState('');
  const [editingReason, setEditingReason] = useState('');
  const [editingPayloadText, setEditingPayloadText] = useState('');
  const [reviewerComment, setReviewerComment] = useState('');

  const selectedSourceMessageIdSet = useMemo(() => {
    return new Set(selectedProposal?.source_message_ids ?? []);
  }, [selectedProposal]);

  const loadData = async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [nextSummaries, nextProposals] = await Promise.all([
        projectApi.getAISummaries(projectId),
        projectApi.getAIProposals(projectId),
      ]);
      setSummaries(nextSummaries);
      setProposals(nextProposals);
      setSelectedProposalIds((previousIds) => {
        const pendingIds = new Set(nextProposals.filter((proposal) => proposal.status === 'pending').map((proposal) => proposal.id));
        return previousIds.filter((proposalId) => pendingIds.has(proposalId));
      });

      if (selectedProposal) {
        const detail = await projectApi.getAIProposalDetail(projectId, selectedProposal.id);
        setSelectedProposal(detail);
      }

      setLastRefreshedAt(new Date().toISOString());
    } catch (error: any) {
      alert(error.message || '加载 AI 管理数据失败');
    } finally {
      if (options?.silent) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectId]);

  useEffect(() => {
    if (!selectedProposal) {
      setEditingTitle('');
      setEditingSummary('');
      setEditingReason('');
      setEditingPayloadText('');
      setReviewerComment('');
      return;
    }

    setEditingTitle(selectedProposal.title || '');
    setEditingSummary(selectedProposal.summary || '');
    setEditingReason(selectedProposal.reason || '');
    setEditingPayloadText(JSON.stringify(selectedProposal.payload, null, 2));
    setReviewerComment('');
  }, [selectedProposal]);

  const loadProposalDetail = async (proposalId: number) => {
    setProposalLoading(true);
    try {
      const detail = await projectApi.getAIProposalDetail(projectId, proposalId);
      setSelectedProposal(detail);
    } catch (error: any) {
      alert(error.message || '加载提案详情失败');
    } finally {
      setProposalLoading(false);
    }
  };

  const handleRetrySummary = async (analysisId: number) => {
    if (!canTriggerSummary) {
      return;
    }

    setLoading(true);
    try {
      await projectApi.retryAISummary(projectId, analysisId);
      await loadData();
    } catch (error: any) {
      alert(error.message || '重试 AI 总结失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKeepSummary = async (analysisId: number) => {
    if (!canTriggerSummary) {
      return;
    }

    if (!window.confirm('确认将这次 AI 总结的沟通纪要加入项目文档吗？')) {
      return;
    }

    setLoading(true);
    try {
      await projectApi.keepAISummary(projectId, analysisId);
      await loadData();
    } catch (error: any) {
      alert(error.message || '保留沟通纪要失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKeep = async (
    proposalId: number,
    overrides?: {
      title?: string;
      summary?: string;
      reason?: string;
      payload?: Record<string, any>;
      reviewerComment?: string;
    }
  ) => {
    if (!isOwner) return;
    if (!window.confirm('确认 keep 这条 AI 内容，并正式写入项目内容吗？')) return;

    setActingProposalId(proposalId);
    try {
      await projectApi.keepAIProposal(projectId, proposalId, overrides);
      await loadData();
      if (onProjectChanged) {
        await onProjectChanged();
      }
    } catch (error: any) {
      alert(error.message || 'keep 失败');
    } finally {
      setActingProposalId(null);
    }
  };

  const handleKeepEdited = async () => {
    if (!selectedProposal || selectedProposal.status !== 'pending' || !isOwner) {
      return;
    }

    let parsedPayload: Record<string, any>;
    try {
      parsedPayload = JSON.parse(editingPayloadText || '{}');
    } catch {
      alert('建议写入内容必须是合法 JSON');
      return;
    }

    await handleKeep(selectedProposal.id, {
      title: editingTitle.trim() || selectedProposal.title,
      summary: editingSummary.trim() || undefined,
      reason: editingReason.trim() || undefined,
      payload: parsedPayload,
      reviewerComment: reviewerComment.trim() || 'edited-keep',
    });
  };

  const handleUndo = async (proposalId: number) => {
    if (!isOwner) return;
    if (!window.confirm('确认 undo 这条 AI 内容吗？撤销后不会写入项目内容。')) return;

    setActingProposalId(proposalId);
    try {
      await projectApi.undoAIProposal(projectId, proposalId);
      await loadData();
    } catch (error: any) {
      alert(error.message || 'undo 失败');
    } finally {
      setActingProposalId(null);
    }
  };

  const renderProposalPayload = (payload: ApiProjectAIProposalDetail['payload']) => {
    if (!payload || typeof payload === 'string') {
      return payload || '无';
    }

    return Object.entries(payload)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
      .join('\n');
  };

  const getStatusLabel = (status: ApiProjectAIProposal['status']) => {
    switch (status) {
      case 'applied':
        return '已保留';
      case 'rejected':
        return '已撤销';
      case 'failed':
        return '失败';
      case 'approved':
        return '已确认';
      default:
        return '待处理';
    }
  };

  const proposalStats = useMemo(() => {
    return proposals.reduce(
      (accumulator, proposal) => {
        accumulator.all += 1;
        if (proposal.status === 'pending') accumulator.pending += 1;
        if (proposal.status === 'applied') accumulator.applied += 1;
        if (proposal.status === 'rejected') accumulator.rejected += 1;
        return accumulator;
      },
      { all: 0, pending: 0, applied: 0, rejected: 0 }
    );
  }, [proposals]);

  const proposalTypeStats = useMemo(() => {
    return proposals.reduce(
      (accumulator, proposal) => {
        accumulator.all += 1;
        accumulator[proposal.target_type] += 1;
        return accumulator;
      },
      { all: 0, project: 0, task: 0, bug: 0, document: 0 }
    );
  }, [proposals]);

  const visibleSummaryBatches = useMemo(() => {
    return summaries.slice().sort((left, right) => {
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
  }, [summaries]);

  const summaryTriggerStats = useMemo(() => {
    return summaries.reduce(
      (accumulator, summary) => {
        accumulator.all += 1;
        if (summary.summary_trigger_mode === 'auto') accumulator.auto += 1;
        else accumulator.manual += 1;
        return accumulator;
      },
      { all: 0, manual: 0, auto: 0 }
    );
  }, [summaries]);

  const filteredSummaries = useMemo(() => {
    return visibleSummaryBatches.filter((summary) => {
      return summaryTriggerFilter === 'all' || summary.summary_trigger_mode === summaryTriggerFilter;
    });
  }, [summaryTriggerFilter, visibleSummaryBatches]);

  const summaryMap = useMemo(() => {
    return new Map(visibleSummaryBatches.map((summary) => [summary.id, summary]));
  }, [visibleSummaryBatches]);

  const getProposalSummarySource = (proposal: ApiProjectAIProposal) => summaryMap.get(proposal.ai_analysis_id)?.summary_source;

  const isLowConfidenceProposal = (proposal: ApiProjectAIProposal) => proposal.confidence !== undefined && proposal.confidence < 0.7;

  const isReviewNeededProposal = (proposal: ApiProjectAIProposal) => {
    return getProposalSummarySource(proposal) === 'local' || isLowConfidenceProposal(proposal);
  };

  const proposalSourceStats = useMemo(() => {
    return proposals.reduce(
      (accumulator, proposal) => {
        accumulator.all += 1;
        const summarySource = getProposalSummarySource(proposal);
        if (summarySource === 'gemini') accumulator.gemini += 1;
        if (summarySource === 'local') accumulator.local += 1;
        return accumulator;
      },
      { all: 0, gemini: 0, local: 0 }
    );
  }, [proposals, summaryMap]);

  const proposalRiskStats = useMemo(() => {
    return proposals.reduce(
      (accumulator, proposal) => {
        accumulator.all += 1;
        if (isReviewNeededProposal(proposal)) accumulator.needs_review += 1;
        if (isLowConfidenceProposal(proposal)) accumulator.low_confidence += 1;
        return accumulator;
      },
      { all: 0, needs_review: 0, low_confidence: 0 }
    );
  }, [proposals, summaryMap]);

  const filteredProposals = useMemo(() => {
    const nextProposals = proposals.filter((proposal) => {
      const matchesStatus = proposalFilter === 'all' || proposal.status === proposalFilter;
      const matchesType = proposalTypeFilter === 'all' || proposal.target_type === proposalTypeFilter;
      const proposalSummarySource = getProposalSummarySource(proposal);
      const matchesSource = proposalSourceFilter === 'all' || proposalSummarySource === proposalSourceFilter;
      const matchesRisk = proposalRiskFilter === 'all'
        || (proposalRiskFilter === 'needs_review' && isReviewNeededProposal(proposal))
        || (proposalRiskFilter === 'low_confidence' && isLowConfidenceProposal(proposal));
      const matchesBatch = summaryBatchFilter === 'all' || proposal.ai_analysis_id === summaryBatchFilter;
      return matchesStatus && matchesType && matchesSource && matchesRisk && matchesBatch;
    });

    return [...nextProposals].sort((left, right) => {
      if (left.status !== right.status) {
        if (left.status === 'pending') return -1;
        if (right.status === 'pending') return 1;
      }
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
  }, [proposalFilter, proposalRiskFilter, proposalSourceFilter, proposalTypeFilter, summaryBatchFilter, proposals, summaryMap]);

  const pendingFilteredProposalIds = useMemo(() => {
    return filteredProposals.filter((proposal) => proposal.status === 'pending').map((proposal) => proposal.id);
  }, [filteredProposals]);

  const selectedPendingProposalIds = useMemo(() => {
    const pendingSet = new Set(pendingFilteredProposalIds);
    return selectedProposalIds.filter((proposalId) => pendingSet.has(proposalId));
  }, [pendingFilteredProposalIds, selectedProposalIds]);

  const allFilteredPendingSelected = pendingFilteredProposalIds.length > 0
    && selectedPendingProposalIds.length === pendingFilteredProposalIds.length;

  const currentBatchLabel = useMemo(() => {
    if (summaryBatchFilter === 'all') {
      return '全部批次';
    }

    const matchedSummary = summaries.find((summary) => summary.id === summaryBatchFilter);
    return matchedSummary ? `AI 总结 #${matchedSummary.id}` : `批次 #${summaryBatchFilter}`;
  }, [summaries, summaryBatchFilter]);

  const getTargetTypeLabel = (targetType: ApiProjectAIProposal['target_type']) => {
    switch (targetType) {
      case 'project':
        return '项目';
      case 'task':
        return '任务';
      case 'bug':
        return '缺陷';
      case 'document':
        return '文档';
      default:
        return targetType;
    }
  };

  const getSummaryStatusLabel = (status: ApiProjectAISummary['status']) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return '处理中';
    }
  };

  const getSummarySourceLabel = (summarySource?: ApiProjectAISummary['summary_source']) => {
    switch (summarySource) {
      case 'gemini':
        return 'Gemini';
      case 'local':
        return '本地规则';
      default:
        return '未知来源';
    }
  };

  const getSummaryTriggerModeLabel = (triggerMode?: ApiProjectAISummary['summary_trigger_mode']) => {
    switch (triggerMode) {
      case 'auto':
        return '自动触发';
      case 'manual':
      default:
        return '手动触发';
    }
  };

  const getProposalRiskHint = (proposal: ApiProjectAIProposal) => {
    const summarySource = getProposalSummarySource(proposal);

    if (summarySource === 'local') {
      return '本条提案来自本地规则总结，建议人工复核后再保留。';
    }

    if (isLowConfidenceProposal(proposal)) {
      return '本条提案置信度偏低，建议重点核对来源消息和写入内容。';
    }

    return null;
  };

  const getProposalDraftDiff = (proposal: ApiProjectAIProposalDetail): ProposalDiffItem[] => {
    const normalizedOriginalPayload = JSON.stringify(proposal.payload ?? {}, null, 2);
    const normalizedEditingPayload = (() => {
      try {
        return JSON.stringify(JSON.parse(editingPayloadText || '{}'), null, 2);
      } catch {
        return editingPayloadText;
      }
    })();

    const candidates: ProposalDiffItem[] = [
      {
        label: '提案标题',
        before: proposal.title || '',
        after: editingTitle.trim(),
      },
      {
        label: '摘要',
        before: proposal.summary || '',
        after: editingSummary.trim(),
      },
      {
        label: '生成原因',
        before: proposal.reason || '',
        after: editingReason.trim(),
      },
      {
        label: '建议写入内容 JSON',
        before: normalizedOriginalPayload,
        after: normalizedEditingPayload,
      },
    ];

    return candidates.filter((item) => item.before !== item.after);
  };

  const getAppliedProposalDiff = (proposal: ApiProjectAIProposalDetail): ProposalDiffItem[] => {
    const normalizedOriginalPayload = JSON.stringify(proposal.original_payload ?? {}, null, 2);
    const normalizedAppliedPayload = JSON.stringify(proposal.payload ?? {}, null, 2);

    const candidates: ProposalDiffItem[] = [
      {
        label: '提案标题',
        before: proposal.original_title || '',
        after: proposal.title || '',
      },
      {
        label: '摘要',
        before: proposal.original_summary || '',
        after: proposal.summary || '',
      },
      {
        label: '生成原因',
        before: proposal.original_reason || '',
        after: proposal.reason || '',
      },
      {
        label: '建议写入内容 JSON',
        before: normalizedOriginalPayload,
        after: normalizedAppliedPayload,
      },
    ];

    return candidates.filter((item) => item.before !== item.after);
  };

  const proposalGroups = useMemo(() => {
    const groups = new Map<number, ApiProjectAIProposal[]>();

    filteredProposals.forEach((proposal) => {
      const existing = groups.get(proposal.ai_analysis_id) || [];
      existing.push(proposal);
      groups.set(proposal.ai_analysis_id, existing);
    });

    return Array.from(groups.entries())
      .map(([analysisId, groupedProposals]) => ({
        analysisId,
        summary: summaryMap.get(analysisId),
        proposals: groupedProposals,
      }))
      .sort((left, right) => {
        const leftTime = left.summary ? new Date(left.summary.created_at).getTime() : 0;
        const rightTime = right.summary ? new Date(right.summary.created_at).getTime() : 0;
        return rightTime - leftTime;
      });
  }, [filteredProposals, summaryMap]);

  const navigateToAppliedTarget = (proposal: ApiProjectAIProposal) => {
    if (!proposal.target_id && proposal.target_type !== 'project') {
      return;
    }

    switch (proposal.target_type) {
      case 'task':
        navigate(`/project/${projectId}/tasks/${proposal.action === 'update' ? 'in-progress' : 'in-progress'}/${proposal.target_id}`);
        return;
      case 'bug':
        navigate(`/project/${projectId}/bugs/pending/${proposal.target_id}`);
        return;
      case 'document':
        navigate(`/project/${projectId}/documents/${proposal.target_id}`);
        return;
      case 'project':
        navigate(`/project/${projectId}/overview`);
        return;
      default:
        return;
    }
  };

  const toggleProposalSelection = (proposalId: number) => {
    setSelectedProposalIds((previousIds) => (
      previousIds.includes(proposalId)
        ? previousIds.filter((id) => id !== proposalId)
        : [...previousIds, proposalId]
    ));
  };

  const toggleSelectAllFilteredPending = () => {
    if (allFilteredPendingSelected) {
      setSelectedProposalIds((previousIds) => previousIds.filter((proposalId) => !pendingFilteredProposalIds.includes(proposalId)));
      return;
    }

    setSelectedProposalIds((previousIds) => Array.from(new Set([...previousIds, ...pendingFilteredProposalIds])));
  };

  const clearSelectedProposals = () => {
    setSelectedProposalIds([]);
  };

  const handleBulkAction = async (action: 'keep' | 'undo') => {
    if (!isOwner || selectedPendingProposalIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      action === 'keep'
        ? `确认批量 keep 选中的 ${selectedPendingProposalIds.length} 条 AI 内容吗？`
        : `确认批量 undo 选中的 ${selectedPendingProposalIds.length} 条 AI 内容吗？`
    );
    if (!confirmed) {
      return;
    }

    setIsBulkActing(true);
    try {
      for (const proposalId of selectedPendingProposalIds) {
        if (action === 'keep') {
          await projectApi.keepAIProposal(projectId, proposalId);
        } else {
          await projectApi.undoAIProposal(projectId, proposalId);
        }
      }

      clearSelectedProposals();
      await loadData();
      if (action === 'keep' && onProjectChanged) {
        await onProjectChanged();
      }
    } catch (error: any) {
      alert(error.message || `批量${action}失败`);
    } finally {
      setIsBulkActing(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl bg-white p-8 text-center text-gray-500">正在加载 AI 管理内容...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-sky-900 via-cyan-900 to-emerald-900 p-6 text-white shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-200">
              <Bot className="h-4 w-4" />
              AI 管理
            </div>
            <h2 className="text-2xl font-semibold">群聊 AI 总结与项目内容确认</h2>
            <p className="mt-2 max-w-3xl text-sm text-cyan-100/90">
              这里汇总项目群聊的 AI 总结和 AI 生成的项目内容提案。沟通纪要需要先 keep 才会进入文档管理；提案 keep 后会正式进入任务、缺陷、文档或项目详情。
            </p>
          </div>
          <button
            onClick={() => void loadData({ silent: true })}
            disabled={isRefreshing}
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? '刷新中...' : '刷新'}
          </button>
        </div>
        <div className="mt-3 text-xs text-cyan-100/80">
          {lastRefreshedAt ? `最近刷新：${formatDateTime(lastRefreshedAt)}` : '进入页面后会自动加载最新 AI 管理数据'}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            { key: 'all', label: '全部提案', value: proposalStats.all },
            { key: 'pending', label: '待确认', value: proposalStats.pending },
            { key: 'applied', label: '已保留', value: proposalStats.applied },
            { key: 'rejected', label: '已撤销', value: proposalStats.rejected },
          ].map((item) => (
            <div key={item.key} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <div className="text-xs text-cyan-100/70">{item.label}</div>
              <div className="mt-1 text-2xl font-semibold text-white">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Sparkles className="h-5 w-5 text-cyan-600" />
              群聊 AI 总结
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4 text-sm">
              <span className="font-medium text-gray-800">触发方式：</span>
              {[
                { key: 'all', label: `全部 ${summaryTriggerStats.all}` },
                { key: 'manual', label: `手动 ${summaryTriggerStats.manual}` },
                { key: 'auto', label: `自动 ${summaryTriggerStats.auto}` },
              ].map((item) => {
                const isActive = summaryTriggerFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSummaryTriggerFilter(item.key as SummaryTriggerFilter)}
                    className={`rounded-full px-3 py-2 transition ${
                      isActive
                        ? 'bg-violet-600 text-white'
                        : 'border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-4">
              {filteredSummaries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                  当前筛选下还没有 AI 总结记录。
                </div>
              ) : (
                filteredSummaries.map((summary) => {
                  const isActiveBatch = summaryBatchFilter === summary.id;
                  return (
                  <div key={summary.id} className={`rounded-xl border p-4 ${isActiveBatch ? 'border-cyan-300 bg-cyan-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        <span>AI 总结 #{summary.id}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] ${summary.status === 'failed' ? 'bg-rose-100 text-rose-700' : summary.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {getSummaryStatusLabel(summary.status)}
                        </span>
                        {summary.status === 'completed' && summary.summary_source ? (
                          <span className={`rounded-full px-2.5 py-1 text-[11px] ${summary.summary_source === 'gemini' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-200 text-slate-700'}`}>
                            {getSummarySourceLabel(summary.summary_source)}
                          </span>
                        ) : null}
                        {summary.summary_trigger_mode ? (
                          <span className={`rounded-full px-2.5 py-1 text-[11px] ${summary.summary_trigger_mode === 'auto' ? 'bg-violet-100 text-violet-700' : 'bg-white text-gray-600 border border-gray-200'}`}>
                            {getSummaryTriggerModeLabel(summary.summary_trigger_mode)}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-gray-500">{formatDateTime(summary.created_at)}</div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-gray-700">{summary.overview || (summary.status === 'failed' ? '本次 AI 总结失败。' : '无摘要内容')}</p>
                    {summary.archive_document_title ? (
                      <div className="mt-3 rounded-xl border border-cyan-100 bg-white px-3 py-3 text-sm text-gray-700">
                        <div className="font-medium text-gray-900">沟通纪要草稿</div>
                        <div className="mt-1">
                          {summary.archive_document_title}
                          {summary.archive_document_type ? ` · ${getDocumentTypeLabel(summary.archive_document_type)}` : ''}
                          {summary.archive_document_kept ? ' · 已入库' : ' · 待 keep'}
                        </div>
                      </div>
                    ) : null}
                    {summary.status === 'failed' && summary.error_message ? (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                        失败原因：{summary.error_message}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="rounded-full bg-white px-3 py-1">提案数 {summary.proposal_count}</span>
                      {summary.status === 'completed' ? (
                        <button
                          type="button"
                          onClick={() => setSummaryBatchFilter(summary.id)}
                          className={`rounded-full px-3 py-1 ${isActiveBatch ? 'bg-cyan-600 text-white' : 'bg-white text-cyan-700 hover:bg-cyan-50'}`}
                        >
                          {isActiveBatch ? '当前审核批次' : '只看本批次'}
                        </button>
                      ) : null}
                      {summary.status === 'failed' && summary.can_retry && canTriggerSummary ? (
                        <button
                          type="button"
                          onClick={() => void handleRetrySummary(summary.id)}
                          className="rounded-full bg-rose-600 px-3 py-1 text-white hover:bg-rose-700"
                        >
                          重试本次总结
                        </button>
                      ) : null}
                      {summary.status === 'completed' && !summary.archive_document_id && summary.archive_document_title && canTriggerSummary ? (
                        <button
                          type="button"
                          onClick={() => void handleKeepSummary(summary.id)}
                          className="rounded-full bg-cyan-600 px-3 py-1 text-white hover:bg-cyan-700"
                        >
                          keep 沟通纪要
                        </button>
                      ) : null}
                      {summary.archive_document_id ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/project/${projectId}/documents/${summary.archive_document_id}`)}
                          className="rounded-full bg-white px-3 py-1 text-cyan-700 hover:bg-cyan-50"
                        >
                          沟通纪要 #{summary.archive_document_id}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );})
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="text-lg font-semibold text-gray-900">AI 创建的内容</div>
              {!isOwner ? <div className="text-xs text-amber-600">仅项目负责人可执行 keep / undo</div> : null}
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-600">
              <span className="font-medium text-gray-800">当前批次：</span>
              <span className="rounded-full bg-white px-3 py-1 text-cyan-700">{currentBatchLabel}</span>
              {summaryBatchFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => setSummaryBatchFilter('all')}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-600 hover:bg-gray-100"
                >
                  清除批次筛选
                </button>
              ) : null}
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { key: 'pending', label: `待确认 ${proposalStats.pending}` },
                { key: 'all', label: `全部 ${proposalStats.all}` },
                { key: 'applied', label: `已保留 ${proposalStats.applied}` },
                { key: 'rejected', label: `已撤销 ${proposalStats.rejected}` },
              ].map((item) => {
                const isActive = proposalFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setProposalFilter(item.key as ProposalFilter)}
                    className={`rounded-full px-3 py-2 text-sm transition ${
                      isActive
                        ? 'bg-gray-900 text-white'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="mb-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
              {[
                { key: 'all', label: `全部类型 ${proposalTypeStats.all}` },
                { key: 'task', label: `任务 ${proposalTypeStats.task}` },
                { key: 'bug', label: `缺陷 ${proposalTypeStats.bug}` },
                { key: 'document', label: `文档 ${proposalTypeStats.document}` },
                { key: 'project', label: `项目 ${proposalTypeStats.project}` },
              ].map((item) => {
                const isActive = proposalTypeFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setProposalTypeFilter(item.key as ProposalTypeFilter)}
                    className={`rounded-full px-3 py-2 text-sm transition ${
                      isActive
                        ? 'bg-cyan-600 text-white'
                        : 'border border-cyan-100 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 text-sm">
              <span className="font-medium text-gray-800">来源：</span>
              {[
                { key: 'all', label: `全部 ${proposalSourceStats.all}` },
                { key: 'gemini', label: `Gemini ${proposalSourceStats.gemini}` },
                { key: 'local', label: `本地规则 ${proposalSourceStats.local}` },
              ].map((item) => {
                const isActive = proposalSourceFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setProposalSourceFilter(item.key as ProposalSourceFilter)}
                    className={`rounded-full px-3 py-2 transition ${
                      isActive
                        ? 'bg-slate-800 text-white'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="mb-5 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 text-sm">
              <span className="font-medium text-gray-800">风险：</span>
              {[
                { key: 'all', label: `全部 ${proposalRiskStats.all}` },
                { key: 'needs_review', label: `建议复核 ${proposalRiskStats.needs_review}` },
                { key: 'low_confidence', label: `低置信度 ${proposalRiskStats.low_confidence}` },
              ].map((item) => {
                const isActive = proposalRiskFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setProposalRiskFilter(item.key as ProposalRiskFilter)}
                    className={`rounded-full px-3 py-2 transition ${
                      isActive
                        ? 'bg-amber-500 text-white'
                        : 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            {isOwner && pendingFilteredProposalIds.length > 0 ? (
              <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm">
                <button
                  type="button"
                  onClick={toggleSelectAllFilteredPending}
                  disabled={isBulkActing}
                  className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {allFilteredPendingSelected ? '取消全选当前待确认' : '全选当前待确认'}
                </button>
                <span className="text-emerald-900">已选 {selectedPendingProposalIds.length} / {pendingFilteredProposalIds.length} 条待确认提案</span>
                {selectedPendingProposalIds.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleBulkAction('undo')}
                      disabled={isBulkActing}
                      className="rounded-full border border-gray-200 bg-white px-3 py-2 text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      批量 undo
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleBulkAction('keep')}
                      disabled={isBulkActing}
                      className="rounded-full bg-emerald-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      批量 keep
                    </button>
                    <button
                      type="button"
                      onClick={clearSelectedProposals}
                      disabled={isBulkActing}
                      className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      清空选择
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-4">
              {filteredProposals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                  当前筛选下没有 AI 内容提案。
                </div>
              ) : (
                proposalGroups.map((group) => (
                  <div key={group.analysisId} className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-gray-900">AI 总结 #{group.analysisId}</div>
                          {group.summary?.summary_source ? (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] ${group.summary.summary_source === 'gemini' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-200 text-slate-700'}`}>
                              {getSummarySourceLabel(group.summary.summary_source)}
                            </span>
                          ) : null}
                          {group.summary ? (
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-gray-600">
                              {formatDateTime(group.summary.created_at)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          本批次包含 {group.proposals.length} 条提案
                        </div>
                      </div>
                      {summaryBatchFilter === 'all' ? (
                        <button
                          type="button"
                          onClick={() => setSummaryBatchFilter(group.analysisId)}
                          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-cyan-700 hover:bg-cyan-50"
                        >
                          只看这一批
                        </button>
                      ) : null}
                    </div>

                    <div className="space-y-4">
                      {group.proposals.map((proposal) => {
                        const parsedPayload = typeof proposal.payload === 'string' ? proposal.payload : JSON.stringify(proposal.payload);
                        const isPending = proposal.status === 'pending';
                        const isApplied = proposal.status === 'applied';
                        const isSelected = selectedProposalIds.includes(proposal.id);
                        const summarySource = group.summary?.summary_source;
                        const proposalRiskHint = getProposalRiskHint(proposal);
                        return (
                          <div key={proposal.id} className="rounded-xl border border-gray-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {isOwner && isPending ? (
                                    <label className="mr-1 inline-flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleProposalSelection(proposal.id)}
                                        disabled={isBulkActing}
                                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                      />
                                    </label>
                                  ) : null}
                                  <div className="text-base font-semibold text-gray-900">{proposal.title}</div>
                                  <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs text-cyan-700">
                                    {getTargetTypeLabel(proposal.target_type)} / {proposal.action}
                                  </span>
                                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                                    {getStatusLabel(proposal.status)}
                                  </span>
                                  {summarySource ? (
                                    <span className={`rounded-full px-2.5 py-1 text-xs ${summarySource === 'gemini' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-200 text-slate-700'}`}>
                                      来源 {getSummarySourceLabel(summarySource)}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-2 text-sm text-gray-700">{proposal.summary || '无摘要说明'}</div>
                                <div className="mt-2 text-xs leading-5 text-gray-500">{proposal.reason || '无生成原因'}</div>
                                {proposalRiskHint ? (
                                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                                    {proposalRiskHint}
                                  </div>
                                ) : null}
                              </div>
                              <button
                                onClick={() => void loadProposalDetail(proposal.id)}
                                className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                              >
                                查看详情
                              </button>
                            </div>

                            <pre className="mt-4 overflow-x-auto rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-700 whitespace-pre-wrap">{parsedPayload}</pre>

                            <div className="mt-4 flex items-center justify-between gap-4">
                              <div className="text-xs text-gray-500">
                                {proposal.confidence !== undefined ? `置信度 ${(proposal.confidence * 100).toFixed(0)}%` : '无置信度'}
                              </div>
                              {isPending ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => void handleUndo(proposal.id)}
                                    disabled={!isOwner || actingProposalId === proposal.id || isBulkActing}
                                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                    undo
                                  </button>
                                  <button
                                    onClick={() => void handleKeep(proposal.id)}
                                    disabled={!isOwner || actingProposalId === proposal.id || isBulkActing}
                                    className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <Check className="h-4 w-4" />
                                    keep
                                  </button>
                                </div>
                              ) : isApplied ? (
                                <button
                                  type="button"
                                  onClick={() => navigateToAppliedTarget(proposal)}
                                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100"
                                >
                                  查看已写入内容
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 text-lg font-semibold text-gray-900">提案详情</div>
          {proposalLoading ? (
            <div className="py-12 text-center text-sm text-gray-500">正在加载提案详情...</div>
          ) : !selectedProposal ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
              选择一条 AI 内容后，这里会显示来源消息和建议写入内容。
            </div>
          ) : (
            <div className="space-y-5">
              {(() => {
                const selectedProposalSummary = summaryMap.get(selectedProposal.ai_analysis_id);
                const proposalRiskHint = getProposalRiskHint(selectedProposal);
                const proposalDraftDiff = getProposalDraftDiff(selectedProposal);
                const appliedProposalDiff = getAppliedProposalDiff(selectedProposal);

                return (
                  <>
              <div>
                <div className="text-sm font-medium text-gray-900">{selectedProposal.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>{formatDateTime(selectedProposal.created_at)}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                    批次 #{selectedProposal.ai_analysis_id}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                    {getTargetTypeLabel(selectedProposal.target_type)} / {selectedProposal.action}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                    {getStatusLabel(selectedProposal.status)}
                  </span>
                  {selectedProposalSummary?.summary_source ? (
                    <span className={`rounded-full px-2 py-1 text-[11px] ${selectedProposalSummary.summary_source === 'gemini' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-200 text-slate-700'}`}>
                      来源 {getSummarySourceLabel(selectedProposalSummary.summary_source)}
                    </span>
                  ) : null}
                  {selectedProposal.confidence !== undefined ? (
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] text-gray-600 border border-gray-200">
                      置信度 {(selectedProposal.confidence * 100).toFixed(0)}%
                    </span>
                  ) : null}
                </div>
              </div>

              {proposalRiskHint ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {proposalRiskHint}
                </div>
              ) : null}

              {isOwner && selectedProposal.status === 'pending' ? (
                <div className="space-y-4 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <div className="text-sm font-semibold text-cyan-900">编辑后 keep</div>
                  <label className="block">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">提案标题</div>
                    <input
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-cyan-400"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">摘要</div>
                    <textarea
                      value={editingSummary}
                      onChange={(event) => setEditingSummary(event.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-cyan-400"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">生成原因</div>
                    <textarea
                      value={editingReason}
                      onChange={(event) => setEditingReason(event.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-cyan-400"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">建议写入内容 JSON</div>
                    <textarea
                      value={editingPayloadText}
                      onChange={(event) => setEditingPayloadText(event.target.value)}
                      rows={12}
                      className="w-full rounded-xl border border-cyan-200 bg-slate-950 px-3 py-3 font-mono text-xs leading-6 text-cyan-50 outline-none focus:border-cyan-400"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">审核备注</div>
                    <input
                      value={reviewerComment}
                      onChange={(event) => setReviewerComment(event.target.value)}
                      placeholder="例如：负责人修正后确认"
                      className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-cyan-400"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTitle(selectedProposal.title || '');
                        setEditingSummary(selectedProposal.summary || '');
                        setEditingReason(selectedProposal.reason || '');
                        setEditingPayloadText(JSON.stringify(selectedProposal.payload, null, 2));
                        setReviewerComment('');
                      }}
                      className="rounded-full border border-cyan-200 bg-white px-3 py-2 text-sm text-cyan-800 hover:bg-cyan-50"
                    >
                      重置编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleKeepEdited()}
                      disabled={actingProposalId === selectedProposal.id}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      keep 已编辑内容
                    </button>
                  </div>

                  <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-gray-900">修改预览</div>
                      <div className="text-xs text-gray-500">
                        {proposalDraftDiff.length === 0 ? '当前没有改动' : `已改动 ${proposalDraftDiff.length} 项`}
                      </div>
                    </div>
                    {proposalDraftDiff.length === 0 ? (
                      <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500">
                        当前编辑内容与 AI 原始草稿一致。
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {proposalDraftDiff.map((diffItem) => (
                          <div key={diffItem.label} className="rounded-xl border border-gray-200 bg-white p-3">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{diffItem.label}</div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <div className="mb-1 text-xs text-gray-500">原始内容</div>
                                <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-700 whitespace-pre-wrap">{diffItem.before || '空'}</pre>
                              </div>
                              <div>
                                <div className="mb-1 text-xs text-gray-500">当前编辑</div>
                                <pre className="overflow-x-auto rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-900 whitespace-pre-wrap">{diffItem.after || '空'}</pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {selectedProposal.status === 'applied' ? (
                <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-emerald-900">最终入库差异</div>
                    <div className="text-xs text-emerald-800">
                      {appliedProposalDiff.length === 0 ? '最终内容与 AI 原稿一致' : `负责人改动 ${appliedProposalDiff.length} 项后已入库`}
                    </div>
                  </div>
                  {selectedProposal.reviewer_comment ? (
                    <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-900">
                      审核备注：{selectedProposal.reviewer_comment}
                    </div>
                  ) : null}
                  {appliedProposalDiff.length === 0 ? (
                    <div className="rounded-xl bg-white px-3 py-3 text-sm text-gray-600">
                      负责人按 AI 原始草稿直接保留，没有额外修改。
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {appliedProposalDiff.map((diffItem) => (
                        <div key={diffItem.label} className="rounded-xl border border-emerald-100 bg-white p-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{diffItem.label}</div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <div className="mb-1 text-xs text-gray-500">AI 原始草稿</div>
                              <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-700 whitespace-pre-wrap">{diffItem.before || '空'}</pre>
                            </div>
                            <div>
                              <div className="mb-1 text-xs text-gray-500">最终入库内容</div>
                              <pre className="overflow-x-auto rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-900 whitespace-pre-wrap">{diffItem.after || '空'}</pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">建议写入内容</div>
                <pre className="overflow-x-auto rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-700 whitespace-pre-wrap">{renderProposalPayload(selectedProposal.payload)}</pre>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">审核提示</div>
                <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm leading-6 text-gray-700">
                  {selectedProposalSummary?.summary_source === 'local'
                    ? '本条提案由本地规则提取，适合做草稿参考，保留前应仔细核对。'
                    : '本条提案由结构化 AI 总结产出，仍建议结合来源消息做最终确认。'}
                </div>
              </div>

                  </>
                );
              })()}

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <span>来源消息</span>
                  <span className="rounded-full bg-cyan-50 px-2 py-1 text-[11px] text-cyan-700">
                    引用 {selectedProposal.source_message_ids.length} 条
                  </span>
                </div>
                {selectedProposal.source_message_ids.length > 0 ? (
                  <div className="mb-3 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs leading-5 text-cyan-900">
                    AI 主要依据这些群聊消息生成当前提案，建议 keep 前至少核对被高亮的引用消息。
                  </div>
                ) : null}
                <div className="space-y-3">
                  {selectedProposal.source_messages_preview.length === 0 ? (
                    <div className="text-sm text-gray-500">无来源消息</div>
                  ) : (
                    selectedProposal.source_messages_preview.map((message) => {
                      const isReferenced = selectedSourceMessageIdSet.has(message.id);

                      return (
                      <div
                        key={message.id}
                        className={`rounded-xl border p-3 ${isReferenced ? 'border-cyan-200 bg-cyan-50/70' : 'border-gray-200 bg-white'}`}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span>#{message.id} · {formatDateTime(message.created_at)}</span>
                          {isReferenced ? (
                            <span className="rounded-full bg-cyan-100 px-2 py-1 text-[11px] text-cyan-700">
                              提案引用
                            </span>
                          ) : null}
                        </div>
                        <div className="text-sm leading-6 text-gray-700">{message.content}</div>
                      </div>
                    );})
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
