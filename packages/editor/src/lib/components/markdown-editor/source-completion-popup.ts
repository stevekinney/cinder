/**
 * The placeholder listbox for MarkdownEditor's source textarea.
 *
 * It reuses the rich editor's listbox DOM (rows, option IDs, eight visible
 * rows, pointer selection) and adds what a textarea needs: the popup sits in
 * the top layer (`popover="manual"`), so the editor card's clipping and
 * containment cannot cut it off, with fixed positioning as the fallback. It
 * is anchored to the measured caret through Floating UI with `offset(4)`,
 * `flip()`, `shift({ padding: 8 })` and `size({ padding: 8 })`, and follows
 * layout, viewport and textarea scroll changes through `autoUpdate`, and
 * hides while the caret is scrolled out of the textarea's visible box. Its
 * height is at most eight rows and the viewport space left after the 8 px
 * margin. Opening it never scrolls the textarea.
 */

import {
  autoUpdate,
  computePosition,
  flip,
  hide,
  offset,
  shift,
  size,
  type VirtualElement,
} from '@floating-ui/dom';

import {
  bindPopupPointerSelection,
  createPopupElement,
  limitVisibleRows,
  renderSuggestions,
  type PopupPointerSelection,
} from '../../editor/template-completion-popup.ts';
import type { CompletionState } from '../../editor/template-completion-state.ts';
import { SourceCaretMeasurer, type CaretRect } from './source-caret-rect.ts';

/** Class that scopes the shared row styles to the source listbox. */
export const SOURCE_COMPLETION_POPUP_CLASS = 'markdown-editor-source-completion';
const VIEWPORT_MARGIN = 8;

type ListState = Pick<CompletionState, 'suggestions' | 'activeIndex'>;

function supportsPopover(element: HTMLElement): boolean {
  return typeof element.showPopover === 'function' && typeof element.hidePopover === 'function';
}

function isPopoverOpen(element: HTMLElement): boolean {
  try {
    return element.matches(':popover-open');
  } catch {
    return false;
  }
}

export class SourceCompletionPopup {
  readonly element: HTMLElement;
  readonly #textarea: HTMLTextAreaElement;
  readonly #measurer: SourceCaretMeasurer;
  readonly #pointerSelection: PopupPointerSelection;
  readonly #onTextareaScroll = () => this.#updatePosition();
  #caretOffset = 0;
  #caretRect: CaretRect = { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };
  #list: { state: ListState; listboxId: string } | null = null;
  #rowLimit = Number.POSITIVE_INFINITY;
  #stopAutoUpdate: (() => void) | null = null;
  #generation = 0;
  /** Count of computed positions actually applied to the popup. */
  #appliedPositions = 0;
  #open = false;

  constructor(
    textarea: HTMLTextAreaElement,
    listboxId: string,
    container: HTMLElement,
    onSelect: (index: number) => void,
  ) {
    this.#textarea = textarea;
    this.#measurer = new SourceCaretMeasurer(textarea);
    const popup = createPopupElement(listboxId);
    popup.classList.add('cinder-_floating-surface', SOURCE_COMPLETION_POPUP_CLASS);
    Object.assign(popup.style, { position: 'fixed', inset: 'auto', left: '0', top: '0' });
    if (supportsPopover(popup)) popup.popover = 'manual';
    container.append(popup);
    this.element = popup;
    this.#pointerSelection = bindPopupPointerSelection(popup, onSelect);
  }

  get open(): boolean {
    return this.#open;
  }

  /** Show `state`'s rows anchored at the caret offset `caretOffset`. */
  show(state: ListState, listboxId: string, caretOffset: number): void {
    const popup = this.element;
    this.#caretOffset = caretOffset;
    if (!this.#open) {
      this.#open = true;
      popup.dataset['cinderPositionReady'] = 'false';
      popup.style.display = '';
      if (supportsPopover(popup) && !isPopoverOpen(popup)) popup.showPopover();
      this.#pointerSelection.setOpen(true);
      this.#textarea.addEventListener('scroll', this.#onTextareaScroll);
      this.#stopAutoUpdate = autoUpdate(this.#reference(), popup, () => this.#updatePosition());
    }
    this.#list = { state, listboxId };
    renderSuggestions(popup, state, listboxId);
    limitVisibleRows(popup);
    this.#rowLimit = Number.parseFloat(popup.style.maxHeight) || Number.POSITIVE_INFINITY;
    this.#updatePosition();
  }

  hide(): void {
    const popup = this.element;
    popup.style.display = 'none';
    this.#pointerSelection.setOpen(false);
    if (!this.#open) return;
    this.#open = false;
    this.#list = null;
    this.#generation += 1;
    this.#stopAutoUpdate?.();
    this.#stopAutoUpdate = null;
    this.#textarea.removeEventListener('scroll', this.#onTextareaScroll);
    if (supportsPopover(popup) && isPopoverOpen(popup)) popup.hidePopover();
    this.#measurer.destroy();
  }

  destroy(): void {
    this.hide();
    this.#measurer.destroy();
    this.#pointerSelection.destroy();
    this.element.remove();
  }

  #reference(): VirtualElement {
    return {
      contextElement: this.#textarea,
      // A measurement still in flight after the popup closes reuses the last
      // rectangle instead of recreating the measurement element.
      getBoundingClientRect: () => {
        if (this.#open) this.#caretRect = this.#measurer.measure(this.#caretOffset);
        return this.#caretRect;
      },
    };
  }

  #updatePosition(): void {
    if (this.#open) void this.#position(++this.#generation);
  }

  async #position(generation: number): Promise<void> {
    const popup = this.element;
    let result: Awaited<ReturnType<typeof computePosition>>;
    try {
      result = await computePosition(this.#reference(), popup, {
        placement: 'bottom-start',
        strategy: 'fixed',
        middleware: [
          offset(4),
          flip(),
          shift({ padding: VIEWPORT_MARGIN }),
          size({
            padding: VIEWPORT_MARGIN,
            apply: ({ availableHeight }) => {
              const height = Math.max(0, Math.min(this.#rowLimit, availableHeight));
              popup.style.maxHeight = `${Math.floor(height)}px`;
            },
          }),
          // The caret can scroll out of the textarea's visible box; the
          // listbox hides rather than float beside unrelated text.
          hide({ strategy: 'referenceHidden', boundary: this.#textarea }),
        ],
      });
    } catch {
      // A detached textarea cannot be measured; the popup closes with it.
      return;
    }
    if (!this.#open || generation !== this.#generation) return;
    popup.style.left = `${result.x}px`;
    popup.style.top = `${result.y}px`;
    popup.style.visibility = result.middlewareData.hide?.referenceHidden ? 'hidden' : '';
    popup.dataset['cinderPositionReady'] = 'true';
    // Positioning is asynchronous and `autoUpdate` recomputes after layout
    // changes; each applied result advances this counter so callers (and
    // browser tests) can wait for a position computed after a given change.
    this.#appliedPositions += 1;
    popup.dataset['placeholderPositionGeneration'] = String(this.#appliedPositions);
    // The height may have shrunk to fit the viewport; keep the active row visible.
    if (this.#list) renderSuggestions(popup, this.#list.state, this.#list.listboxId);
  }
}
