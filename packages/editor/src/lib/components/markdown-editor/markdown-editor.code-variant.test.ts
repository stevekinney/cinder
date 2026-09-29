/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

setupHappyDom();

const [{ default: MarkdownEditor }, { cleanup, render, fireEvent }] = await Promise.all([
  import('./markdown-editor.svelte'),
  import('@testing-library/svelte'),
]);

function requiredInstance<T>(value: unknown, ctor: new (...args: never[]) => T): T {
  if (!(value instanceof ctor)) {
    throw new Error(`Expected an instance of ${ctor.name}, got ${String(value)}`);
  }
  return value;
}

/**
 * COR-485: raw mode used to render a bare `<textarea>` with hand-rolled
 * mono metrics and no explicit background, which let the browser's own
 * dark-mode form-control UA styling (a visibly gray `rgb(59,59,59)`) leak
 * through instead of Cinder's surface tokens. It now composes the base
 * `Textarea` component's `variant="code"`, so these assertions pin the
 * composed contract rather than the CSS values themselves (already covered
 * by textarea.test.ts) — the regression this guards against is markdown-editor
 * quietly reverting to a bare textarea that drops the variant.
 */
describe('MarkdownEditor raw mode composes Textarea variant="code"', () => {
  test('the raw-mode control carries the code-variant class and data attribute', async () => {
    try {
      const { container } = render(MarkdownEditor, {
        props: {
          id: 'code-variant-editor',
          label: 'Code variant editor',
          mode: 'source',
          toolbarEnabled: false,
          value: '# Heading',
        },
      });

      const textarea = requiredInstance(
        container.querySelector('textarea.markdown-editor.source-mode'),
        HTMLTextAreaElement,
      );
      expect(textarea.classList.contains('cinder-textarea')).toBe(true);
      expect(textarea.getAttribute('data-cinder-variant')).toBe('code');
      expect(textarea.value).toBe('# Heading');
    } finally {
      cleanup();
    }
  });

  test('typing in raw mode propagates up through both bind:value layers to the component API', async () => {
    // `value` now flows MarkdownEditor.value <-bind:-> Textarea.value
    // <-bind:-> native textarea.value — a second $bindable layer where
    // there used to be one. Asserting `textarea.value` alone (the DOM node
    // fireEvent.input just wrote to directly) would prove nothing about
    // that chain; `getMarkdown()` reads MarkdownEditor's OWN `value` state
    // in source mode (`editorState?.getMarkdown() ?? value`, and
    // `editorState` is null outside wysiwyg), so it only reflects the typed
    // string if both bind:value layers actually propagated the DOM event.
    let lastChange: string | undefined;
    try {
      const result = render(MarkdownEditor, {
        props: {
          id: 'code-variant-editor-live',
          label: 'Code variant editor',
          mode: 'source',
          toolbarEnabled: false,
          value: '',
          onValueChange: (next: string) => {
            lastChange = next;
          },
        },
      });

      const textarea = requiredInstance(
        result.container.querySelector('textarea.markdown-editor.source-mode'),
        HTMLTextAreaElement,
      );
      await fireEvent.input(textarea, { target: { value: '## Updated' } });
      await tick();

      expect(result.component.getMarkdown()).toBe('## Updated');
      expect(lastChange).toBe('## Updated');
    } finally {
      cleanup();
    }
  });

  test('setMarkdown() reaches the native control through both bind:value layers', async () => {
    // The opposite direction from the previous test: a parent-driven,
    // imperative write through the exported `setMarkdown()` API must reach
    // the actual DOM textarea's `.value`, not just MarkdownEditor's own
    // `value` state — proving the top-down half of the same two-layer chain.
    try {
      const result = render(MarkdownEditor, {
        props: {
          id: 'code-variant-editor-imperative',
          label: 'Code variant editor',
          mode: 'source',
          toolbarEnabled: false,
          value: 'original',
        },
      });

      result.component.setMarkdown('# from parent');
      await tick();

      const textarea = requiredInstance(
        result.container.querySelector('textarea.markdown-editor.source-mode'),
        HTMLTextAreaElement,
      );
      expect(textarea.value).toBe('# from parent');
    } finally {
      cleanup();
    }
  });

  test('readonly passes through to the native attribute without disabling the control', async () => {
    try {
      const { container } = render(MarkdownEditor, {
        props: {
          id: 'code-variant-editor-readonly',
          label: 'Code variant editor',
          mode: 'source',
          toolbarEnabled: false,
          value: 'locked content',
          readonly: true,
        },
      });

      const textarea = requiredInstance(
        container.querySelector('textarea.markdown-editor.source-mode'),
        HTMLTextAreaElement,
      );
      expect(textarea.readOnly).toBe(true);
      expect(textarea.disabled).toBe(false);
    } finally {
      cleanup();
    }
  });

  test('the accessible name and description reach the control directly, not a wrapper label', async () => {
    try {
      const { container } = render(MarkdownEditor, {
        props: {
          id: 'code-variant-editor-a11y',
          label: 'Prompt source',
          mode: 'source',
          toolbarEnabled: false,
          value: '',
          'aria-describedby': 'external-hint',
        },
      });

      const textarea = requiredInstance(
        container.querySelector('textarea.markdown-editor.source-mode'),
        HTMLTextAreaElement,
      );
      expect(textarea.getAttribute('aria-label')).toBe('Prompt source');
      expect(textarea.getAttribute('aria-describedby')).toBe('external-hint');
      // Textarea's FormFieldFrame wrapper renders no visible <label> here —
      // there is no `label` prop passed to the underlying field, only aria-label
      // on the control, matching the WYSIWYG surface's own aria-label-only pattern.
      expect(container.querySelector('label')).toBeNull();

      // Every id in the composed subtree stays unique — Textarea's FormFieldFrame
      // wrapper must not duplicate the control's own id onto itself.
      const ids = Array.from(container.querySelectorAll('[id]')).map((el) => el.id);
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      cleanup();
    }
  });
});
