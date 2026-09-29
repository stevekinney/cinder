import type {
  PlaceholderCandidate,
  PlaceholderCompletionConfiguration,
} from '@lostgradient/markdown';
import { undoDepth } from '@milkdown/kit/prose/history';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { describe, expect, it, mock } from 'bun:test';
import { drainMount, installFakeClock } from '../test/fake-clock.ts';
import { createEditor, destroyEditor } from './editor.js';
import { templateCompletionPluginKey } from './template-completion-state.js';
import {
  createCompletionHarness,
  flushMicrotasks,
  flushTimers,
  makeCandidate,
  mountEditor,
} from './template-completion-test-utilities.js';
import { templateInvalidDecorationPluginKey } from './template-invalid-decoration-plugin.js';

describe('template completion async lookup lifecycle', () => {
  it('swallows aborted async lookup rejections without uncaught errors', async () => {
    const abortedQueries: string[] = [];
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      const deferredResolutions = new Map<string, (value: PlaceholderCandidate[]) => void>();
      const configuration: PlaceholderCompletionConfiguration = {
        candidates: [],
        minimumQueryLength: 1,
        lookupDebounceMs: 0,
        lookupCandidates: (query, signal) =>
          new Promise<PlaceholderCandidate[]>((resolve, reject) => {
            deferredResolutions.set(query, resolve);
            signal.addEventListener(
              'abort',
              () => {
                abortedQueries.push(query);
                reject(new Error(`aborted:${query}`));
              },
              { once: true },
            );
          }),
      };

      const harness = await createCompletionHarness(configuration);

      harness.typeText('a');
      await flushTimers();

      harness.typeText('b');
      await flushTimers();

      deferredResolutions.get('ab')?.([]);
      await flushMicrotasks();

      harness.pluginView.destroy?.();
      await flushTimers();

      expect(abortedQueries).toContain('a');
      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });

  it('keeps suggestions from the latest query when rapid typing causes overlapping lookups', async () => {
    type DeferredLookup = {
      resolve: (value: PlaceholderCandidate[]) => void;
      signal: AbortSignal;
    };
    const deferredByQuery = new Map<string, DeferredLookup>();

    const configuration: PlaceholderCompletionConfiguration = {
      candidates: [],
      minimumQueryLength: 1,
      lookupDebounceMs: 0,
      lookupCandidates: (query, signal) =>
        new Promise<PlaceholderCandidate[]>((resolve) => {
          deferredByQuery.set(query, { resolve, signal });
        }),
    };

    const harness = await createCompletionHarness(configuration);
    harness.typeText('a');
    await flushTimers();

    harness.typeText('b');
    await flushTimers();

    deferredByQuery.get('ab')?.resolve([makeCandidate('ab.latest')]);
    await flushMicrotasks();

    deferredByQuery.get('a')?.resolve([makeCandidate('a.stale')]);
    await flushMicrotasks();

    const pluginState = harness.getPluginState();

    expect(deferredByQuery.get('a')?.signal.aborted).toBe(true);
    expect(pluginState?.query).toBe('ab');
    expect(pluginState?.suggestions.map((candidate) => candidate.path)).toEqual(['ab.latest']);

    harness.pluginView.destroy?.();
  });
});

