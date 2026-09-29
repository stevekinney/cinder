/// <reference lib="dom" />
/**
 * COR-526: MarkdownEditor placeholder props — reactive definitions,
 * diagnostics reporting, configuration errors and assistive-technology wiring.
 */
import type { PlaceholderDiagnostic } from '@lostgradient/markdown';
import { setupHappyDom } from '@lostgradient/testing';
import { describe, expect, mock, test } from 'bun:test';
import { tick } from 'svelte';
import type { FakeClock } from '../../test/fake-clock.ts';
import { installFakeClock } from '../../test/fake-clock.ts';
import type { MarkdownEditorProps } from './markdown-editor.types.ts';

setupHappyDom();

const [{ default: MarkdownEditor }, { cleanup, render }] = await Promise.all([
  import('./markdown-editor.svelte'),
  import('@testing-library/svelte'),
]);

const INSTRUCTIONS =
  'Type two opening braces to insert a placeholder. Use arrow keys and Enter to choose; Escape or Tab dismisses.';

async function pollUntil(condition: () => boolean, clock: FakeClock): Promise<void> {
  for (let iteration = 0; iteration < 200; iteration += 1) {
    if (condition()) return;
    await tick();
    clock.advance(20);
  }
  throw new Error('pollUntil: condition did not become true within 200 iterations');
}

async function settle(clock: FakeClock): Promise<void> {
  for (let iteration = 0; iteration < 5; iteration += 1) {
    await tick();
    clock.advance(20);
  }
}

function editingElement(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('.ProseMirror');
}

function isReady(container: HTMLElement): boolean {
  return editingElement(container) !== null;
}

type Diagnostics = readonly PlaceholderDiagnostic[];

async function mountEditor(props: Omit<MarkdownEditorProps, 'id'>) {
  const clock = installFakeClock();
  const reports: Diagnostics[] = [];
  const onPlaceholderDiagnosticsChange = mock((diagnostics: Diagnostics) => {
    reports.push(diagnostics);
  });
  const result = render(MarkdownEditor, {
    props: {
      id: 'notes',
      label: 'Notes',
      toolbarEnabled: false,
      onPlaceholderDiagnosticsChange,
      ...props,
    } as MarkdownEditorProps,
  });
  await pollUntil(() => isReady(result.container), clock);
  await settle(clock);
  return {
    result,
    clock,
    reports,
    async update(next: Partial<MarkdownEditorProps>) {
      await result.rerender(next as MarkdownEditorProps);
      await settle(clock);
    },
    teardown() {
      clock.restore();
      result.unmount();
      cleanup();
    },
  };
}

function summary(diagnostics: Diagnostics) {
  return diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    location: diagnostic.location,
  }));
}

