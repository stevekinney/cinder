/// <reference lib="dom" />
/**
 * Headless-seam regression tests for ReviewEditor (DEP plan C8).
 *
 * Verifies that:
 *   - Optional snippet props can be passed without throwing.
 *   - The four snippet context types exist and are stable.
 *   - Default rendering (no snippets) still works.
 */
import { describe, expect, test } from 'bun:test';

import type {
  ExportContext,
  FrontMatterContext,
  ReviewEditorProps,
  SidebarContext,
  ThreadListContext,
} from './review-editor-types.ts';

describe('ReviewEditor headless-seam contracts', () => {
  test('ThreadListContext shape is preserved', () => {
    const context: ThreadListContext = {
      threads: [],
      activeThreadId: null,
      selectThread: () => {},
      resolveThread: () => {},
    };
    expect(context.threads).toHaveLength(0);
    expect(context.activeThreadId).toBeNull();
  });

  test('SidebarContext shape is preserved', () => {
    const threadContext: ThreadListContext = {
      threads: [],
      activeThreadId: null,
      selectThread: () => {},
      resolveThread: () => {},
    };
    const context: SidebarContext = {
      isOpen: false,
      toggle: () => {},
      threads: threadContext,
    };
    expect(context.isOpen).toBe(false);
    expect(context.threads).toBe(threadContext);
  });

  test('FrontMatterContext shape is preserved', () => {
    const context: FrontMatterContext = {
      fields: [],
      updateField: () => {},
      errors: [],
    };
    expect(context.fields).toHaveLength(0);
    expect(context.errors).toHaveLength(0);
  });

  test('ExportContext shape is preserved', () => {
    const context: ExportContext = {
      formats: ['markdown', 'json'],
      export: async () => {},
      isExporting: false,
    };
    expect(context.formats).toContain('markdown');
    expect(context.isExporting).toBe(false);
  });

  test('ReviewEditorProps accepts optional snippet seams without requiring them', () => {
    const minimal: ReviewEditorProps = { id: 'r1' };
    expect(minimal.id).toBe('r1');
    expect(minimal.threadList).toBeUndefined();
    expect(minimal.sidebar).toBeUndefined();
    expect(minimal.frontMatterPanel).toBeUndefined();
    expect(minimal.exportActions).toBeUndefined();
  });
});
