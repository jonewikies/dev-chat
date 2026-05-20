import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import type { ApiDocument, CreateDocumentData, UpdateDocumentData } from '../../api/document';
import {
  DEFAULT_DOCUMENT_TYPE,
  DOCUMENT_TYPE_OPTIONS,
  type DocumentType,
} from '../../constants/document';

interface DocumentEditorModalProps {
  onCancel: () => void;
  onSubmit: (data: CreateDocumentData | UpdateDocumentData) => Promise<void>;
  document?: ApiDocument | null;
}

const validDocumentTypes = new Set(DOCUMENT_TYPE_OPTIONS.map((item) => item.value));
const validDocumentFormats = new Set(['markdown', 'richtext']);

const getDocumentType = (document?: ApiDocument | null) => {
  const type = document?.type;
  return type && validDocumentTypes.has(type) ? type : DEFAULT_DOCUMENT_TYPE;
};

const getDocumentFormat = (document?: ApiDocument | null) => {
  const format = document?.format;
  return format && validDocumentFormats.has(format) ? format : 'markdown';
};

const getDocumentContent = (document?: ApiDocument | null) => document?.content || '';

export default function DocumentEditorModal({ onCancel, onSubmit, document }: DocumentEditorModalProps) {
  const [title, setTitle] = useState(document?.title || '');
  const [type, setType] = useState<DocumentType>(getDocumentType(document));
  const [format, setFormat] = useState<'markdown' | 'richtext'>(getDocumentFormat(document));
  const [content, setContent] = useState(getDocumentContent(document));
  const [isLoading, setIsLoading] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);

  const editorPlaceholder = useMemo(
    () => (format === 'markdown' ? '请输入 Markdown 文档内容...' : '请输入富文本内容，支持图片、表格等'),
    [format]
  );

  const getEditorContent = () => {
    const editor = editorRef.current;
    if (!editor) return '';
    return editor.getHTML();
  };

  useEffect(() => {
    setTitle(document?.title || '');
    setType(getDocumentType(document));
    setFormat(getDocumentFormat(document));
    setContent(getDocumentContent(document));
  }, [document]);

  useEffect(() => {
    if (format !== 'richtext' || !editorHostRef.current) return;

    editorRef.current?.destroy();
    editorRef.current = new Editor({
      el: editorHostRef.current,
      height: '360px',
      initialEditType: 'wysiwyg',
      previewStyle: 'vertical',
      initialValue: '',
      placeholder: editorPlaceholder,
      usageStatistics: false,
      hideModeSwitch: true,
      hooks: {
        addImageBlobHook: async (blob, callback) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            callback(reader.result as string, blob.name);
          };
          reader.readAsDataURL(blob);
          return false;
        },
      },
    });

    if (content) {
      editorRef.current.setHTML(content);
    }

    return () => {
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [format, editorPlaceholder]);

  useEffect(() => {
    if (format !== 'richtext' || !editorRef.current) return;

    const currentContent = getEditorContent();
    if (content === currentContent) return;

    editorRef.current.setHTML(content || '');
  }, [content, format]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('请输入文档标题');
      return;
    }

    const editor = editorRef.current;
    const editorContent = format === 'richtext' && editor ? getEditorContent() : content;

    setIsLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        type,
        format,
        content: editorContent,
      });
    } catch (error: any) {
      alert(error.message || '保存文档失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-[720px] flex-col rounded-lg bg-white shadow-sm border border-gray-100">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{document ? '编辑文档' : '新建文档'}</h2>
          <p className="text-sm text-gray-500 mt-1">支持 Markdown 和富文本两种编辑模式</p>
        </div>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">×</button>
      </div>

      <form onSubmit={handleSubmit} className="flex h-full flex-1 flex-col overflow-hidden">
        <div className="grid grid-cols-1 gap-4 border-b border-gray-100 px-6 py-4 md:grid-cols-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入文档标题"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 md:col-span-2"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {DOCUMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={format}
              onChange={(e) => {
                const nextFormat = e.target.value as 'markdown' | 'richtext';
                if (format === 'richtext' && editorRef.current) {
                  const currentContent = editorRef.current.getHTML();
                  setContent(currentContent);
                }
                setFormat(nextFormat);
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="markdown">Markdown</option>
              <option value="richtext">富文本</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {format === 'markdown' ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="请输入 Markdown 文档内容..."
              className="h-[520px] w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              spellCheck={false}
            />
          ) : (
            <div ref={editorHostRef} />
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            取消
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isLoading ? '保存中...' : '保存文档'}
          </button>
        </div>
      </form>
    </div>
  );
}
