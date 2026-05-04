import { describe, expect, it } from 'bun:test';

import * as icons from './index.ts';

const iconNames = [
  'ArrowUp',
  'Bold',
  'Check',
  'ChevronDown',
  'ChevronLeft',
  'ChevronRight',
  'ChevronUp',
  'Code',
  'Copy',
  'FileCode',
  'FileText',
  'FolderGit2',
  'GitBranch',
  'Heading1',
  'Heading2',
  'Heading3',
  'Italic',
  'Link',
  'List',
  'ListOrdered',
  'MessageCircle',
  'MessageSquare',
  'MoreHorizontal',
  'Paperclip',
  'Pencil',
  'Pilcrow',
  'Plus',
  'Quote',
  'Redo2',
  'RefreshCw',
  'RotateCcw',
  'Search',
  'Square',
  'Strikethrough',
  'Trash2',
  'Undo2',
  'Unlink',
  'X',
] as const;

describe('icons/index', () => {
  it('exports all 39 icon names', () => {
    for (const name of iconNames) {
      expect(icons[name], `${name} should be exported`).toBeDefined();
    }
  });

  it('each export is component-shaped (function or object)', () => {
    for (const name of iconNames) {
      const icon = icons[name];
      const shape = typeof icon;
      expect(['function', 'object'], `${name} should be a function or object`).toContain(shape);
    }
  });

  it('all 39 exports have distinct identity (no plus-sign aliasing)', () => {
    const exported = iconNames.map((name) => icons[name]);
    const uniqueSet = new Set(exported);

    expect(uniqueSet.size).toBe(iconNames.length);
  });
});
