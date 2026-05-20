import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Trash2, Upload } from 'lucide-react';
import {
  prototypeApi,
  type ApiProjectPrototype,
  type CreatePrototypeData,
  type UpdatePrototypeData,
} from '../../api/prototype';
import { formatDateTime } from '../../utils/date-time';
import IconActionButton from '../IconActionButton';

interface PrototypeManagementProps {
  projectId: number;
  canEdit: boolean;
}

interface PrototypeFormModalProps {
  prototype?: ApiProjectPrototype | null;
  onCancel: () => void;
  onSubmit: (data: CreatePrototypeData | UpdatePrototypeData) => Promise<void>;
}

function PrototypeFormModal({ prototype, onCancel, onSubmit }: PrototypeFormModalProps) {
  const [name, setName] = useState(prototype?.name || '');
  const [description, setDescription] = useState(prototype?.description || '');
  const [archive, setArchive] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLabel = prototype ? '保存修改' : '上传原型稿';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      alert('请输入原型稿名称');
      return;
    }

    if (!prototype && !archive) {
      alert('请上传 Axure 导出的 html zip 压缩包');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        ...(archive ? { archive } : {}),
      });
    } catch (error: any) {
      alert(error.message || '保存原型稿失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8">
      <div className="w-full max-w-2xl rounded-3xl border border-gray-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{prototype ? '编辑原型稿' : '上传原型稿'}</h2>
            <p className="mt-1 text-sm text-gray-500">支持 Axure 导出的 html zip 包，上传后会自动解压生成预览地址。</p>
          </div>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <label className="block text-sm text-gray-700">
            <span className="mb-2 block font-medium">原型稿名称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：V3 交互原型"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>

          <label className="block text-sm text-gray-700">
            <span className="mb-2 block font-medium">说明</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="补充版本说明、评审状态或 Axure 导出备注"
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>

          <label className="block text-sm text-gray-700">
            <span className="mb-2 block font-medium">HTML 压缩包</span>
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => setArchive(event.target.files?.[0] || null)}
              className="block w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-sky-700"
            />
            <span className="mt-2 block text-xs text-gray-500">
              {prototype ? '如需替换当前预览内容，可重新上传 zip；不上传则只更新名称和说明。' : '必须上传包含 index.html 的 Axure 导出 zip 包。'}
            </span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
              取消
            </button>
            <button type="submit" disabled={isSubmitting} className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-gray-300">
              {isSubmitting ? '处理中...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PrototypeManagement({ projectId, canEdit }: PrototypeManagementProps) {
  const [prototypes, setPrototypes] = useState<ApiProjectPrototype[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPrototypeId, setSelectedPrototypeId] = useState<number | null>(null);
  const [selectedPrototype, setSelectedPrototype] = useState<ApiProjectPrototype | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPrototype, setEditingPrototype] = useState<ApiProjectPrototype | null>(null);

  useEffect(() => {
    void fetchPrototypes();
  }, [projectId]);

  useEffect(() => {
    if (prototypes.length === 0) {
      setSelectedPrototypeId(null);
      setSelectedPrototype(null);
      return;
    }

    if (!selectedPrototypeId || !prototypes.some((prototype) => prototype.id === selectedPrototypeId)) {
      setSelectedPrototypeId(prototypes[0].id);
    }
  }, [prototypes, selectedPrototypeId]);

  useEffect(() => {
    if (!selectedPrototypeId) {
      setSelectedPrototype(null);
      return;
    }

    void fetchPrototypeDetail(selectedPrototypeId);
  }, [selectedPrototypeId]);

  const fetchPrototypes = async () => {
    setLoading(true);
    try {
      const items = await prototypeApi.list(projectId);
      setPrototypes(items);
    } catch (error) {
      console.error('加载原型稿失败:', error);
      setPrototypes([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrototypeDetail = async (prototypeId: number) => {
    setPreviewLoading(true);
    try {
      const item = await prototypeApi.get(projectId, prototypeId);
      setSelectedPrototype(item);
    } catch (error) {
      console.error('加载原型稿详情失败:', error);
      setSelectedPrototype(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreatePrototype = async (data: CreatePrototypeData | UpdatePrototypeData) => {
    const created = await prototypeApi.create(projectId, data as CreatePrototypeData);
    setFormOpen(false);
    setEditingPrototype(null);
    await fetchPrototypes();
    setSelectedPrototypeId(created.id);
  };

  const handleUpdatePrototype = async (data: CreatePrototypeData | UpdatePrototypeData) => {
    if (!editingPrototype) return;
    const updated = await prototypeApi.update(projectId, editingPrototype.id, data);
    setFormOpen(false);
    setEditingPrototype(null);
    await fetchPrototypes();
    setSelectedPrototypeId(updated.id);
    setSelectedPrototype(updated);
  };

  const handleDeletePrototype = async (prototypeId: number) => {
    if (!window.confirm('确定删除该原型稿吗？删除后预览包和解压内容会一并移除。')) {
      return;
    }

    try {
      await prototypeApi.delete(projectId, prototypeId);
      if (selectedPrototypeId === prototypeId) {
        setSelectedPrototypeId(null);
      }
      await fetchPrototypes();
    } catch (error: any) {
      alert(error.message || '删除原型稿失败');
    }
  };

  const formatDate = (value?: string) => {
    return formatDateTime(value, '暂无');
  };

  const formatSize = (value?: number) => {
    if (!value) return '0 B';
    if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${value} B`;
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">原型稿</h2>
                <p className="mt-1 text-sm text-gray-500">上传 Axure html zip，在线预览、编辑和删除。</p>
              </div>
              {canEdit && (
                <IconActionButton
                  icon={Upload}
                  label="上传原型稿"
                  variant="sky"
                  styleType="solid"
                  onClick={() => {
                    setEditingPrototype(null);
                    setFormOpen(true);
                  }}
                />
              )}
            </div>
          </div>

          {loading && <div className="p-6 text-center text-sm text-gray-500">加载中...</div>}
          {!loading && prototypes.length === 0 && <div className="p-6 text-center text-sm text-gray-500">暂无原型稿</div>}

          <div className="divide-y divide-gray-100">
            {prototypes.map((prototype) => (
              <div
                key={prototype.id}
                onClick={() => setSelectedPrototypeId(prototype.id)}
                className={`cursor-pointer p-4 transition-colors hover:bg-gray-50 ${selectedPrototypeId === prototype.id ? 'bg-sky-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-gray-900">{prototype.name}</div>
                    <div className="mt-2 line-clamp-2 text-xs text-gray-500">{prototype.description || '暂无说明'}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5">{formatSize(prototype.archive_size)}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5">{prototype.archive_file_name}</span>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <IconActionButton
                        icon={Pencil}
                        label="编辑原型稿"
                        variant="sky"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingPrototype(prototype);
                          setFormOpen(true);
                        }}
                      />
                      <IconActionButton
                        icon={Trash2}
                        label="删除原型稿"
                        variant="red"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeletePrototype(prototype.id);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-h-[760px] rounded-lg border border-gray-100 bg-white shadow-sm">
          {!selectedPrototype ? (
            <div className="flex min-h-[760px] items-center justify-center text-sm text-gray-500">
              请选择左侧原型稿开始预览
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-gray-100 px-6 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">{selectedPrototype.name}</h2>
                    <p className="mt-2 text-sm text-gray-500">{selectedPrototype.description || '暂无说明'}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <IconActionButton
                        icon={Pencil}
                        label="修改原型稿"
                        variant="sky"
                        styleType="solid"
                        onClick={() => {
                          setEditingPrototype(selectedPrototype);
                          setFormOpen(true);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 px-6 py-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                <section className="space-y-4">
                  <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
                    <h3 className="text-lg font-semibold text-gray-900">包信息</h3>
                    <div className="mt-4 space-y-3 text-sm text-gray-600">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">压缩包</div>
                        <div className="mt-1 break-all text-gray-900">{selectedPrototype.archive_file_name}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">体积</div>
                        <div className="mt-1 text-gray-900">{formatSize(selectedPrototype.archive_size)}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">入口文件</div>
                        <div className="mt-1 break-all text-gray-900">{selectedPrototype.entry_file}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">最后更新</div>
                        <div className="mt-1 text-gray-900">{formatDate(selectedPrototype.updated_at)}</div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">在线预览</h3>
                      <p className="mt-1 text-sm text-gray-500">提供原型稿访问地址，点击后在新标签页中打开。</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectedPrototypeId && fetchPrototypeDetail(selectedPrototypeId)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      刷新预览
                    </button>
                  </div>

                  <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                    {previewLoading ? (
                      <div className="flex h-[240px] items-center justify-center text-sm text-gray-500">预览地址加载中...</div>
                    ) : (
                      <div className="space-y-5">
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">预览地址</div>
                          <div className="mt-3 break-all text-sm leading-6 text-gray-700">{selectedPrototype.preview_url}</div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <a
                            href={selectedPrototype.preview_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
                          >
                            新开标签访问预览
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>

      {formOpen && (
        <PrototypeFormModal
          prototype={editingPrototype}
          onCancel={() => {
            setFormOpen(false);
            setEditingPrototype(null);
          }}
          onSubmit={editingPrototype ? handleUpdatePrototype : handleCreatePrototype}
        />
      )}
    </>
  );
}