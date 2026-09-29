/// <reference lib="dom" />
/**
 * COR-525: MarkdownEditor's non-destructive filled preview.
 *
 * Preview renders a derived, filled copy of the template. The caller's
 * `value`, its binding and its change callback keep the unfilled template.
 * These tests also cover the three-mode control, the toolbar context in each
 * mode, pending-input ownership on entering preview, and the editing surface
 * retained behind it.
 *
 * Props go through `createReactiveProps`, the getter/setter object a parent's
 * `bind:` compiles to, so writes to `value` and `mode` are observable and the
 * test can replace props after mount. Waits count ticks, never time; rich
 * editor tests install a fake clock before mounting, as the other editor
 * suites do.
 */
import type { PlaceholderDiagnostic } from '@lostgradient/markdown';
import * as markdown from '@lostgradient/markdown';
import { setupHappyDom } from '@lostgradient/testing';
import { listenerCtx } from '@milkdown/kit/plugin/listener';
import { undoDepth } from '@milkdown/kit/prose/history';
import { Selection, TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { describe, expect, mock, spyOn, test } from 'bun:test';
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';
import type { FakeClock } from '../../test/fake-clock.ts';
import { installFakeClock } from '../../test/fake-clock.ts';
import type { EditorMode, MarkdownEditorProps, ToolbarContext } from './markdown-editor.types.ts';

setupHappyDom();

// Load the components after happy-dom is installed.
const [
  { default: MarkdownEditor },
  { createReactiveProps, createEffectRoot: createEffectRootForTest },
  { createMarkdownEditorPreview, planPreviewFill },
] = await Promise.all([
  import('./markdown-editor.svelte'),
  import('./markdown-editor-reactive-props-harness.svelte.ts'),
  import('./markdown-editor-preview.svelte.ts'),
]);
// The module the editor attachment calls to create Milkdown.
const editorModule = await import('../../editor/editor.ts');

const TEMPLATE = 'Hello {{name}}';
const DEFINITIONS = { candidates: [{ path: 'name', types: ['string'] }] } as const;

type Diagnostics = readonly PlaceholderDiagnostic[];

interface EditorHandle {
  getMarkdown(): string;
  setMarkdown(content: string): void;
  getView(): EditorView | null;
  getEditor(): { ctx: { get: (slice: typeof listenerCtx) => unknown } } | null;
}

/** Await ticks until `condition` holds; a bounded count, never a clock. */
async function untilTrue(condition: () => boolean, clock?: FakeClock): Promise<void> {
  for (let iteration = 0; iteration < 200; iteration += 1) {
    if (condition()) return;
    await tick();
    clock?.advance(20);
  }
  throw new Error('untilTrue: condition did not become true within 200 ticks');
}

function mountEditor(initial: Partial<Record<keyof MarkdownEditorProps, unknown>>) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const onValueChange = mock((_value: string) => {});
  const onModeChange = mock((_mode: EditorMode) => {});
  const onReady = mock(() => {});
  const onPlaceholderDiagnosticsChange = mock((_diagnostics: Diagnostics) => {});
  const reactive = createReactiveProps({
    id: 'notes',
    label: 'Notes',
    value: TEMPLATE,
    mode: 'source',
    readonly: false,
    toolbarEnabled: false,
    modeToggleVisible: false,
    placeholderDefinitions: undefined,
    placeholderValues: undefined,
    placeholderValueMode: undefined,
    onValueChange,
    onModeChange,
    onReady,
    onPlaceholderDiagnosticsChange,
    ...initial,
  });
  // The getters and setters stand in for a parent's `bind:` props object.
  const props: MarkdownEditorProps = reactive.props as unknown as MarkdownEditorProps;
  const instance = mount(MarkdownEditor, { target, props }) as unknown as EditorHandle;
  flushSync();
  return {
    target,
    instance,
    reactive,
    onValueChange,
    onModeChange,
    onReady,
    onPlaceholderDiagnosticsChange,
    get value(): string {
      return String(reactive.props['value']);
    },
    /** Replace one or more props in the same flush, as a parent would. */
    set(next: Partial<Record<keyof MarkdownEditorProps, unknown>>) {
      for (const [key, value] of Object.entries(next)) reactive.set(key, value);
      flushSync();
    },
    writesOf(key: string): unknown[] {
      return reactive.writes.filter(([name]) => name === key).map(([, value]) => value);
    },
    latestDiagnostics(): Diagnostics | undefined {
      return onPlaceholderDiagnosticsChange.mock.calls.at(-1)?.[0];
    },
    preview: () => target.querySelector<HTMLElement>('#notes-preview'),
    previewLabel: () => target.querySelector('#notes-preview-label')?.textContent?.trim(),
    previewContent: () => target.querySelector<HTMLElement>('.markdown-editor-preview-content'),
    textarea: () => target.querySelector<HTMLTextAreaElement>('textarea.source-mode'),
    surface: () => target.querySelector<HTMLElement>('.markdown-editor-surface'),
    wrapper: () => target.querySelector<HTMLElement>('.markdown-editor-wrapper'),
    teardown() {
      unmount(instance);
      target.remove();
    },
  };
}