describe('template placeholder configuration lifecycle', () => {
  function suggestionPaths(view: EditorView): string[] | undefined {
    return templateCompletionPluginKey
      .getState(view.state)
      ?.suggestions.map((candidate) => candidate.path);
  }

  it('replaces definitions after mount without recreating the editor or firing a content callback', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onchange = mock((_markdown: string) => {});
    // A fake clock captures Milkdown's listener debounce and the change
    // debounce, so draining it proves no content callback was scheduled.
    const clock = installFakeClock();
    const state = await drainMount(
      createEditor(container, {
        initialContent: '{{',
        changeDebounceMs: 0,
        onchange,
        placeholders: { definitions: { candidates: [{ path: 'alpha' }] } },
      }),
      clock,
    );

    try {
      const { view } = state;
      view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));

      // High-level definitions open at zero query characters right after `{{`.
      expect(suggestionPaths(view)).toEqual(['alpha']);

      const documentBefore = view.state.doc;
      const selectionBefore = view.state.selection;
      const undoDepthBefore = undoDepth(view.state);
      const editingElementBefore = view.dom;

      state.setPlaceholderConfiguration({
        definitions: { candidates: [{ path: 'bravo' }, { path: 'beta' }] },
      });

      expect(suggestionPaths(view)).toEqual(['beta', 'bravo']);
      expect(state.view).toBe(view);
      expect(view.dom).toBe(editingElementBefore);
      expect(container.querySelectorAll('.ProseMirror')).toHaveLength(1);
      expect(view.state.doc).toBe(documentBefore);
      expect(view.state.selection.eq(selectionBefore)).toBe(true);
      expect(undoDepth(view.state)).toBe(undoDepthBefore);
      expect(state.hasPendingInternalChange()).toBe(false);

      clock.advance(1_000);
      expect(onchange).not.toHaveBeenCalled();
    } finally {
      clock.restore();
      await destroyEditor(state);
      container.remove();
    }
  });

  it('disables everything on conflict and resumes from fresh configuration', async () => {
    const editor = await mountEditor('{{ {{nope}}', {
      placeholders: { definitions: { candidates: [{ path: 'alpha' }] } },
    });
    try {
      editor.placeCaretAfter('{{');
      const documentBefore = editor.view.state.doc;
      const decorationCount = () =>
        templateInvalidDecorationPluginKey.getState(editor.view.state)?.decorations.find().length;
      expect(editor.suggestionPaths()).toEqual(['alpha']);
      expect(decorationCount()).toBe(1);

      editor.state.setPlaceholderConfiguration({
        definitions: { candidates: [{ path: 'alpha' }] },
        completion: { candidates: [{ path: 'low' }] },
      });
      expect(templateCompletionPluginKey.getState(editor.view.state)?.active).toBe(false);
      expect(decorationCount()).toBe(0);
      expect(editor.view.dom.hasAttribute('aria-autocomplete')).toBe(false);

      editor.state.setPlaceholderConfiguration({
        definitions: { candidates: [{ path: 'beta' }] },
      });
      expect(editor.suggestionPaths()).toEqual(['beta']);
      expect(decorationCount()).toBe(1);
      expect(editor.view.state.doc).toBe(documentBefore);
    } finally {
      await editor.destroy();
    }
  });

  it('handles emptied and removed definitions while the popup is open', async () => {
    const editor = await mountEditor('{{', {
      placeholders: { definitions: { candidates: [{ path: 'alpha' }] } },
    });
    try {
      editor.placeCaretAfter('{{');
      editor.state.setPlaceholderConfiguration({ definitions: { candidates: [] } });
      expect(templateCompletionPluginKey.getState(editor.view.state)?.active).toBe(true);
      expect(editor.suggestionPaths()).toEqual([]);

      editor.state.setPlaceholderConfiguration(undefined);
      expect(templateCompletionPluginKey.getState(editor.view.state)?.active).toBe(false);
      expect(editor.view.dom.hasAttribute('aria-autocomplete')).toBe(false);

      editor.state.setPlaceholderConfiguration({
        definitions: { candidates: [{ path: 'gamma' }] },
      });
      expect(editor.suggestionPaths()).toEqual(['gamma']);
    } finally {
      await editor.destroy();
    }
  });

  it('isolates configuration and listbox IDs between editor instances', async () => {
    const first = await mountEditor('{{', {
      placeholders: { definitions: { candidates: [{ path: 'one' }] } },
    });
    const second = await mountEditor('{{', {
      placeholders: { definitions: { candidates: [{ path: 'two' }] } },
    });
    try {
      first.placeCaretAfter('{{');
      second.placeCaretAfter('{{');
      first.state.setPlaceholderConfiguration({
        definitions: { candidates: [{ path: 'uno' }] },
      });

      expect(first.suggestionPaths()).toEqual(['uno']);
      expect(second.suggestionPaths()).toEqual(['two']);
      const firstListbox = first.view.dom.getAttribute('aria-controls');
      const secondListbox = second.view.dom.getAttribute('aria-controls');
      expect(firstListbox).toBeTruthy();
      expect(firstListbox).not.toBe(secondListbox);
    } finally {
      await first.destroy();
      await second.destroy();
    }
  });

  it('removes popup, listeners, attributes and status on teardown', async () => {
    const statusMessages: string[] = [];
    const editor = await mountEditor('{{', {
      placeholders: { definitions: { candidates: [{ path: 'alpha' }] } },
      placeholderListboxId: 'teardown-listbox',
      onPlaceholderStatusChange: (message) => statusMessages.push(message),
    });
    editor.placeCaretAfter('{{');
    const dom = editor.view.dom;
    expect(document.getElementById('teardown-listbox')).not.toBeNull();

    await editor.destroy();

    expect(document.getElementById('teardown-listbox')).toBeNull();
    expect(dom.hasAttribute('aria-autocomplete')).toBe(false);
    expect(dom.hasAttribute('aria-controls')).toBe(false);
    expect(statusMessages.at(-1)).toBe('');
    const outside = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(false);
  });
});

