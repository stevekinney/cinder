/**
 * The attachment behind MarkdownEditor's source textarea: explicit editing
 * history for every source mount, and placeholder completion when it is
 * configured.
 *
 * Completion follows the rich editor's contract through the shared
 * completion modules: the same catalog, filter, sort, rows, option IDs,
 * status wording and keyboard. Token eligibility comes from
 * `parseMarkdownPlaceholderTokens` over the textarea value, so code, front
 * matter, math, HTML, link targets and escaped braces never open completion,
 * and backslash-escaped paths resolve. Configuration, readonly and value
 * are read reactively in their own effect roots, so none of them recreates
 * the textarea.
 */

import { parseMarkdownPlaceholderTokens, type PlaceholderToken } from '@lostgradient/markdown';
import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';

import { watchReactiveValue } from '../../editor/attach-reactive-watch.svelte.ts';
import { CompletionAnnouncer } from '../../editor/template-completion-announcer.ts';
import { completionKeyAction } from '../../editor/template-completion-keys.ts';
import { CompletionLookup } from '../../editor/template-completion-lookup.ts';
import {
  bindOutsideDismissal,
  placeholderOptionId,
} from '../../editor/template-completion-popup.ts';
import type { DetectedTokenQuery } from '../../editor/template-completion-query.ts';
import { locateTokenQuery } from '../../editor/template-completion-query.ts';
import {
  advanceCompletionState,
  INACTIVE_STATE,
  type CompletionMeta,
  type CompletionState,
} from '../../editor/template-completion-state.ts';
import type {
  PlaceholderCompletionSource,
  ResolvedPlaceholderConfiguration,
} from '../../editor/template-placeholder-configuration.ts';
import { SourceCompletionPopup } from './source-completion-popup.ts';
import {
  detectShortcutPlatform,
  diffSourceText,
  historyShortcut,
  SourceEditingHistory,
  type SourceSelection,
} from './source-editing-history.ts';

/** What the source attachment reads from, and reports to, MarkdownEditor. */
export interface SourceEditingOptions {
  /** The component's current Markdown `value`. */
  value: () => string;
  readonly: () => boolean;
  /** The resolved placeholder configuration shared with rich mode. */
  configuration: () => ResolvedPlaceholderConfiguration;
  /** The source listbox ID, `${id}-placeholder-listbox-source`. */
  listboxId: () => string;
  /** Where the listbox element lives in the DOM; it renders in the top layer. */
  popupContainer: () => HTMLElement | null;
  onStatusChange: (message: string) => void;
  /**
   * Publish a value the attachment wrote itself (an acceptance, undo or
   * redo) exactly once, as one `value` update and one change notification.
   */
  commitValue: (value: string) => void;
}

const TEXTBOX_ATTRIBUTES = [
  'aria-autocomplete',
  'aria-haspopup',
  'aria-controls',
  'aria-activedescendant',
] as const;