type Mounted = ReturnType<typeof mountEditor>;

async function untilPreviewReady(editor: Mounted, clock?: FakeClock): Promise<void> {
  await untilTrue(() => editor.previewContent() !== null, clock);
}

/** Mount the rich editor behind a fake clock and wait until it is ready. */
async function mountRich(initial: Partial<Record<keyof MarkdownEditorProps, unknown>>) {
  const clock = installFakeClock();
  const editor = mountEditor({ mode: 'wysiwyg', ...initial });
  await untilTrue(() => editor.instance.getView() !== null, clock);
  const view = editor.instance.getView();
  if (!view) throw new Error('The rich editor did not become ready');
  return {
    editor,
    clock,
    view,
    teardown() {
      editor.teardown();
      clock.restore();
    },
  };
}

/** Deliver the late report Milkdown's debounced listener makes, as it would. */
function deliverListenerReport(editor: Mounted, markdown: string, previous: string): void {
  const milkdown = editor.instance.getEditor();
  if (!milkdown) throw new Error('No rich editor');
  const manager = milkdown.ctx.get(listenerCtx) as {
    listeners: { markdownUpdated: ((ctx: unknown, md: string, prev: string) => void)[] };
  };
  for (const listener of manager.listeners.markdownUpdated)
    listener(milkdown.ctx, markdown, previous);
}

/** Type characters at the textarea caret as ordinary browser input. */
async function typeText(textarea: HTMLTextAreaElement, text: string): Promise<void> {
  for (const character of text) {
    textarea.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: character,
        bubbles: true,
        cancelable: true,
      }),
    );
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.slice(0, start) + character + textarea.value.slice(end);
    textarea.setSelectionRange(start + 1, start + 1);
    textarea.dispatchEvent(
      new InputEvent('input', { inputType: 'insertText', data: character, bubbles: true }),
    );
    await tick();
  }
}

async function undoSource(textarea: HTMLTextAreaElement): Promise<void> {
  textarea.dispatchEvent(
    new InputEvent('beforeinput', { inputType: 'historyUndo', bubbles: true, cancelable: true }),
  );
  await tick();
}

function codes(diagnostics: Diagnostics | undefined): string[] {
  return (diagnostics ?? []).map((diagnostic) => diagnostic.code);
}