describe('low-level async lookup under reactive configuration', () => {
  it('aborts a pending lookup on configuration replacement and ignores its late result', async () => {
    const signals: AbortSignal[] = [];
    const resolvers: ((value: PlaceholderCandidate[]) => void)[] = [];
    const configuration: PlaceholderCompletionConfiguration = {
      candidates: [],
      minimumQueryLength: 1,
      lookupDebounceMs: 0,
      lookupCandidates: (_query, signal) =>
        new Promise<PlaceholderCandidate[]>((resolve) => {
          signals.push(signal);
          resolvers.push(resolve);
        }),
    };
    const harness = await createCompletionHarness(configuration);
    try {
      harness.typeText('a');
      await flushTimers();
      expect(signals).toHaveLength(1);

      harness.setConfiguration({ completion: { candidates: [makeCandidate('a.static')] } });
      expect(signals[0]?.aborted).toBe(true);

      resolvers[0]?.([makeCandidate('a.stale')]);
      await flushMicrotasks();
      expect(harness.getPluginState()?.suggestions.map((candidate) => candidate.path)).toEqual([
        'a.static',
      ]);
    } finally {
      harness.pluginView.destroy?.();
    }
  });

  it('aborts the old lookup when definitions replace it during composition', async () => {
    const signals: AbortSignal[] = [];
    const resolvers: ((value: PlaceholderCandidate[]) => void)[] = [];
    const harness = await createCompletionHarness({
      candidates: [],
      minimumQueryLength: 1,
      lookupDebounceMs: 0,
      lookupCandidates: (_query, signal) =>
        new Promise<PlaceholderCandidate[]>((resolve) => {
          signals.push(signal);
          resolvers.push(resolve);
        }),
    });
    try {
      harness.typeText('a');
      await flushTimers();
      expect(signals).toHaveLength(1);

      harness.view.composing = true;
      harness.setConfiguration({ definitions: { candidates: [{ path: 'alpha' }] } });
      expect(signals[0]?.aborted).toBe(true);

      resolvers[0]?.([makeCandidate('a.stale')]);
      await flushMicrotasks();
      harness.view.composing = false;
      harness.view.dom.dispatchEvent(new Event('compositionend'));
      await flushTimers();

      expect(harness.getPluginState()?.suggestions.map((candidate) => candidate.path)).toEqual([
        'alpha',
      ]);
    } finally {
      harness.pluginView.destroy?.();
    }
  });

  it('runs the replacement lookup after compositionend when low-level configuration changes mid-composition', async () => {
    const firstSignals: AbortSignal[] = [];
    const secondQueries: string[] = [];
    const secondResolvers: ((value: PlaceholderCandidate[]) => void)[] = [];
    const harness = await createCompletionHarness({
      candidates: [],
      minimumQueryLength: 1,
      lookupDebounceMs: 0,
      lookupCandidates: (_query, signal) =>
        new Promise<PlaceholderCandidate[]>(() => {
          firstSignals.push(signal);
        }),
    });
    try {
      harness.typeText('a');
      await flushTimers();
      expect(firstSignals).toHaveLength(1);

      harness.view.composing = true;
      harness.setConfiguration({
        completion: {
          candidates: [],
          minimumQueryLength: 1,
          lookupDebounceMs: 0,
          lookupCandidates: (query) =>
            new Promise<PlaceholderCandidate[]>((resolve) => {
              secondQueries.push(query);
              secondResolvers.push(resolve);
            }),
        },
      });
      expect(firstSignals[0]?.aborted).toBe(true);
      await flushTimers();
      expect(secondQueries).toEqual([]);

      harness.view.composing = false;
      harness.view.dom.dispatchEvent(new Event('compositionend'));
      // One timer resumes the view after composition; the lookup's own
      // debounce timer is scheduled from inside it.
      await flushTimers();
      await flushTimers();
      expect(secondQueries).toEqual(['a']);

      secondResolvers[0]?.([makeCandidate('a.second')]);
      await flushMicrotasks();
      expect(harness.getPluginState()?.suggestions.map((candidate) => candidate.path)).toEqual([
        'a.second',
      ]);
    } finally {
      harness.pluginView.destroy?.();
    }
  });

  it('never reopens the popup from a result that arrives after it closed', async () => {
    const resolvers: ((value: PlaceholderCandidate[]) => void)[] = [];
    const harness = await createCompletionHarness({
      candidates: [],
      minimumQueryLength: 1,
      lookupDebounceMs: 0,
      lookupCandidates: () =>
        new Promise<PlaceholderCandidate[]>((resolve) => {
          resolvers.push(resolve);
        }),
    });
    try {
      harness.typeText('a');
      await flushTimers();
      harness.view.dispatch(
        harness.view.state.tr.setSelection(TextSelection.atStart(harness.view.state.doc)),
      );
      resolvers[0]?.([makeCandidate('a.late')]);
      await flushMicrotasks();

      expect(harness.getPluginState()?.active).toBe(false);
      expect(harness.getPluginState()?.suggestions).toEqual([]);
    } finally {
      harness.pluginView.destroy?.();
    }
  });

  it('suspends popup updates during composition and resumes after compositionend', async () => {
    const harness = await createCompletionHarness({
      candidates: [makeCandidate('alpha'), makeCandidate('beta')],
      minimumQueryLength: 0,
    });
    try {
      const listbox = harness.view.dom.parentElement!.querySelector('[role="listbox"]')!;
      const renderedPaths = () =>
        [...listbox.querySelectorAll('[role="option"]')].map((option) =>
          option.id.split('-').at(-1),
        );
      expect(renderedPaths()).toEqual(['alpha', 'beta']);

      harness.view.composing = true;
      harness.typeText('b');
      expect(harness.getPluginState()?.query).toBe('b');
      expect(renderedPaths()).toEqual(['alpha', 'beta']);

      harness.view.composing = false;
      harness.view.dom.dispatchEvent(new Event('compositionend'));
      await flushTimers();
      expect(renderedPaths()).toEqual(['beta']);
    } finally {
      harness.pluginView.destroy?.();
    }
  });
});
