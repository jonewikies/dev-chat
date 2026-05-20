export const DOCUMENT_TYPES = [
  'requirements_design',
  'api',
  'development_design',
  'test_cases',
  'deployment',
  'meeting_minutes',
  'other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DEFAULT_DOCUMENT_TYPE: DocumentType = 'other';

export const normalizeDocumentType = (type?: string | null): DocumentType => {
  switch (type) {
    case 'requirements_design':
    case 'api':
    case 'development_design':
    case 'test_cases':
    case 'deployment':
    case 'meeting_minutes':
    case 'other':
      return type;
    case 'product':
      return 'requirements_design';
    case 'design':
      return 'development_design';
    case 'meeting':
      return 'meeting_minutes';
    case 'general':
    default:
      return DEFAULT_DOCUMENT_TYPE;
  }
};