describe('MarkdownEditor preview content', () => {
  test('mode="preview" renders the filled value while bind:value keeps the unfilled template', async () => {
    const editor = mountEditor({
      mode: 'preview',
      placeholderDefinitions: DEFINITIONS,
      placeholderValues: { name: 'Ada' },
    });
    try {
      await untilTrue(() => editor.preview()?.textContent?.includes('Hello Ada') === true);

      expect(editor.preview()?.textContent).toContain('Hello Ada');
      expect(editor.previewLabel()).toBe('Preview');
      expect(editor.value).toBe(TEMPLATE);
      expect(editor.reactive.writes).toEqual([]);
      expect(editor.onValueChange).not.toHaveBeenCalled();
      expect(editor.instance.getMarkdown()).toBe(TEMPLATE);
    } finally {
      editor.teardown();
    }
  });

  test('without definitions preview is ordinary sanitized Markdown', async () => {
    const editor = mountEditor({
      mode: 'preview',
      value: '# Title\n\n**bold** <script>alert(1)</script> {{name}}',
    });
    try {
      await untilPreviewReady(editor);
      const content = editor.previewContent();
      expect(content?.querySelector('h1')?.textContent).toBe('Title');
      expect(content?.querySelector('strong')?.textContent).toBe('bold');
      expect(content?.querySelector('script')).toBeNull();
      expect(content?.textContent).toContain('{{name}}');
      expect(editor.previewLabel()).toBe('Preview');
      expect(editor.onPlaceholderDiagnosticsChange).not.toHaveBeenCalled();
    } finally {
      editor.teardown();
    }
  });

  test('values without definitions are a configuration error and are not interpolated', async () => {
    const editor = mountEditor({ mode: 'preview', placeholderValues: { name: 'Ada' } });
    try {
      await untilPreviewReady(editor);
      expect(editor.previewContent()?.textContent).toContain('Hello {{name}}');
      expect(editor.previewLabel()).toBe('Unfilled template preview');
      expect(codes(editor.latestDiagnostics())).toEqual(['invalid_definitions']);
    } finally {
      editor.teardown();
    }
  });

  test('absent values give a labeled unfilled template preview with authoring diagnostics', async () => {
    const editor = mountEditor({
      mode: 'preview',
      value: 'Hello {{name}} and {{unknown}}',
      placeholderDefinitions: DEFINITIONS,
    });
    try {
      await untilPreviewReady(editor);
      expect(editor.previewLabel()).toBe('Unfilled template preview');
      expect(editor.previewContent()?.textContent).toContain('Hello {{name}} and {{unknown}}');
      expect(codes(editor.latestDiagnostics())).toEqual(['unknown_placeholder']);
    } finally {
      editor.teardown();
    }
  });

  test('an empty values object fills, keeps unresolved tokens visible and reports them', async () => {
    const editor = mountEditor({
      mode: 'preview',
      placeholderDefinitions: DEFINITIONS,
      placeholderValues: {},
    });
    try {
      await untilPreviewReady(editor);
      expect(editor.previewLabel()).toBe('Preview');
      expect(editor.previewContent()?.textContent).toContain('Hello {{name}}');
      const diagnostics = editor.latestDiagnostics();
      expect(codes(diagnostics)).toEqual(['missing_value']);
      expect(diagnostics?.[0]?.location).toEqual({ kind: 'token', startOffset: 6, endOffset: 14 });
    } finally {
      editor.teardown();
    }
  });

  test('value diagnostics are reported only while preview shows, and never contain values', async () => {
    const values = Object.freeze({ name: Object.freeze(['SECRET-VALUE']) });
    const editor = mountEditor({
      mode: 'source',
      placeholderDefinitions: DEFINITIONS,
      placeholderValues: values,
    });
    try {
      expect(codes(editor.latestDiagnostics())).toEqual([]);
      editor.set({ mode: 'preview' });
      await untilPreviewReady(editor);
      const diagnostics = editor.latestDiagnostics();
      expect(codes(diagnostics)).toEqual(['type_mismatch']);
      expect(JSON.stringify(diagnostics)).not.toContain('SECRET-VALUE');
      expect(values).toEqual({ name: ['SECRET-VALUE'] });

      editor.set({ mode: 'source' });
      expect(codes(editor.latestDiagnostics())).toEqual([]);
    } finally {
      editor.teardown();
    }
  });

  test.each([
    ['an array', ['Ada']],
    ['null', null],
  ])(
    '%s as values reports invalid_values and previews the unfilled template',
    async (_, values) => {
      const editor = mountEditor({
        mode: 'preview',
        placeholderDefinitions: DEFINITIONS,
        placeholderValues: values,
      });
      try {
        await untilPreviewReady(editor);
        expect(editor.previewLabel()).toBe('Unfilled template preview');
        expect(editor.previewContent()?.textContent).toContain('Hello {{name}}');
        expect(codes(editor.latestDiagnostics())).toEqual(['invalid_values']);
      } finally {
        editor.teardown();
      }
    },
  );

  test('literal text is the default; Markdown values are opt-in and still sanitized', async () => {
    const editor = mountEditor({
      mode: 'preview',
      placeholderDefinitions: DEFINITIONS,
      placeholderValues: { name: '**Ada** <img src=x onerror=alert(1)>' },
    });
    try {
      await untilPreviewReady(editor);
      expect(editor.previewContent()?.querySelector('strong')).toBeNull();
      expect(editor.previewContent()?.textContent).toContain('**Ada**');

      editor.set({ placeholderValueMode: 'markdown' });
      expect(editor.previewContent()?.querySelector('strong')?.textContent).toBe('Ada');
      expect(editor.previewContent()?.innerHTML).not.toContain('onerror');
      expect(editor.onValueChange).not.toHaveBeenCalled();
    } finally {
      editor.teardown();
    }
  });

  test('an invalid placeholderValueMode reports invalid_option and disables fill', async () => {
    const editor = mountEditor({
      mode: 'preview',
      placeholderDefinitions: DEFINITIONS,
      placeholderValues: { name: 'Ada' },
      placeholderValueMode: 'html',
    });
    try {
      await untilPreviewReady(editor);
      expect(editor.previewLabel()).toBe('Unfilled template preview');
      expect(editor.previewContent()?.textContent).toContain('Hello {{name}}');
      expect(editor.latestDiagnostics()).toEqual([
        {
          code: 'invalid_option',
          message: 'Option "placeholderValueMode" must be "text" or "markdown".',
          location: { kind: 'configuration', property: 'placeholderValueMode' },
        },
      ]);
    } finally {
      editor.teardown();
    }
  });

  test('preview reacts to replaced values, definitions and source without content callbacks', async () => {
    const editor = mountEditor({
      mode: 'preview',
      placeholderDefinitions: DEFINITIONS,
      placeholderValues: { name: 'Ada' },
    });
    try {
      await untilPreviewReady(editor);
      editor.set({ placeholderValues: { name: 'Grace' } });
      expect(editor.previewContent()?.textContent).toContain('Hello Grace');

      editor.set({ value: 'Bye {{name}}' });
      expect(editor.previewContent()?.textContent).toContain('Bye Grace');

      editor.set({ placeholderDefinitions: { candidates: [{ path: 'other' }] } });
      expect(editor.previewContent()?.textContent).toContain('Bye {{name}}');
      expect(codes(editor.latestDiagnostics())).toEqual(['unknown_placeholder']);

      expect(editor.onValueChange).not.toHaveBeenCalled();
      expect(editor.writesOf('value')).toEqual([]);
    } finally {
      editor.teardown();
    }
  });

  test('separate editors never share preview data', async () => {
    const first = mountEditor({
      mode: 'preview',
      placeholderDefinitions: DEFINITIONS,
      placeholderValues: { name: 'First' },
    });
    const second = mountEditor({
      id: 'other',
      mode: 'preview',
      placeholderDefinitions: DEFINITIONS,
      placeholderValues: { name: 'Second' },
    });
    try {
      await untilTrue(
        () =>
          first.target.querySelector('#notes-preview .markdown-editor-preview-content') !== null &&
          second.target.querySelector('#other-preview .markdown-editor-preview-content') !== null,
      );
      expect(first.target.textContent).toContain('Hello First');
      expect(first.target.textContent).not.toContain('Second');
      expect(second.target.textContent).toContain('Hello Second');
      expect(second.target.textContent).not.toContain('First');
    } finally {
      first.teardown();
      second.teardown();
    }
  });

  test('preview is read-only even when readonly is false', async () => {
    const editor = mountEditor({ mode: 'source', placeholderDefinitions: DEFINITIONS });
    try {
      editor.set({ mode: 'preview' });
      await untilPreviewReady(editor);
      const preview = editor.preview();
      expect(preview?.querySelector('textarea, input, [contenteditable="true"]')).toBeNull();
      expect(editor.surface()?.hidden).toBe(true);
      expect(editor.surface()?.hasAttribute('inert')).toBe(true);
      expect(editor.textarea()?.readOnly).toBe(false);
    } finally {
      editor.teardown();
    }
  });
});

