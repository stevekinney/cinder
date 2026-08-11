import FileIcon from 'lucide-svelte/icons/file';
import FileTextIcon from 'lucide-svelte/icons/file-text';
import ImageIcon from 'lucide-svelte/icons/image';
import TableIcon from 'lucide-svelte/icons/table';

import type { FileUploadEntry } from './file-upload.types.ts';

const INTERACTIVE_ARIA_ROLES = [
  'button',
  'checkbox',
  'combobox',
  'grid',
  'gridcell',
  'link',
  'listbox',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'radiogroup',
  'scrollbar',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'tablist',
  'textbox',
  'tree',
  'treegrid',
  'treeitem',
];

export const INTERACTIVE_DESCENDANT_SELECTOR = [
  ':any-link',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  'details',
  'iframe',
  'object',
  'embed',
  'audio[controls]',
  'video[controls]',
  "[contenteditable]:not([contenteditable='false'])",
  ...INTERACTIVE_ARIA_ROLES.map((role) => `[role~='${role}']`),
  '[tabindex]',
].join(', ');

export function dataTransferHasFiles(dataTransfer: DataTransfer | null | undefined): boolean {
  const fileTypes = dataTransfer?.types;
  return fileTypes ? Array.from(fileTypes).includes('Files') : false;
}

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
  '.doc': 'DOC',
  '.docx': 'DOCX',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
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

export function nativeFilesMatch(fileList: FileList | null, files: File[]): boolean {
  const currentFiles = Array.from(fileList ?? []);
  return (
    currentFiles.length === files.length &&
    currentFiles.every((file, index) => file === files[index])
  );
}

function nativeFilesFitTarget(fileList: FileList | null, files: File[]): boolean {
  const currentFiles = Array.from(fileList ?? []);
  return currentFiles.length > 0 && currentFiles.every((file) => files.includes(file));
}

export function fileUploadLimit(multiple: boolean, maxFiles: number | undefined) {
  const normalizedMaxFiles = maxFiles === undefined ? undefined : Math.max(0, Math.floor(maxFiles));
  return multiple ? normalizedMaxFiles : Math.min(1, normalizedMaxFiles ?? 1);
}

export function synchronizeNativeFileInput(
  inputElement: HTMLInputElement | undefined,
  entries: FileUploadEntry[],
  multiple: boolean,
  maxFiles: number | undefined,
) {
  if (!inputElement) return;
  const acceptedEntries = entries.filter((entry) => entry.rejectionReason === undefined);
  const limit = fileUploadLimit(multiple, maxFiles);
  const acceptedFiles = (
    limit === undefined ? acceptedEntries : acceptedEntries.slice(0, limit)
  ).map((entry) => entry.file);
  if (nativeFilesMatch(inputElement.files, acceptedFiles)) return;
  if (typeof DataTransfer === 'undefined') {
    if (!nativeFilesFitTarget(inputElement.files, acceptedFiles)) inputElement.value = '';
    return;
  }
  let dataTransfer: DataTransfer;
  try {
    dataTransfer = new DataTransfer();
  } catch {
    if (!nativeFilesFitTarget(inputElement.files, acceptedFiles)) inputElement.value = '';
    return;
  }
  for (const file of acceptedFiles) dataTransfer.items.add(file);
  try {
    inputElement.files = dataTransfer.files;
  } catch {
    if (!nativeFilesFitTarget(inputElement.files, acceptedFiles)) inputElement.value = '';
  }
}

export function constrainFileUploadEntries(entries: FileUploadEntry[], limit: number | undefined) {
  if (limit === undefined) return entries;
  let acceptedCount = 0;
  return entries.filter((entry) => {
    if (entry.rejectionReason !== undefined) return true;
    acceptedCount += 1;
    return acceptedCount <= limit;
  });
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
  const uniqueLabels = [...new Set(labels)];
  const docIndex = uniqueLabels.indexOf('DOC');
  const docxIndex = uniqueLabels.indexOf('DOCX');
  if (docIndex !== -1 && docxIndex !== -1) {
    uniqueLabels.splice(Math.max(docIndex, docxIndex), 1);
    uniqueLabels[Math.min(docIndex, docxIndex)] = 'DOC/DOCX';
  }
  return formatList(uniqueLabels);
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
