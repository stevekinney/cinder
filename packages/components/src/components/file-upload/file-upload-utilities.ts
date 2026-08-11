import FileIcon from 'lucide-svelte/icons/file';
import FileTextIcon from 'lucide-svelte/icons/file-text';
import ImageIcon from 'lucide-svelte/icons/image';
import TableIcon from 'lucide-svelte/icons/table';

const FILE_TYPE_ICONS: Record<string, typeof FileIcon> = {
  'image/': ImageIcon,
  'application/pdf': FileTextIcon,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileTextIcon,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': TableIcon,
  'text/csv': TableIcon,
  'text/': FileTextIcon,
};

const ACCEPT_TOKEN_LABELS: Record<string, string> = {
  '.pdf': 'PDF',
  'application/pdf': 'PDF',
  '.doc': 'DOC/DOCX',
  '.docx': 'DOC/DOCX',
  'application/msword': 'DOC/DOCX',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOC/DOCX',
  '.xlsx': 'XLSX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  '.csv': 'CSV',
  'text/csv': 'CSV',
  '.png': 'PNG',
  'image/png': 'PNG',
  '.jpg': 'JPG',
  '.jpeg': 'JPG',
  'image/jpeg': 'JPG',
};

function matchesAcceptToken(file: File, token: string): boolean {
  const normalizedToken = token.trim().toLowerCase();
  if (!normalizedToken) return true;

  if (normalizedToken.startsWith('.')) {
    return file.name.toLowerCase().endsWith(normalizedToken);
  }

  const fileType = file.type.toLowerCase();
  if (normalizedToken.endsWith('/*')) {
    return fileType.startsWith(normalizedToken.slice(0, -1));
  }

  return fileType === normalizedToken;
}

function formatList(items: string[]): string {
  if (items.length === 0) return 'Any file type';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, or ${items.at(-1)}`;
}

export function acceptsFile(file: File, accept: string | undefined): boolean {
  if (!accept?.trim()) return true;
  const tokens = accept
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.some((token) => matchesAcceptToken(file, token));
}

export function formatAcceptDescription(accept: string | undefined): string {
  if (!accept?.trim()) return 'Any file type';
  const labels = accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .map((token) => {
      const knownLabel = ACCEPT_TOKEN_LABELS[token];
      if (knownLabel) return knownLabel;
      if (token.startsWith('.')) return token.slice(1).toUpperCase();
      if (token.endsWith('/*')) return `${token.slice(0, -2)} files`;
      return token;
    });
  return formatList([...new Set(labels)]);
}

export function fileTypeIcon(fileType: string): typeof FileIcon {
  const normalizedType = fileType.toLowerCase();
  for (const [match, icon] of Object.entries(FILE_TYPE_ICONS)) {
    if (match.endsWith('/') ? normalizedType.startsWith(match) : normalizedType === match) {
      return icon;
    }
  }
  return FileIcon;
}