describe('MarkdownEditor mode prop', () => {
  test('an invalid mode keeps the last valid mode, reports invalid_option and never writes back', () => {
    const editor = mountEditor({ mode: 'source' });
    try {
      editor.set({ mode: 'split' });
      expect(editor.wrapper()?.dataset['mode']).toBe('source');
      expect(editor.textarea()).not.toBeNull();
      expect(editor.latestDiagnostics()).toEqual([
        {
          code: 'invalid_option',
          message: 'Option "mode" must be "wysiwyg", "source" or "preview".',
          location: { kind: 'configuration', property: 'mode' },
        },
      ]);
      expect(editor.writesOf('mode')).toEqual([]);
      expect(editor.onModeChange).not.toHaveBeenCalled();

      editor.set({ mode: 'preview' });
      expect(editor.wrapper()?.dataset['mode']).toBe('preview');
      expect(editor.latestDiagnostics()).toEqual([]);
      expect(editor.onModeChange.mock.calls).toEqual([['preview']]);
    } finally {
      editor.teardown();
    }
  });

  test('an invalid initial mode starts in wysiwyg', async () => {
    const clock = installFakeClock();
    const editor = mountEditor({ mode: 'split' });
    try {
      expect(editor.wrapper()?.dataset['mode']).toBe('wysiwyg');
      expect(codes(editor.latestDiagnostics())).toEqual(['invalid_option']);
      await untilTrue(() => editor.instance.getView() !== null, clock);
      expect(editor.writesOf('mode')).toEqual([]);
    } finally {
      editor.teardown();
      clock.restore();
    }
  });
});

