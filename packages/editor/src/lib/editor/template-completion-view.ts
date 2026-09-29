/**
 * The completion plugin's view: popup DOM, textbox ARIA, status
 * announcements, async lookup, composition and pointer handling.
 */

import type { PluginView } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import { acceptSuggestion } from './template-completion-acceptance.js';
import { CompletionAnnouncer } from './template-completion-announcer.js';
import { isCompletionPopupOpen } from './template-completion-keyboard.js';
import { CompletionLookup } from './template-completion-lookup.js';
import {
  bindOutsideDismissal,
  bindPopupPointerSelection,
  createPopupElement,
  limitVisibleRows,
  placeholderOptionId,
  positionPopup,
  renderSuggestions,
  type PopupPointerSelection,
} from './template-completion-popup.js';
import {
  INACTIVE_STATE,
  templateCompletionPluginKey,
  type CompletionMeta,
  type CompletionState,
} from './template-completion-state.js';
import { readPlaceholderConfiguration } from './template-placeholder-configuration-plugin.js';
import type { ResolvedPlaceholderConfiguration } from './template-placeholder-configuration.js';

export interface TemplateCompletionViewOptions {
  /** ID for the listbox; option IDs append `-${path}`. Generated when omitted. */
  listboxId?: string;
  /** Receives the text for a persistent polite status region. */
  onStatusChange?: (message: string) => void;
}

const TEXTBOX_ATTRIBUTES = [
  'aria-autocomplete',
  'aria-haspopup',
  'aria-controls',
  'aria-activedescendant',
] as const;

let generatedListboxCount = 0;

function nextListboxId(): string {
  generatedListboxCount += 1;
  return `template-placeholder-listbox-${generatedListboxCount}`;
}

function setAttribute(element: HTMLElement, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

class CompletionView implements PluginView {
  readonly #popup: HTMLElement;
  readonly #pointerSelection: PopupPointerSelection;
  readonly #listboxId: string;
  readonly #announcer: CompletionAnnouncer;
  readonly #lookup: CompletionLookup;
  readonly #cleanups: (() => void)[] = [];
  #view: EditorView;
  #configuration: ResolvedPlaceholderConfiguration;
  #refreshTimer: ReturnType<typeof setTimeout> | null = null;
  #destroyed = false;

  constructor(view: EditorView, options: TemplateCompletionViewOptions) {
    this.#view = view;
    this.#listboxId = options.listboxId ?? nextListboxId();
    this.#announcer = new CompletionAnnouncer(options.onStatusChange);
    this.#lookup = new CompletionLookup((result) => {
      if (!this.#destroyed) this.#dispatch({ type: 'asyncResults', ...result });
    });
    this.#configuration = readPlaceholderConfiguration(view.state);
    this.#popup = createPopupElement(this.#listboxId);
    (view.dom.parentElement ?? view.dom.ownerDocument.body).appendChild(this.#popup);

    this.#pointerSelection = bindPopupPointerSelection(this.#popup, (index) =>
      this.#acceptByPointer(index),
    );
    this.#cleanups.push(
      () => this.#pointerSelection.destroy(),
      bindOutsideDismissal(view.dom.ownerDocument, [this.#popup, view.dom], () => {
        if (isCompletionPopupOpen(this.#view)) this.#dispatch({ type: 'dismiss' });
      }),
    );
    const onCompositionEnd = () => this.#scheduleRefresh();
    view.dom.addEventListener('compositionend', onCompositionEnd);
    this.#cleanups.push(() => view.dom.removeEventListener('compositionend', onCompositionEnd));
    this.#sync();
  }

  update(view: EditorView): void {
    this.#view = view;
    this.#sync();
  }

  destroy(): void {
    this.#destroyed = true;
    this.#lookup.cancel();
    if (this.#refreshTimer !== null) clearTimeout(this.#refreshTimer);
    this.#refreshTimer = null;
    for (const cleanup of this.#cleanups.splice(0)) cleanup();
    this.#popup.remove();
    for (const name of TEXTBOX_ATTRIBUTES) this.#view.dom.removeAttribute(name);
    this.#announcer.clear();
  }

  #dispatch(meta: CompletionMeta): void {
    this.#view.dispatch(this.#view.state.tr.setMeta(templateCompletionPluginKey, meta));
  }

  #acceptByPointer(index: number): void {
    const view = this.#view;
    const state = templateCompletionPluginKey.getState(view.state);
    const candidate = state?.suggestions[index];
    if (!state || !candidate || !isCompletionPopupOpen(view) || view.composing) return;
    acceptSuggestion(view, candidate, state);
    view.focus();
  }

  #scheduleRefresh(): void {
    if (this.#refreshTimer !== null) clearTimeout(this.#refreshTimer);
    // Let ProseMirror finish reading the composed text before resuming updates.
    this.#refreshTimer = setTimeout(() => {
      this.#refreshTimer = null;
      if (!this.#destroyed) this.#sync();
    }, 0);
  }

  #sync(): void {
    if (this.#destroyed) return;
    const view = this.#view;
    const configuration = readPlaceholderConfiguration(view.state);
    const configurationChanged = configuration !== this.#configuration;
    this.#configuration = configuration;
    // A lookup belongs to the configuration it was started under; cancel it
    // before anything else, including the composition pause below.
    if (configurationChanged) this.#lookup.cancel();
    const completion = view.editable ? configuration.completion : undefined;
    const state = templateCompletionPluginKey.getState(view.state) ?? INACTIVE_STATE;

    if (!completion || !state.active) {
      this.#lookup.cancel();
      this.#hide();
      this.#syncTextbox(completion !== undefined, null);
      this.#announcer.clear();
      return;
    }
    // Composition suspends candidate updates until compositionend.
    if (view.composing) return;

    if (state.query !== this.#lookup.query) this.#lookup.schedule(state.query, completion);
    this.#render(state);
  }

  #render(state: CompletionState): void {
    const open = state.suggestions.length > 0;
    if (open) {
      this.#popup.style.display = '';
      this.#pointerSelection.setOpen(true);
      renderSuggestions(this.#popup, state, this.#listboxId);
      limitVisibleRows(this.#popup);
      positionPopup(this.#popup, this.#view, state.cursorPos);
    } else {
      this.#hide();
    }
    const active = state.suggestions[state.activeIndex];
    this.#syncTextbox(
      true,
      open && active ? placeholderOptionId(this.#listboxId, active.path) : null,
    );
    this.#announcer.announceState(state);
  }

  #hide(): void {
    this.#popup.style.display = 'none';
    this.#pointerSelection.setOpen(false);
  }

  #syncTextbox(configured: boolean, activeOptionId: string | null): void {
    const dom = this.#view.dom;
    setAttribute(dom, 'aria-autocomplete', configured ? 'list' : null);
    setAttribute(dom, 'aria-haspopup', configured ? 'listbox' : null);
    setAttribute(dom, 'aria-controls', activeOptionId ? this.#listboxId : null);
    setAttribute(dom, 'aria-activedescendant', activeOptionId);
  }
}

export function createCompletionView(
  view: EditorView,
  options: TemplateCompletionViewOptions,
): PluginView {
  return new CompletionView(view, options);
}
