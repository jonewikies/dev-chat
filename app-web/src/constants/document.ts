export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'requirements_design', label: '需求设计' },
  { value: 'api', label: '接口' },
  { value: 'development_design', label: '开发设计' },
  { value: 'test_cases', label: '测试案例' },
  { value: 'deployment', label: '部署文档' },
  { value: 'meeting_minutes', label: '会议纪要' },
  { value: 'other', label: '其他' },
] as const;

export type DocumentType = (typeof DOCUMENT_TYPE_OPTIONS)[number]['value'];

export const DEFAULT_DOCUMENT_TYPE: DocumentType = 'other';

export const getDocumentTypeLabel = (type?: string) =>
  DOCUMENT_TYPE_OPTIONS.find((item) => item.value === type)?.label || '其他';