describe('MarkdownEditor mode control and toolbar context', () => {
  function toggles(editor: Mounted): HTMLElement[] {
    return [...editor.target.querySelectorAll<HTMLElement>('[id="notes-mode-toggle"]')];
  }

  function previewSegment(editor: Mounted): HTMLButtonElement | null {
    return editor.target.querySelector<HTMLButtonElement>(
      '[id="notes-mode-toggle"] button[aria-label="Preview"]',
    );
  }

  test('the default toolbar hosts exactly one control, with a named Preview option', () => {
    const editor = mountEditor({ toolbarEnabled: true, modeToggleVisible: true });
    try {
      expect(toggles(editor)).toHaveLength(1);
      expect(toggles(editor)[0]?.closest('.editor-toolbar-wrapper')).not.toBeNull();
      expect(previewSegment(editor)).not.toBeNull();
      expect(
        [...toggles(editor)[0]!.querySelectorAll('button')].map((button) =>
          button.getAttribute('aria-label'),
        ),
      ).toEqual(['Rich editor', 'Raw Markdown', 'Preview']);
    } finally {
      editor.teardown();
    }
  });

  test('readonly keeps exactly one control, outside the formatting toolbar', () => {
    const editor = mountEditor({ toolbarEnabled: true, modeToggleVisible: true, readonly: true });
    try {
      expect(toggles(editor)).toHaveLength(1);
      expect(editor.target.querySelector('.editor-toolbar-wrapper')).toBeNull();
      expect(toggles(editor)[0]?.closest('.markdown-editor-mode-bar')).not.toBeNull();
      previewSegment(editor)?.click();
      flushSync();
      expect(editor.writesOf('mode')).toEqual(['preview']);
      expect(editor.onModeChange.mock.calls).toEqual([['preview']]);
    } finally {
      editor.teardown();
    }
  });

  test('a custom toolbar snippet replaces formatting controls only', () => {
    const contexts: ToolbarContext[] = [];
    const toolbar = createRawSnippet((context: () => ToolbarContext) => ({
      render: () => '<div class="custom-toolbar"></div>',
      setup: () => {
        contexts.push(context());
      },
    }));
    const editor = mountEditor({ toolbarEnabled: true, modeToggleVisible: true, toolbar });
    try {
      expect(editor.target.querySelector('.custom-toolbar')).not.toBeNull();
      expect(toggles(editor)).toHaveLength(1);
      expect(toggles(editor)[0]?.closest('.markdown-editor-mode-bar')).not.toBeNull();
      expect(contexts.at(-1)?.mode).toBe('source');
    } finally {
      editor.teardown();
    }
  });

  test('toolbarEnabled={false} keeps the control, and onToolbarContextChange can switch modes', () => {
    const contexts: ToolbarContext[] = [];
    const editor = mountEditor({
      modeToggleVisible: true,
      onToolbarContextChange: (context: ToolbarContext) => contexts.push(context),
    });
    try {
      expect(toggles(editor)).toHaveLength(1);
      const context = contexts.at(-1);
      expect(context).toMatchObject({
        mode: 'source',
        canEdit: false,
        editorContext: null,
        canUndo: false,
        canRedo: false,
        readonly: false,
        linkPopoverOpen: false,
        activeBlockType: { type: 'paragraph' },
      });

      context?.onModeChange('bogus' as EditorMode);
      context?.onModeChange('source');
      flushSync();
      expect(editor.onModeChange).not.toHaveBeenCalled();

      context?.onModeChange('preview');
      flushSync();
      expect(editor.writesOf('mode')).toEqual(['preview']);
      expect(editor.onModeChange.mock.calls).toEqual([['preview']]);
      expect(contexts.at(-1)?.mode).toBe('preview');
    } finally {
      editor.teardown();
    }
  });

  test('modeToggleVisible={false} renders no built-in control', () => {
    const editor = mountEditor({ toolbarEnabled: true, readonly: true });
    try {
      expect(toggles(editor)).toHaveLength(0);
    } finally {
      editor.teardown();
    }
  });

  test('in preview the context is inactive even with a rich editor retained behind it', async () => {
    const contexts: ToolbarContext[] = [];
    const rich = await mountRich({
      onToolbarContextChange: (context: ToolbarContext) => contexts.push(context),
    });
    try {
      await untilTrue(() => contexts.at(-1)?.canEdit === true, rich.clock);
      expect(contexts.at(-1)?.editorContext).not.toBeNull();

      rich.editor.set({ mode: 'preview' });
      expect(contexts.at(-1)).toMatchObject({
        mode: 'preview',
        canEdit: false,
        editorContext: null,
        canUndo: false,
        canRedo: false,
        readonly: false,
        linkPopoverOpen: false,
        activeMarks: { bold: false, italic: false, code: false, strikethrough: false, link: false },
        activeBlockType: { type: 'paragraph' },
      });

      rich.editor.set({ readonly: true });
      expect(contexts.at(-1)?.readonly).toBe(true);
    } finally {
      rich.teardown();
    }
  });

  test('a vetoed user choice does not let a later programmatic change move focus', async () => {
    const editor = mountEditor({ modeToggleVisible: true });
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    try {
      editor.reactive.rejectWrites('mode');
      editor.target
        .querySelector<HTMLButtonElement>('[id="notes-mode-toggle"] button[aria-label="Preview"]')
        ?.click();
      flushSync();
      await tick();
      expect(editor.writesOf('mode')).toEqual(['preview']);
      expect(editor.wrapper()?.dataset['mode']).toBe('source');
      expect(editor.onModeChange).not.toHaveBeenCalled();

      outside.focus();
      editor.set({ mode: 'preview' });
      await untilPreviewReady(editor);
      await tick();
      expect(document.activeElement).toBe(outside);
    } finally {
      outside.remove();
      editor.teardown();
    }
  });

  test('a user choice focuses the preview region; a programmatic change does not', async () => {
    const editor = mountEditor({ modeToggleVisible: true });
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    try {
      outside.focus();
      editor.set({ mode: 'preview' });
      await untilPreviewReady(editor);
      await tick();
      expect(document.activeElement).toBe(outside);

      editor.set({ mode: 'source' });
      editor.target
        .querySelector<HTMLButtonElement>('[id="notes-mode-toggle"] button[aria-label="Preview"]')
        ?.click();
      flushSync();
      await tick();
      expect(document.activeElement).toBe(editor.preview());
    } finally {
      outside.remove();
      editor.teardown();
    }
  });
});

