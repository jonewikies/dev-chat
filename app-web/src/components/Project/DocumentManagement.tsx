import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FilePlus2, Pencil, Send, Trash2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { documentApi, type ApiDocument, type ApiDocumentComment } from '../../api/document';
import type { ApiProjectMember } from '../../api';
import {
  DOCUMENT_TYPE_OPTIONS,
  getDocumentTypeLabel,
  type DocumentType,
} from '../../constants/document';
import { formatDateTime } from '../../utils/date-time';
import IconActionButton from '../IconActionButton';
import DocumentEditorModal from './DocumentEditorModal';

interface MemberWithUser extends ApiProjectMember {
  user?: {
    id: number;
    username: string;
    displayName?: string;
    avatar?: string;
  };
}

interface DocumentManagementProps {
  projectId: number;
  canEdit: boolean;
  currentUserId?: number;
  members: MemberWithUser[];
}

export default function DocumentManagement({ projectId, canEdit, currentUserId, members }: DocumentManagementProps) {
  const { documentId } = useParams<{ documentId?: string }>();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [editingDocumentLoadingId, setEditingDocumentLoadingId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<DocumentType | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState<ApiDocument | null>(null);
  const [comments, setComments] = useState<ApiDocumentComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<ApiDocument | null>(null);

  const routeDocumentId = documentId ? parseInt(documentId, 10) : null;
  
  const fetchDocumentDetail = async (targetDocumentId: number) => {
    const document = await documentApi.get(projectId, targetDocumentId);
    setSelectedDocument(document);
    return document;
  };

  const navigateToDocument = (nextDocumentId?: number) => {
    if (nextDocumentId) {
      navigate(`/project/${projectId}/documents/${nextDocumentId}`);
      return;
    }
    navigate(`/project/${projectId}/documents`);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedType]);

  useEffect(() => {
    fetchDocuments();
  }, [projectId, page, pageSize, search, selectedType]);

  useEffect(() => {
    if (documents.length === 0) {
      setSelectedDocument(null);
      return;
    }

    if (routeDocumentId) {
      const matchedDocument = documents.find((doc) => doc.id === routeDocumentId);
      if (matchedDocument) {
        setSelectedDocument((current) => (current?.id === matchedDocument.id ? current : matchedDocument));
      }
      return;
    }

    const nextDocument = selectedDocument
      ? documents.find((doc) => doc.id === selectedDocument.id) || documents[0]
      : documents[0];

    setSelectedDocument(nextDocument || null);
    if (nextDocument) {
      navigateToDocument(nextDocument.id);
    }
  }, [documents, routeDocumentId]);

  useEffect(() => {
    if (!routeDocumentId) {
      return;
    }

    let cancelled = false;

    const loadDocumentFromRoute = async () => {
      try {
        const document = await documentApi.get(projectId, routeDocumentId);
        if (!cancelled) {
          setSelectedDocument(document);
        }
      } catch (error) {
        if (!cancelled) {
          navigateToDocument(documents[0]?.id);
        }
      }
    };

    void loadDocumentFromRoute();

    return () => {
      cancelled = true;
    };
  }, [projectId, routeDocumentId]);

  useEffect(() => {
    if (selectedDocument) {
      fetchComments(selectedDocument.id);
    } else {
      setComments([]);
    }
  }, [selectedDocument?.id]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const documentHtml = useMemo(() => {
    if (!selectedDocument?.content) return '';

    const rawHtml = selectedDocument.format === 'richtext'
      ? selectedDocument.content
      : marked.parse(selectedDocument.content, { async: false }) as string;

    return DOMPurify.sanitize(rawHtml);
  }, [selectedDocument]);

  const fetchDocuments = async () => {
    setDocumentsLoading(true);
    try {
      const response = await documentApi.list(projectId, {
        type: selectedType || undefined,
        q: search || undefined,
        page,
        pageSize,
      });
      setDocuments(response.items);
      setTotal(response.pagination.total);
    } catch (error) {
      console.error('加载文档列表失败:', error);
      setDocuments([]);
      setTotal(0);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const fetchComments = async (documentId: number) => {
    setCommentsLoading(true);
    try {
      const result = await documentApi.listComments(projectId, documentId);
      setComments(result);
    } catch (error) {
      console.error('加载文档评论失败:', error);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleCreateDocument = async (data: any) => {
    const createdDocument = await documentApi.create(projectId, data);
    setEditorOpen(false);
    setEditingDocument(null);
    await fetchDocuments();
    await fetchDocumentDetail(createdDocument.id);
    navigateToDocument(createdDocument.id);
  };

  const handleUpdateDocument = async (data: any) => {
    if (!editingDocument) return;
    const updatedDocument = await documentApi.update(projectId, editingDocument.id, data);
    setEditorOpen(false);
    setEditingDocument(null);
    await fetchDocuments();
    await fetchDocumentDetail(updatedDocument.id);
    navigateToDocument(updatedDocument.id);
  };

  const handleCancelEdit = () => {
    setEditorOpen(false);
    setEditingDocument(null);
    setEditingDocumentLoadingId(null);
  };

  const handleStartEdit = async (documentId: number) => {
    setEditingDocumentLoadingId(documentId);

    try {
      const document = await documentApi.get(projectId, documentId);
      setEditingDocument(document);
      setEditorOpen(true);
    } catch (error: any) {
      alert(error.message || '加载文档失败');
    } finally {
      setEditingDocumentLoadingId(null);
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (!window.confirm('确定删除该文档吗？')) return;
    try {
      await documentApi.delete(projectId, documentId);
      if (selectedDocument?.id === documentId) {
        setSelectedDocument(null);
      }
      await fetchDocuments();
      const nextDocument = documents.find((document) => document.id !== documentId);
      navigateToDocument(nextDocument?.id);
    } catch (error: any) {
      alert(error.message || '删除文档失败');
    }
  };

  const handleCreateComment = async () => {
    if (!selectedDocument || !commentInput.trim()) return;
    try {
      await documentApi.createComment(projectId, selectedDocument.id, commentInput.trim());
      setCommentInput('');
      await fetchComments(selectedDocument.id);
      await fetchDocumentDetail(selectedDocument.id);
    } catch (error: any) {
      alert(error.message || '评论失败');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!selectedDocument || !window.confirm('确定删除该评论吗？')) return;
    try {
      await documentApi.deleteComment(projectId, selectedDocument.id, commentId);
      await fetchComments(selectedDocument.id);
      await fetchDocumentDetail(selectedDocument.id);
    } catch (error: any) {
      alert(error.message || '删除评论失败');
    }
  };

  const documentActivityItems = selectedDocument
    ? selectedDocument.activity_history && selectedDocument.activity_history.length > 0
      ? selectedDocument.activity_history
      : [
          {
            id: `created-${selectedDocument.id}`,
            document_id: selectedDocument.id,
            project_id: selectedDocument.project_id,
            activity_type: 'created' as const,
            note: '创建文档',
            changed_by: selectedDocument.author_id,
            created_at: selectedDocument.created_at,
            changed_by_user: selectedDocument.author,
          },
        ]
    : [];

  const resolveAuthorName = (document: ApiDocument) => {
    return document.author?.username || members.find((member) => member.user_id === document.author_id)?.user?.username || '未知成员';
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-lg bg-white shadow-sm border border-gray-100">
        <div className="border-b border-gray-100 p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">文档管理</h2>
              <p className="text-sm text-gray-500 mt-1">支持标题模糊搜索、分类快捷筛选和分页</p>
            </div>
            {canEdit && (
              <IconActionButton
                icon={FilePlus2}
                label="新增文档"
                variant="emerald"
                styleType="solid"
                onClick={() => {
                  setEditingDocument(null);
                  setEditorOpen(true);
                }}
              />
            )}
          </div>

          <div className="relative">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="按文档标题模糊查询"
              className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedType('')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                selectedType === '' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部
            </button>
            {DOCUMENT_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedType(option.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  selectedType === option.value ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          {documentsLoading && <div className="p-6 text-sm text-gray-500 text-center">加载中...</div>}
          {!documentsLoading && documents.length === 0 && (
            <div className="p-6 text-sm text-gray-500 text-center">{search || selectedType ? '未找到匹配文档' : '暂无文档'}</div>
          )}

          <div className="divide-y divide-gray-100">
            {documents.map((document) => (
              <div
                key={document.id}
                onClick={() => {
                  setSelectedDocument(document);
                  navigateToDocument(document.id);
                }}
                className={`w-full cursor-pointer p-4 text-left hover:bg-gray-50 ${selectedDocument?.id === document.id ? 'bg-emerald-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{document.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5">{document.format === 'richtext' ? '富文本' : 'Markdown'}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5">{getDocumentTypeLabel(document.type)}</span>
                      <span>{resolveAuthorName(document)}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <IconActionButton
                        icon={Pencil}
                        label={editingDocumentLoadingId === document.id ? '加载文档中' : '编辑文档'}
                        variant="emerald"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleStartEdit(document.id);
                        }}
                        disabled={editingDocumentLoadingId === document.id}
                        loading={editingDocumentLoadingId === document.id}
                      />
                      <IconActionButton
                        icon={Trash2}
                        label="删除文档"
                        variant="red"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(document.id);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 p-4 text-sm">
          <span className="text-gray-500">第 {page} / {totalPages} 页，共 {total} 条</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50"
            >
              上一页
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-[720px]">
        {editorOpen ? (
          <div key={editingDocument?.id || 'new-document'} className="h-full">
            <DocumentEditorModal
              onCancel={handleCancelEdit}
              onSubmit={editingDocument ? handleUpdateDocument : handleCreateDocument}
              document={editingDocument}
            />
          </div>
        ) : !selectedDocument ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500">请选择左侧文档查看详情</div>
        ) : (
          <div className="rounded-lg bg-white shadow-sm border border-gray-100 min-h-[720px] flex flex-col">
            <div className="border-b border-gray-100 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">{selectedDocument.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span>作者：{resolveAuthorName(selectedDocument)}</span>
                    <span>类型：{getDocumentTypeLabel(selectedDocument.type)}</span>
                    <span>格式：{selectedDocument.format === 'richtext' ? '富文本' : 'Markdown'}</span>
                    <span>创建于：{formatDateTime(selectedDocument.created_at)}</span>
                    <span>更新时间：{formatDateTime(selectedDocument.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-6">
                <div className="document-detail-shell">
                  <div
                    className={`document-detail-body ${selectedDocument.format === 'richtext' ? 'document-detail-body-richtext' : 'document-detail-body-markdown'}`}
                    dangerouslySetInnerHTML={{ __html: documentHtml || '<p class="text-gray-400">暂无内容</p>' }}
                  />
                </div>

                <section className="rounded-2xl border border-gray-100 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">活动时间线</h3>
                    <span className="text-sm text-gray-400">{documentActivityItems.length} 条记录</span>
                  </div>
                  <div className="mt-5 space-y-5">
                    {documentActivityItems.map((item, index) => (
                      <div key={item.id} className="relative pl-8">
                        {index < documentActivityItems.length - 1 && (
                          <div className="absolute left-[11px] top-6 h-[calc(100%+12px)] w-px bg-gray-200" />
                        )}
                        <div className="absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <div className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-gray-900">
                              {item.activity_type === 'created'
                                ? '创建文档'
                                : item.activity_type === 'updated'
                                ? '更新文档'
                                : item.activity_type === 'commented'
                                ? '添加评论'
                                : '删除评论'}
                            </div>
                            <div className="text-xs text-gray-400">{formatDateTime(item.created_at)}</div>
                          </div>
                          <div className="mt-2 text-sm leading-relaxed text-gray-600">{item.note}</div>
                          <div className="mt-3 text-xs text-gray-500">
                            操作人：{item.changed_by_user?.username || `用户 #${item.changed_by}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <div className="border-t border-gray-100 px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">评论</h3>
                <span className="text-sm text-gray-500">{comments.length} 条</span>
              </div>

              <div className="flex gap-3 mb-4">
                <textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  rows={3}
                  placeholder="输入评论内容..."
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <IconActionButton
                  icon={Send}
                  label="发表评论"
                  variant="emerald"
                  styleType="solid"
                  onClick={handleCreateComment}
                  disabled={!commentInput.trim()}
                  className="self-end"
                />
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {commentsLoading && <div className="text-sm text-gray-500">加载评论中...</div>}
                {!commentsLoading && comments.length === 0 && <div className="text-sm text-gray-500">暂无评论</div>}
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{comment.author?.username || '未知成员'}</div>
                        <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</div>
                        <div className="mt-2 text-xs text-gray-400">{formatDateTime(comment.created_at)}</div>
                      </div>
                      {(canEdit || comment.author_id === currentUserId) && (
                        <IconActionButton
                          icon={Trash2}
                          label="删除评论"
                          variant="red"
                          onClick={() => handleDeleteComment(comment.id)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