function setAttribute(element: HTMLElement, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function selectionOf(textarea: HTMLTextAreaElement): SourceSelection {
  return { start: textarea.selectionStart, end: textarea.selectionEnd };
}

/** Parse tokens once per distinct value; caret moves reuse the result. */
function createTokenCache(): (value: string) => readonly PlaceholderToken[] {
  let cachedValue: string | null = null;
  let cachedTokens: readonly PlaceholderToken[] = [];
  return (value) => {
    if (value !== cachedValue) {
      cachedValue = value;
      cachedTokens = parseMarkdownPlaceholderTokens(value);
    }
    return cachedTokens;
  };
}

/** The in-progress token at a collapsed textarea caret, in value offsets. */
export function detectSourceTokenQuery(
  value: string,
  selection: SourceSelection,
  tokens: readonly PlaceholderToken[],
): DetectedTokenQuery | null {
  if (selection.start !== selection.end) return null;
  const located = locateTokenQuery(value, selection.start, tokens, { markdownEscapes: true });
  if (!located) return null;
  return {
    query: located.query,
    tokenFrom: located.from,
    tokenTo: located.to,
    cursorPos: selection.start,
    marks: [],
  };
}

class SourceEditingController {
  readonly #textarea: HTMLTextAreaElement;
  readonly #options: SourceEditingOptions;
  readonly #listboxId: string;
  readonly #history = new SourceEditingHistory();
  readonly #platform = detectShortcutPlatform();
  readonly #tokens = createTokenCache();
  readonly #announcer: CompletionAnnouncer;
  readonly #lookup: CompletionLookup;
  readonly #cleanups: (() => void)[] = [];
  #popup: SourceCompletionPopup | null = null;
  #state: CompletionState = INACTIVE_STATE;
  #configuration: ResolvedPlaceholderConfiguration;
  #readonly: boolean;
  /** The value the history last recorded; every entry applies to it. */
  #recordedValue: string;
  /** The value of the latest input event, including input during composition. */
  #inputValue: string;
  #selectionBeforeInput: SourceSelection | null = null;
  #selectionBeforeComposition: SourceSelection | null = null;
  #composing = false;
  /** Set when the configuration changed while composition held updates. */
  #configurationChangePending = false;
  /** Set when an external value arrived while composition held updates. */
  #externalValuePending = false;
  /** A lookup result that arrived while composition held updates. */
  #pendingLookupMeta: CompletionMeta | null = null;
  #destroyed = false;

  constructor(textarea: HTMLTextAreaElement, options: SourceEditingOptions) {
    this.#textarea = textarea;
    this.#options = options;
    this.#listboxId = options.listboxId();
    this.#recordedValue = textarea.value;
    this.#inputValue = textarea.value;
    this.#configuration = options.configuration();
    this.#readonly = options.readonly();
    this.#announcer = new CompletionAnnouncer(options.onStatusChange);
    this.#lookup = new CompletionLookup((result) => {
      if (this.#destroyed) return;
      const meta: CompletionMeta = { type: 'asyncResults', ...result };
      // Composition holds every update; keep the result for compositionend,
      // where the state machine still discards it if it went stale.
      if (this.#composing) this.#pendingLookupMeta = meta;
      else this.#step({ meta });
    });
    this.#listen();
    this.#cleanups.push(
      watchReactiveValue(options.configuration, (configuration) =>
        this.#onConfiguration(configuration),
      ),
      watchReactiveValue(options.readonly, (readonly) => {
        this.#readonly = readonly;
        this.#step({});
      }),
      watchReactiveValue(options.value, (value) => this.#onValue(value)),
    );
  }

  destroy(): void {
    this.#destroyed = true;
    for (const cleanup of this.#cleanups.splice(0)) cleanup();
    this.#lookup.cancel();
    this.#popup?.destroy();
    this.#popup = null;
    for (const name of TEXTBOX_ATTRIBUTES) this.#textarea.removeAttribute(name);
    this.#announcer.clear();
    this.#history.clear();
    this.#state = INACTIVE_STATE;
  }

  #listen(): void {
    const textarea = this.#textarea;
    // Capture listeners run before the value binding's own listener, so each
    // input is recorded before the bound `value` reports it; otherwise the
    // value watch would mistake the user's typing for an external replacement.
    const listen = <Type extends keyof HTMLElementEventMap>(
      type: Type,
      listener: (event: HTMLElementEventMap[Type]) => void,
    ) => {
      textarea.addEventListener(type, listener, true);
      this.#cleanups.push(() => textarea.removeEventListener(type, listener, true));
    };
    const selectionChanged = () => this.#step({});
    listen('beforeinput', (event) => this.#onBeforeInput(event));
    listen('input', (event) => this.#onInput(event instanceof InputEvent && event.isComposing));
    listen('compositionstart', () => this.#onCompositionStart());
    listen('compositionend', () => this.#onCompositionEnd());
    listen('keydown', (event) => this.#onKeyDown(event));
    listen('keyup', selectionChanged);
    listen('pointerup', selectionChanged);
    listen('select', selectionChanged);
    listen('selectionchange', selectionChanged);
  }

  #completion(): PlaceholderCompletionSource | undefined {
    return this.#readonly ? undefined : this.#configuration.completion;
  }

  #popupOpen(): boolean {
    return (
      this.#completion() !== undefined && this.#state.active && this.#state.suggestions.length > 0
    );
  }

  #onConfiguration(configuration: ResolvedPlaceholderConfiguration): void {
    if (configuration === this.#configuration) return;
    this.#configuration = configuration;
    // A lookup belongs to the configuration it started under; cancel it even
    // while composition holds every other update.
    this.#lookup.cancel();
    this.#configurationChangePending = true;
    this.#step({});
  }

  #onValue(value: string): void {
    if (value === this.#recordedValue || value === this.#inputValue) return;
    if (this.#composing) {
      // Handled at compositionend, where the composed text is known.
      this.#externalValuePending = true;
      return;
    }
    // An external `value` or `setMarkdown` replacement starts a new baseline.
    this.#history.clear();
    this.#recordedValue = value;
    this.#inputValue = value;
    this.#step({ documentChanged: true });
  }

  #onBeforeInput(event: InputEvent): void {
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault();
      this.#replay(event.inputType === 'historyUndo' ? 'undo' : 'redo');
      return;
    }
    if (!this.#composing) this.#selectionBeforeInput = selectionOf(this.#textarea);
  }

  #onInput(isComposing: boolean): void {
    this.#inputValue = this.#textarea.value;
    if (this.#composing || isComposing) return;
    this.#recordInput(this.#selectionBeforeInput);
    this.#selectionBeforeInput = null;
    this.#step({ documentChanged: true });
  }

  #onCompositionStart(): void {
    this.#composing = true;
    this.#selectionBeforeComposition = selectionOf(this.#textarea);
  }

  #onCompositionEnd(): void {
    this.#composing = false;
    this.#inputValue = this.#textarea.value;
    if (this.#externalValuePending) {
      // The text the composition started from was replaced from outside, so
      // the result is a new baseline rather than an entry on the old history.
      this.#externalValuePending = false;
      this.#history.clear();
      this.#recordedValue = this.#textarea.value;
    } else {
      // One complete composition is one history entry.
      this.#recordInput(this.#selectionBeforeComposition);
    }
    this.#selectionBeforeComposition = null;
    this.#step({ documentChanged: true });
    const lookupMeta = this.#pendingLookupMeta;
    this.#pendingLookupMeta = null;
    if (lookupMeta) this.#step({ meta: lookupMeta });
  }

  /** Record the difference since the last recorded value as one entry. */
  #recordInput(selectionBefore: SourceSelection | null): void {
    const value = this.#textarea.value;
    const change = diffSourceText(this.#recordedValue, value);
    if (!change) return;
    const fallback = { start: change.from, end: change.from + change.removed.length };
    this.#history.record({
      ...change,
      selectionBefore: selectionBefore ?? fallback,
      selectionAfter: selectionOf(this.#textarea),
    });
    this.#recordedValue = value;
  }

  #replay(direction: 'undo' | 'redo'): void {
    if (this.#readonly || this.#composing) return;
    const textarea = this.#textarea;
    if (textarea.value !== this.#recordedValue) {
      // Something changed the text without an input event; its history no longer applies.
      this.#history.clear();
      this.#recordedValue = textarea.value;
      return;
    }
    const step =
      direction === 'undo'
        ? this.#history.undo(textarea.value)
        : this.#history.redo(textarea.value);
    if (!step) return;
    this.#write(step.value, step.selection);
    this.#step({ documentChanged: true });
  }

  /** Write text the attachment produced, then publish it once. */
  #write(value: string, selection: SourceSelection): void {
    const textarea = this.#textarea;
    textarea.value = value;
    textarea.setSelectionRange(selection.start, selection.end);
    this.#recordedValue = value;
    this.#inputValue = value;
    this.#options.commitValue(value);
  }

  #onKeyDown(event: KeyboardEvent): void {
    if (event.isComposing || this.#composing) return;
    const shortcut = historyShortcut(event, this.#platform);
    if (shortcut) {
      if (this.#readonly) return;
      event.preventDefault();
      this.#replay(shortcut);
      return;
    }
    if (!this.#popupOpen()) return;
    const action = completionKeyAction(event, this.#state);
    if (!action) return;
    if (action.type === 'navigate') {
      event.preventDefault();
      if (action.index !== this.#state.activeIndex) {
        this.#step({ meta: { type: 'navigate', index: action.index } });
      }
      return;
    }
    if (action.type === 'accept') {
      event.preventDefault();
      this.#accept(action.candidate.path);
      return;
    }
    // Tab keeps its native behavior (moving focus); Escape is consumed.
    this.#step({ meta: { type: 'dismiss' } });
    if (!action.consume) return;
    event.preventDefault();
    event.stopPropagation();
  }

  /** Replace the whole in-progress token with one canonical `{{path}}` as one entry. */
  #accept(path: string): void {
    const textarea = this.#textarea;
    const { tokenFrom, tokenTo } = this.#state;
    const replacement = `{{${path}}}`;
    const value = textarea.value;
    const caret = tokenFrom + replacement.length;
    this.#history.record({
      from: tokenFrom,
      removed: value.slice(tokenFrom, tokenTo),
      inserted: replacement,
      selectionBefore: selectionOf(textarea),
      selectionAfter: { start: caret, end: caret },
    });
    this.#write(value.slice(0, tokenFrom) + replacement + value.slice(tokenTo), {
      start: caret,
      end: caret,
    });
    this.#step({ meta: { type: 'close' } });
  }

  #acceptByPointer(index: number): void {
    const candidate = this.#state.suggestions[index];
    if (!candidate || !this.#popupOpen() || this.#composing) return;
    this.#accept(candidate.path);
    this.#textarea.focus({ preventScroll: true });
  }

  #step(step: { meta?: CompletionMeta; documentChanged?: boolean }): void {
    if (this.#destroyed || this.#composing) return;
    const textarea = this.#textarea;
    const configurationChanged = this.#configurationChangePending;
    this.#configurationChangePending = false;
    this.#state = advanceCompletionState(this.#state, this.#completion(), {
      meta: step.meta,
      documentChanged: step.documentChanged === true,
      configurationChanged,
      detect: () =>
        detectSourceTokenQuery(textarea.value, selectionOf(textarea), this.#tokens(textarea.value)),
    });
    this.#render();
  }

  #render(): void {
    const completion = this.#completion();
    const state = this.#state;
    if (!completion || !state.active) {
      this.#lookup.cancel();
      this.#popup?.hide();
      this.#syncTextbox(completion !== undefined, null);
      this.#announcer.clear();
      return;
    }
    if (state.query !== this.#lookup.query) this.#lookup.schedule(state.query, completion);
    const active = state.suggestions[state.activeIndex];
    if (state.suggestions.length > 0) {
      this.#ensurePopup().show(state, this.#listboxId, state.cursorPos);
    } else {
      this.#popup?.hide();
    }
    this.#syncTextbox(
      true,
      state.suggestions.length > 0 && active
        ? placeholderOptionId(this.#listboxId, active.path)
        : null,
    );
    this.#announcer.announceState(state);
  }

  #ensurePopup(): SourceCompletionPopup {
    if (this.#popup) return this.#popup;
    const textarea = this.#textarea;
    const container = this.#options.popupContainer() ?? textarea.ownerDocument.body;
    const popup = new SourceCompletionPopup(textarea, this.#listboxId, container, (index) =>
      this.#acceptByPointer(index),
    );
    // A pointerdown outside the listbox and the textarea dismisses without
    // preventing the event or moving focus.
    this.#cleanups.push(
      bindOutsideDismissal(textarea.ownerDocument, [popup.element, textarea], () => {
        if (this.#popupOpen()) this.#step({ meta: { type: 'dismiss' } });
      }),
    );
    this.#popup = popup;
    return popup;
  }

  #syncTextbox(configured: boolean, activeOptionId: string | null): void {
    const textarea = this.#textarea;
    setAttribute(textarea, 'aria-autocomplete', configured ? 'list' : null);
    setAttribute(textarea, 'aria-haspopup', configured ? 'listbox' : null);
    setAttribute(textarea, 'aria-controls', activeOptionId ? this.#listboxId : null);
    setAttribute(textarea, 'aria-activedescendant', activeOptionId);
  }
}

/**
 * Create the source textarea attachment. It owns the textarea's explicit
 * history from mount and placeholder completion whenever completion is
 * configured and the editor is not readonly; tearing it down removes every
 * listener, observer, measurement element, popup and pending callback.
 */
export function createSourceEditingAttachment(
  options: SourceEditingOptions,
): Attachment<HTMLTextAreaElement> {
  return (textarea) => {
    // The attachment runs inside an effect. Reading props while constructing
    // must not subscribe it, or a configuration, readonly or value change
    // would recreate the controller and drop its history.
    const controller = untrack(() => new SourceEditingController(textarea, options));
    return () => controller.destroy();
  };
}