describe('MarkdownEditor preview loading', () => {
  test('a preview-only mount never calls createEditor; choosing the rich editor calls it once', async () => {
    const createEditor = spyOn(editorModule, 'createEditor');
    const clock = installFakeClock();
    const editor = mountEditor({
      mode: 'preview',
      modeToggleVisible: true,
      placeholderDefinitions: DEFINITIONS,
    });
    try {
      await untilPreviewReady(editor, clock);
      expect(createEditor).not.toHaveBeenCalled();

      editor.target
        .querySelector<HTMLButtonElement>(
          '[id="notes-mode-toggle"] button[aria-label="Rich editor"]',
        )
        ?.click();
      flushSync();
      await untilTrue(() => editor.onReady.mock.calls.length === 1, clock);
      expect(createEditor).toHaveBeenCalledTimes(1);
    } finally {
      editor.teardown();
      clock.restore();
      createEditor.mockRestore();
    }
  });

  test('a preview-only mount never initializes the rich editor; selecting it later does', async () => {
    const clock = installFakeClock();
    const editor = mountEditor({ mode: 'preview', placeholderDefinitions: DEFINITIONS });
    try {
      await untilPreviewReady(editor, clock);
      expect(editor.target.querySelector('.ProseMirror')).toBeNull();
      expect(editor.surface()?.childElementCount).toBe(0);
      expect(editor.onReady).not.toHaveBeenCalled();
      expect(editor.wrapper()?.dataset['ready']).toBe('true');

      editor.set({ mode: 'wysiwyg' });
      await untilTrue(() => editor.onReady.mock.calls.length === 1, clock);
      expect(editor.target.querySelector('.ProseMirror')).not.toBeNull();
      expect(editor.preview()).toBeNull();
    } finally {
      editor.teardown();
      clock.restore();
    }
  });
});

describe('MarkdownEditor pending input on entering preview', () => {
  test('captures a pending rich edit and publishes it exactly once, before onModeChange', async () => {
    const events: string[] = [];
    const rich = await mountRich({
      value: 'Hello',
      onValueChange: (next: string) => events.push(`value:${next.trim()}`),
      onModeChange: (next: EditorMode) => events.push(`mode:${next}`),
    });
    try {
      rich.view.dispatch(rich.view.state.tr.insertText('!', 6));
      rich.editor.set({ mode: 'preview' });

      expect(events).toEqual(['value:Hello!', 'mode:preview']);
      expect(rich.editor.value.trim()).toBe('Hello!');

      // Milkdown's late report of the same document never notifies again.
      deliverListenerReport(rich.editor, 'Hello!\n', 'Hello\n');
      rich.clock.advance(2000);
      await tick();
      expect(events).toEqual(['value:Hello!', 'mode:preview']);

      await untilPreviewReady(rich.editor, rich.clock);
      expect(rich.editor.previewContent()?.textContent).toContain('Hello!');
    } finally {
      rich.teardown();
    }
  });

  test('a distinct parent value in the same flush wins and nothing is echoed', async () => {
    const rich = await mountRich({ value: 'Hello' });
    try {
      rich.view.dispatch(rich.view.state.tr.insertText('!', 6));
      rich.editor.set({ value: 'From parent', mode: 'preview' });

      expect(rich.editor.value).toBe('From parent');
      expect(rich.editor.instance.getMarkdown().trim()).toBe('From parent');
      deliverListenerReport(rich.editor, 'Hello!\n', 'Hello\n');
      rich.clock.advance(2000);
      await tick();
      expect(rich.editor.onValueChange).not.toHaveBeenCalled();
      expect(rich.editor.writesOf('value')).toEqual([]);
      expect(rich.editor.onModeChange.mock.calls).toEqual([['preview']]);
    } finally {
      rich.teardown();
    }
  });

  test('entering preview with no pending edit emits no content change', async () => {
    const rich = await mountRich({ value: 'Hello *there*' });
    try {
      rich.editor.set({ mode: 'preview' });
      rich.clock.advance(2000);
      await tick();
      expect(rich.editor.onValueChange).not.toHaveBeenCalled();
      expect(rich.editor.writesOf('value')).toEqual([]);
    } finally {
      rich.teardown();
    }
  });

  test('rich to source still publishes the flushed edit before onModeChange', async () => {
    const events: string[] = [];
    const rich = await mountRich({
      value: 'Hello',
      onValueChange: (next: string) => events.push(`value:${next.trim()}`),
      onModeChange: (next: EditorMode) => events.push(`mode:${next}`),
    });
    try {
      rich.view.dispatch(rich.view.state.tr.insertText('!', 6));
      rich.editor.set({ mode: 'source' });
      expect(events).toEqual(['value:Hello!', 'mode:source']);
    } finally {
      rich.teardown();
    }
  });
});