describe('MarkdownEditor placeholder definitions', () => {
  test('reports token diagnostics with Markdown value offsets and wires the regions', async () => {
    const editor = await mountEditor({
      value: 'Hi {{nope}} and {{ok}}',
      'aria-describedby': 'caller-hint',
      placeholderDefinitions: { candidates: [{ path: 'ok' }] },
    });
    try {
      const { container } = editor.result;
      expect(summary(editor.reports.at(-1) ?? [])).toEqual([
        { code: 'unknown_placeholder', location: { kind: 'token', startOffset: 3, endOffset: 11 } },
      ]);
      expect(editor.reports).toHaveLength(1);

      const status = container.querySelector('#notes-placeholder-status');
      expect(status?.getAttribute('role')).toBe('status');
      expect(status?.getAttribute('aria-live')).toBe('polite');
      expect(status?.getAttribute('aria-atomic')).toBe('true');
      expect(container.querySelector('#notes-placeholder-instructions')?.textContent).toBe(
        INSTRUCTIONS,
      );
      expect(container.querySelector('#notes-placeholder-diagnostics')?.textContent).toContain(
        'nope',
      );

      const editing = editingElement(container)!;
      expect(editing.getAttribute('aria-describedby')).toBe(
        'caller-hint notes-placeholder-instructions notes-placeholder-diagnostics',
      );
      expect(editing.getAttribute('aria-autocomplete')).toBe('list');
      expect(editing.getAttribute('aria-multiline')).toBe('true');
      const decorated = container.querySelector('[data-placeholder-validation-reason]');
      expect(decorated?.getAttribute('data-placeholder-validation-reason')).toBe(
        'unknown_placeholder',
      );
    } finally {
      editor.teardown();
    }
  });

  test('replacing definitions revalidates in place and clears diagnostics exactly once', async () => {
    const onValueChange = mock((_value: string) => {});
    const editor = await mountEditor({
      value: 'Hi {{nope}}',
      onValueChange,
      placeholderDefinitions: { candidates: [] },
    });
    try {
      const { container } = editor.result;
      const editingBefore = editingElement(container);
      expect(editor.reports).toHaveLength(1);

      await editor.update({ placeholderDefinitions: { candidates: [{ path: 'nope' }] } });
      expect(editor.reports).toHaveLength(2);
      expect(editor.reports.at(-1)).toEqual([]);
      expect(editingElement(container)).toBe(editingBefore);
      expect(container.querySelector('#notes-placeholder-diagnostics')).toBeNull();
      expect(editingElement(container)?.getAttribute('aria-describedby')).toBe(
        'notes-placeholder-instructions',
      );

      await editor.update({ placeholderDefinitions: { candidates: [{ path: 'nope' }] } });
      await editor.update({ placeholderDefinitions: undefined });
      expect(editor.reports).toHaveLength(2);
      expect(editingElement(container)).toBe(editingBefore);
      expect(editingElement(container)?.hasAttribute('aria-autocomplete')).toBe(false);
      expect(onValueChange).not.toHaveBeenCalled();
    } finally {
      editor.teardown();
    }
  });

  test('removing the last configuration clears earlier diagnostics exactly once', async () => {
    const editor = await mountEditor({
      value: '{{nope}}',
      placeholderDefinitions: { candidates: [] },
    });
    try {
      await editor.update({ placeholderDefinitions: undefined });
      await editor.update({ value: '{{still}} {{nope}}' });

      expect(editor.reports.map((report) => report.length)).toEqual([1, 0]);
    } finally {
      editor.teardown();
    }
  });

  test('does nothing without placeholder configuration', async () => {
    const editor = await mountEditor({ value: 'Hi {{nope}} {{' });
    try {
      const { container } = editor.result;
      expect(editor.reports).toEqual([]);
      expect(container.querySelector('#notes-placeholder-instructions')).toBeNull();
      expect(container.querySelector('#notes-placeholder-diagnostics')).toBeNull();
      expect(container.querySelector('#notes-placeholder-status')?.textContent).toBe('');
      expect(container.querySelector('[data-placeholder-validation-reason]')).toBeNull();
      expect(editingElement(container)?.hasAttribute('aria-autocomplete')).toBe(false);
      expect(editingElement(container)?.hasAttribute('aria-describedby')).toBe(false);
    } finally {
      editor.teardown();
    }
  });

  test('reports values supplied without definitions or with the wrong shape', async () => {
    const editor = await mountEditor({ value: '{{nope}}', placeholderValues: { name: 'Ada' } });
    try {
      expect(editor.reports.at(-1)?.map((diagnostic) => diagnostic.code)).toEqual([
        'invalid_definitions',
      ]);
      expect(editor.reports.at(-1)?.[0]?.location).toEqual({
        kind: 'configuration',
        property: 'placeholderDefinitions',
      });
      expect(JSON.stringify(editor.reports)).not.toContain('Ada');

      await editor.update({ placeholderValues: ['Ada'] as never });
      expect(editor.reports.at(-1)?.map((diagnostic) => diagnostic.code)).toEqual([
        'invalid_definitions',
        'invalid_values',
      ]);
    } finally {
      editor.teardown();
    }
  });

  test('rejects mixed high- and low-level configuration and recovers when it is removed', async () => {
    const editor = await mountEditor({
      value: '{{nope}}',
      placeholderDefinitions: { candidates: [] },
      placeholderCompletion: { candidates: [] },
    });
    try {
      const { container } = editor.result;
      expect(editor.reports.at(-1)?.map((diagnostic) => diagnostic.code)).toEqual([
        'conflicting_configuration',
      ]);
      expect(editingElement(container)?.hasAttribute('aria-autocomplete')).toBe(false);
      expect(container.querySelector('[data-placeholder-validation-reason]')).toBeNull();

      await editor.update({ placeholderCompletion: undefined });
      expect(editor.reports.at(-1)?.map((diagnostic) => diagnostic.code)).toEqual([
        'unknown_placeholder',
      ]);
      expect(editingElement(container)?.getAttribute('aria-autocomplete')).toBe('list');
    } finally {
      editor.teardown();
    }
  });
});

describe('MarkdownEditor placeholder round trip', () => {
  test('an escaped underscore path in the serialized value is still a declared placeholder', async () => {
    const editor = await mountEditor({
      value: 'Hi {{user_name}} and {{missing}}',
      placeholderDefinitions: { candidates: [{ path: 'user_name' }] },
    });
    try {
      // The rich editor serializes `_` as `\\_`; feed that value back the way
      // a bound parent does and diagnose it.
      const component = editor.result.component as unknown as { getMarkdown(): string };
      const serialized = component.getMarkdown();
      expect(serialized).toContain('{{user\\_name}}');

      await editor.update({ value: serialized });

      const latest = editor.reports.at(-1) ?? [];
      expect(latest.map((diagnostic) => diagnostic.code)).toEqual(['unknown_placeholder']);
      expect(latest.some((diagnostic) => diagnostic.code === 'invalid_path_format')).toBe(false);
      const location = latest[0]?.location;
      expect(location?.kind).toBe('token');
      if (location?.kind === 'token') {
        expect(serialized.slice(location.startOffset, location.endOffset)).toBe('{{missing}}');
        expect(location.startOffset).toBe('Hi {{user\\_name}} and '.length);
      }
    } finally {
      editor.teardown();
    }
  });
});

describe('MarkdownEditor placeholder prop types', () => {
  test('reject mixing definitions with the low-level props', () => {
    const acceptsProps = (_props: MarkdownEditorProps) => {};
    const catalog = { candidates: [] };
    const definitionsProps = { id: 'a', placeholderDefinitions: catalog };

    acceptsProps(definitionsProps);
    acceptsProps({ id: 'a', placeholderCompletion: catalog, placeholderDecoration: catalog });
    // @ts-expect-error placeholderDefinitions cannot be combined with placeholderCompletion.
    acceptsProps({ ...definitionsProps, placeholderCompletion: catalog });
    // @ts-expect-error placeholderDefinitions cannot be combined with placeholderDecoration.
    acceptsProps({ ...definitionsProps, placeholderDecoration: catalog });
    expect(true).toBe(true);
  });
});
