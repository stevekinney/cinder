/**
 * Shared helpers for the template completion and decoration tests.
 *
 * DEP-583, COR-526: a small ProseMirror schema (with marks, inline code and a
 * code block) for model-level tests, a plugin harness for the completion view
 * lifecycle, and a real Milkdown editor mount for end-to-end behavior. The
 * happy-dom preload supplies the DOM.
 */

import type {
  PlaceholderCandidate,
  PlaceholderCompletionConfiguration,
} from '@lostgradient/markdown';
import { Schema } from '@milkdown/kit/prose/model';
import type { Plugin, Transaction } from '@milkdown/kit/prose/state';
import { EditorState, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { createEditor, destroyEditor } from './editor.js';
import type { LazyProsePlugin } from './milkdown-plugin-runtime.js';
import { createTemplateCompletionPlugin } from './template-completion-plugin.js';
import { templateCompletionPluginKey } from './template-completion-state.js';
import {
  createPlaceholderConfigurationTransaction,
  createTemplatePlaceholderConfigurationPlugin,
} from './template-placeholder-configuration-plugin.js';
import {
  resolvePlaceholderConfiguration,
  type PlaceholderCompletionSource,
  type PlaceholderEditorConfiguration,
} from './template-placeholder-configuration.js';
import type { EditorConfig, EditorState as EditorHandleState } from './types.js';

// ---------------------------------------------------------------------------
// Test schema
// ---------------------------------------------------------------------------

export const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() {
        return ['p', 0];
      },
    },
    code_block: {
      content: 'text*',
      group: 'block',
      code: true,
      marks: '',
      toDOM() {
        return ['pre', ['code', 0]];
      },
    },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      toDOM() {
        return ['br'];
      },
    },
    text: { group: 'inline' },
  },
  marks: {
    strong: {
      toDOM() {
        return ['strong', 0];
      },
    },
    inlineCode: {
      code: true,
      toDOM() {
        return ['code', 0];
      },
    },
    link: {
      attrs: { href: {} },
      toDOM(mark) {
        return ['a', { href: String(mark.attrs['href']) }, 0];
      },
    },
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function makeCandidate(path: string, description?: string): PlaceholderCandidate {
  return { path, types: ['string'], ...(description === undefined ? {} : { description }) };
}

export function makeCandidates(...paths: string[]): PlaceholderCandidate[] {
  return paths.map((path) => makeCandidate(path));
}

/** Resolve a low-level completion configuration the way the editor does. */
export function completionSource(
  configuration: PlaceholderCompletionConfiguration,
): PlaceholderCompletionSource {
  const source = resolvePlaceholderConfiguration({ completion: configuration }).completion;
  if (!source) throw new Error('completion source was not resolved');
  return source;
}

/**
 * Create an EditorState with a single paragraph containing the given text
 * and the cursor positioned at the specified character offset within the
 * paragraph content.
 *
 * When `cursorOffset` is omitted the selection defaults to the end of the
 * document (ProseMirror's default).
 */
export function createStateWithText(text: string, cursorOffset?: number): EditorState {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, text ? [schema.text(text)] : []),
  ]);
  const state = EditorState.create({ doc, schema });

  if (cursorOffset !== undefined) {
    // Position = 1 (doc open) + cursorOffset (within paragraph content).
    return state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1 + cursorOffset)));
  }

  return state;
}

/**
 * Create an EditorState whose first block holds `inline` nodes, with the
 * caret at document position `caret`.
 */
export function createStateWithInline(
  inline: Parameters<typeof schema.node>[2],
  caret: number,
  blockType: 'paragraph' | 'code_block' = 'paragraph',
): EditorState {
  const doc = schema.node('doc', null, [schema.node(blockType, null, inline)]);
  const state = EditorState.create({ doc, schema });
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, caret)));
}

/**
 * Create an EditorState with a non-collapsed (range) selection.
 */
export function createStateWithSelection(text: string, from: number, to: number): EditorState {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, text ? [schema.text(text)] : []),
  ]);
  const state = EditorState.create({ doc, schema });

  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1 + from, 1 + to)));
}

export function createStateWithTextAndPlugins(
  text: string,
  cursorOffset: number,
  plugins: readonly Plugin[],
): EditorState {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, text ? [schema.text(text)] : []),
  ]);
  const state = EditorState.create({ doc, schema, plugins: [...plugins] });

  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1 + cursorOffset)));
}

// ---------------------------------------------------------------------------
// Plugin harness
// ---------------------------------------------------------------------------

/** Register a lazy Milkdown plugin against a minimal fake ctx and return its ProseMirror plugin. */
async function registerLazyPlugin(lazyPlugin: LazyProsePlugin): Promise<Plugin> {
  // createLazyProsePlugin's outer function also calls ctx.record/ctx.update
  // when the Milkdown runtime cache is primed, so this fake ctx tolerates both.
  const context = {
    wait: async () => {},
    record: () => {},
    done: () => {},
    clearTimer: () => {},
    update: (_slice: unknown, _updater: (value: unknown) => unknown) => {},
  };
  const initializePlugin = Reflect.apply(lazyPlugin, null, [context]);
  await initializePlugin();
  return lazyPlugin.plugin();
}