describe('MarkdownEditor editing surface retained behind preview', () => {
  test('returning to the rich editor keeps its instance, selection and history', async () => {
    const rich = await mountRich({ value: 'Hello world' });
    try {
      rich.view.dispatch(rich.view.state.tr.insertText('!', 12));
      rich.view.dispatch(
        rich.view.state.tr.setSelection(TextSelection.create(rich.view.state.doc, 2, 5)),
      );
      const selection = rich.view.state.selection;

      rich.editor.set({ mode: 'preview' });
      await untilPreviewReady(rich.editor, rich.clock);
      rich.editor.set({ placeholderDefinitions: DEFINITIONS, placeholderValues: { name: 'x' } });
      rich.editor.set({ mode: 'wysiwyg' });

      expect(rich.editor.instance.getView()).toBe(rich.view);
      expect(rich.view.state.selection.eq(selection)).toBe(true);
      expect(undoDepth(rich.view.state)).toBe(1);
      expect(rich.editor.surface()?.hidden).toBe(false);
    } finally {
      rich.teardown();
    }
  });

  test('an external replacement during preview becomes the rich editor’s new baseline', async () => {
    const rich = await mountRich({ value: 'Hello' });
    try {
      rich.view.dispatch(rich.view.state.tr.insertText('!', 6));
      rich.editor.set({ mode: 'preview' });
      rich.editor.onValueChange.mockClear();

      rich.editor.set({ value: 'Replaced' });
      rich.editor.set({ mode: 'wysiwyg' });

      expect(rich.editor.instance.getMarkdown().trim()).toBe('Replaced');
      expect(undoDepth(rich.view.state)).toBe(0);
      expect(rich.view.state.selection.eq(Selection.atEnd(rich.view.state.doc))).toBe(true);
      rich.clock.advance(2000);
      await tick();
      expect(rich.editor.onValueChange).not.toHaveBeenCalled();
    } finally {
      rich.teardown();
    }
  });

  test('setMarkdown() during preview also becomes the new baseline, without a content callback', async () => {
    const rich = await mountRich({ value: 'Hello', placeholderDefinitions: DEFINITIONS });
    try {
      rich.view.dispatch(rich.view.state.tr.insertText('!', 6));
      rich.editor.set({ mode: 'preview' });
      rich.editor.onValueChange.mockClear();
      await untilPreviewReady(rich.editor, rich.clock);

      rich.editor.instance.setMarkdown('Set {{name}}');
      flushSync();
      expect(rich.editor.value).toBe('Set {{name}}');
      expect(rich.editor.previewContent()?.textContent).toContain('Set {{name}}');

      rich.editor.set({ mode: 'wysiwyg' });
      expect(undoDepth(rich.view.state)).toBe(0);
      expect(rich.editor.instance.getMarkdown().trim()).toBe('Set {{name}}');
      rich.clock.advance(2000);
      await tick();
      expect(rich.editor.onValueChange).not.toHaveBeenCalled();
    } finally {
      rich.teardown();
    }
  });

  test('returning to source keeps the textarea, its selection and its history', async () => {
    const editor = mountEditor({ value: '' });
    try {
      const textarea = editor.textarea();
      if (!textarea) throw new Error('Missing source textarea');
      textarea.focus();
      await typeText(textarea, 'abc');
      textarea.setSelectionRange(1, 2);

      editor.set({ mode: 'preview' });
      await untilPreviewReady(editor);
      editor.set({ placeholderDefinitions: DEFINITIONS, placeholderValues: {} });
      editor.set({ mode: 'source' });

      expect(editor.textarea()).toBe(textarea);
      expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([1, 2]);
      await undoSource(textarea);
      expect(textarea.value).toBe('ab');
      expect(editor.value).toBe('ab');
    } finally {
      editor.teardown();
    }
  });

  test('an external replacement during preview clears the source history', async () => {
    const editor = mountEditor({ value: '' });
    try {
      const textarea = editor.textarea();
      if (!textarea) throw new Error('Missing source textarea');
      textarea.focus();
      await typeText(textarea, 'abc');

      editor.set({ mode: 'preview' });
      editor.set({ value: 'External' });
      editor.set({ mode: 'source' });

      expect(textarea.value).toBe('External');
      await undoSource(textarea);
      expect(textarea.value).toBe('External');
    } finally {
      editor.teardown();
    }
  });
});