type CompletionHarness = {
  view: TestView;
  pluginView: {
    update?: (...args: unknown[]) => unknown;
    destroy?: () => void;
  };
  typeText: (text: string) => void;
  setConfiguration: (configuration: PlaceholderEditorConfiguration) => void;
  getPluginState: () => ReturnType<typeof templateCompletionPluginKey.getState>;
};

type TestView = {
  state: EditorState;
  dom: HTMLElement;
  editable: boolean;
  composing: boolean;
  dispatch: (transaction: Transaction) => void;
  focus: () => void;
  coordsAtPos: () => { left: number; right: number; top: number; bottom: number };
};

export async function createCompletionHarness(
  configuration: PlaceholderCompletionConfiguration,
  text = '{{',
): Promise<CompletionHarness> {
  const initial = resolvePlaceholderConfiguration({ completion: configuration });
  const configurationPlugin = await registerLazyPlugin(
    createTemplatePlaceholderConfigurationPlugin(initial),
  );
  const prosePlugin = await registerLazyPlugin(createTemplateCompletionPlugin());
  let state = createStateWithTextAndPlugins(text, text.length, [configurationPlugin, prosePlugin]);

  const container = document.createElement('div');
  const dom = document.createElement('div');
  container.appendChild(dom);
  document.body.appendChild(container);

  let pluginView: CompletionHarness['pluginView'] = {};
  const view: TestView = {
    get state() {
      return state;
    },
    set state(nextState: EditorState) {
      state = nextState;
    },
    dom,
    editable: true,
    composing: false,
    dispatch(transaction: Transaction) {
      const previousState = state;
      state = state.apply(transaction);
      if (pluginView.update) Reflect.apply(pluginView.update, pluginView, [view, previousState]);
    },
    focus() {},
    coordsAtPos() {
      return { left: 0, right: 0, top: 0, bottom: 0 };
    },
  };

  pluginView = prosePlugin.spec.view ? Reflect.apply(prosePlugin.spec.view, null, [view]) : {};

  return {
    view,
    pluginView,
    typeText(inputText: string) {
      for (const character of inputText) {
        const cursorPosition = state.selection.from;
        const transaction = state.tr.insertText(character, cursorPosition, cursorPosition);
        view.dispatch(transaction);
      }
    },
    setConfiguration(next: PlaceholderEditorConfiguration) {
      view.dispatch(
        createPlaceholderConfigurationTransaction(state, resolvePlaceholderConfiguration(next)),
      );
    },
    getPluginState() {
      return templateCompletionPluginKey.getState(state);
    },
  };
}

export async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

export async function flushTimers(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushMicrotasks();
}

// ---------------------------------------------------------------------------
// Real editor mount
// ---------------------------------------------------------------------------

export type MountedEditor = {
  state: EditorHandleState;
  view: EditorView;
  container: HTMLElement;
  /** Put a collapsed caret right after the first occurrence of `marker` in the document text. */
  placeCaretAfter: (marker: string) => void;
  /** Type text at the caret through ProseMirror's text input handling. */
  type: (text: string) => void;
  /** Dispatch a keydown on the editing element; returns whether it was prevented. */
  press: (key: string, init?: KeyboardEventInit) => boolean;
  suggestionPaths: () => string[] | undefined;
  destroy: () => Promise<void>;
};

export async function mountEditor(
  initialContent: string,
  config: Omit<EditorConfig, 'initialContent'> = {},
): Promise<MountedEditor> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const state = await createEditor(container, { initialContent, ...config });
  const { view } = state;

  const placeCaretAfter = (marker: string) => {
    let target: number | null = null;
    view.state.doc.descendants((node, position) => {
      if (target !== null || !node.isText) return target === null;
      const index = node.text?.indexOf(marker) ?? -1;
      if (index >= 0) target = position + index + marker.length;
      return false;
    });
    if (target === null) throw new Error(`marker not found: ${marker}`);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, target)));
  };

  return {
    state,
    view,
    container,
    placeCaretAfter,
    type(text: string) {
      for (const character of text) {
        const { from, to } = view.state.selection;
        const handled = view.someProp('handleTextInput', (handler) =>
          handler(view, from, to, character, () => view.state.tr.insertText(character, from, to)),
        );
        if (!handled) view.dispatch(view.state.tr.insertText(character, from, to));
      }
    },
    press(key: string, init: KeyboardEventInit = {}) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
      view.dom.dispatchEvent(event);
      return event.defaultPrevented;
    },
    suggestionPaths() {
      return templateCompletionPluginKey
        .getState(view.state)
        ?.suggestions.map((candidate) => candidate.path);
    },
    async destroy() {
      await destroyEditor(state);
      container.remove();
    },
  };
}