describe('MarkdownEditor preview render fencing', () => {
  type Renderer = Awaited<
    ReturnType<NonNullable<Parameters<typeof createMarkdownEditorPreview>[0]['load']>>
  >;

  /** A renderer whose import resolves only when the test says so. */
  function deferredRenderer() {
    const renderer = {
      renderMarkdown: mock(markdown.renderMarkdown),
      renderTemplate: mock(markdown.renderTemplate),
      resolveTemplatePlaceholders: mock(markdown.resolveTemplatePlaceholders),
      sortPlaceholderDiagnostics: mock(markdown.sortPlaceholderDiagnostics),
    } satisfies Renderer;
    let settle: ((value: Renderer) => void) | undefined;
    const load = mock(
      () =>
        new Promise<Renderer>((resolve) => {
          settle = resolve;
        }),
    );
    return {
      renderer,
      load,
      resolve: () => settle?.(renderer),
    };
  }

  function createPreview(load: () => Promise<Renderer>) {
    const inputs = createReactiveProps({
      active: false,
      source: 'A {{name}}',
      values: { name: 'one' },
    });
    const root = createEffectRootForTest(() =>
      createMarkdownEditorPreview({
        active: () => inputs.props['active'] === true,
        source: () => String(inputs.props['source']),
        fill: () =>
          planPreviewFill({
            definitions: DEFINITIONS,
            values: inputs.props['values'],
            valueMode: 'text',
            catalogEnabled: true,
          }),
        configurationIssues: () => [],
        load,
      }),
    );
    return { inputs, preview: root.value, destroy: root.destroy };
  }

  test('loads only once active, then renders the newest inputs, never an older render', async () => {
    const deferred = deferredRenderer();
    const { inputs, preview, destroy } = createPreview(deferred.load);
    try {
      flushSync();
      expect(deferred.load).not.toHaveBeenCalled();

      inputs.set('active', true);
      flushSync();
      expect(deferred.load).toHaveBeenCalledTimes(1);
      expect(preview.view.status).toBe('loading');

      // Inputs change while the import is still pending.
      inputs.set('source', 'B {{name}}');
      inputs.set('values', { name: 'two' });
      flushSync();
      deferred.resolve();
      await untilTrue(() => preview.view.status === 'ready');

      const view = preview.view;
      expect(view.status === 'ready' && view.html).toContain('B two');
      expect(view.status === 'ready' && view.html).not.toContain('A');
      expect(deferred.load).toHaveBeenCalledTimes(1);
    } finally {
      destroy();
    }
  });

  test('an import that completes after teardown never renders', async () => {
    const deferred = deferredRenderer();
    const { inputs, preview, destroy } = createPreview(deferred.load);
    inputs.set('active', true);
    flushSync();
    destroy();

    deferred.resolve();
    for (let iteration = 0; iteration < 5; iteration += 1) await tick();

    expect(preview.view.status).toBe('loading');
    expect(deferred.renderer.renderTemplate).not.toHaveBeenCalled();
    expect(deferred.renderer.renderMarkdown).not.toHaveBeenCalled();
  });

  test('planPreviewFill fills only with usable definitions, plain values and a valid value mode', () => {
    const base = {
      definitions: DEFINITIONS,
      values: {},
      valueMode: undefined,
      catalogEnabled: true,
    };
    expect(planPreviewFill(base)).toMatchObject({ kind: 'filled', valueMode: 'text' });
    expect(planPreviewFill({ ...base, valueMode: 'markdown' })).toMatchObject({
      valueMode: 'markdown',
    });
    expect(planPreviewFill({ ...base, values: undefined })).toEqual({
      kind: 'unfilled',
      template: true,
    });
    expect(planPreviewFill({ ...base, values: [] })).toEqual({ kind: 'unfilled', template: true });
    expect(planPreviewFill({ ...base, values: new Map() })).toEqual({
      kind: 'unfilled',
      template: true,
    });
    expect(planPreviewFill({ ...base, valueMode: 'html' })).toEqual({
      kind: 'unfilled',
      template: true,
    });
    expect(planPreviewFill({ ...base, catalogEnabled: false })).toEqual({
      kind: 'unfilled',
      template: true,
    });
    expect(planPreviewFill({ ...base, definitions: undefined, values: undefined })).toEqual({
      kind: 'unfilled',
      template: false,
    });
  });
});
