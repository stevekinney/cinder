/**
 * DOM for the placeholder completion listbox.
 *
 * Focus always stays in the editor: the listbox is referenced from the
 * editing element through `aria-controls` and `aria-activedescendant`, and
 * its options are outside the Tab order. Rows show the path, the declared
 * types joined with `|` (or `unknown`) and the optional description, and
 * never any value.
 */

import type { PlaceholderCandidate } from '@lostgradient/markdown';
import type { EditorView } from 'prosemirror-view';

import { MAXIMUM_VISIBLE_SUGGESTIONS } from './template-completion-query.js';
import type { CompletionState } from './template-completion-state.js';

/** Accessible name of the listbox. */
export const PLACEHOLDER_LISTBOX_LABEL = 'Placeholders';
/** Pointer travel, in pixels, after which a gesture counts as a scroll. */
const SCROLL_GESTURE_THRESHOLD = 10;

/** The option ID for a canonical path: the listbox ID, a hyphen and the path. */
export function placeholderOptionId(listboxId: string, path: string): string {
  return `${listboxId}-${path}`;
}

/** Declared types joined with `|`, or `unknown` when none are declared. */
export function describeCandidateTypes(candidate: PlaceholderCandidate): string {
  return candidate.types && candidate.types.length > 0 ? candidate.types.join('|') : 'unknown';
}

export function createPopupElement(listboxId: string): HTMLElement {
  const popup = document.createElement('div');
  popup.id = listboxId;
  popup.className = 'template-completion-popup';
  popup.setAttribute('role', 'listbox');
  popup.setAttribute('aria-label', PLACEHOLDER_LISTBOX_LABEL);
  popup.style.position = 'absolute';
  popup.style.zIndex = '50';
  popup.style.display = 'none';
  return popup;
}

function createOption(
  listboxId: string,
  candidate: PlaceholderCandidate,
  index: number,
): HTMLElement {
  const item = document.createElement('div');
  item.id = placeholderOptionId(listboxId, candidate.path);
  item.setAttribute('role', 'option');
  item.className = 'template-completion-item';
  item.dataset['index'] = String(index);

  const pathLabel = document.createElement('span');
  pathLabel.className = 'template-completion-item-path';
  pathLabel.textContent = candidate.path;
  item.appendChild(pathLabel);

  const typeLabel = document.createElement('span');
  typeLabel.className = 'template-completion-item-types';
  typeLabel.textContent = describeCandidateTypes(candidate);
  item.appendChild(typeLabel);

  if (candidate.description) {
    const description = document.createElement('span');
    description.className = 'template-completion-item-description';
    description.textContent = candidate.description;
    item.appendChild(description);
  }
  return item;
}

function optionElements(popup: HTMLElement): HTMLElement[] {
  return [...popup.querySelectorAll<HTMLElement>('[role="option"]')];
}

/** Render every suggestion and mark the active one. Rows are rebuilt only when the list changes. */
export function renderSuggestions(
  popup: HTMLElement,
  completionState: Pick<CompletionState, 'suggestions' | 'activeIndex'>,
  listboxId: string,
): void {
  const { suggestions, activeIndex } = completionState;
  const listKey = suggestions.map((candidate) => candidate.path).join('\n');
  if (popup.dataset['listKey'] !== listKey) {
    popup.replaceChildren(
      ...suggestions.map((candidate, index) => createOption(listboxId, candidate, index)),
    );
    popup.dataset['listKey'] = listKey;
  }
  for (const [index, option] of optionElements(popup).entries()) {
    const selected = index === activeIndex;
    option.setAttribute('aria-selected', String(selected));
    option.classList.toggle('template-completion-item--active', selected);
    if (selected) keepOptionVisible(popup, option);
  }
}

/** Scroll only the listbox, never the page, so the active row is visible. */
function keepOptionVisible(popup: HTMLElement, option: HTMLElement): void {
  const top = option.offsetTop;
  const bottom = top + option.offsetHeight;
  if (top < popup.scrollTop) popup.scrollTop = top;
  else if (bottom > popup.scrollTop + popup.clientHeight) {
    popup.scrollTop = bottom - popup.clientHeight;
  }
}

/** Limit the listbox to eight visible rows; the rest scroll. */
export function limitVisibleRows(popup: HTMLElement): void {
  const rows = optionElements(popup).slice(0, MAXIMUM_VISIBLE_SUGGESTIONS);
  const rowsHeight = rows.reduce((total, row) => total + row.getBoundingClientRect().height, 0);
  if (rowsHeight <= 0) return;
  const style = getComputedStyle(popup);
  const chrome = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'] as const;
  const extra = chrome.reduce(
    (total, property) => total + (Number.parseFloat(style[property]) || 0),
    0,
  );
  popup.style.maxHeight = `${Math.ceil(rowsHeight + extra)}px`;
}

export function positionPopup(popup: HTMLElement, view: EditorView, cursorPos: number): void {
  const coordinates = view.coordsAtPos(cursorPos);
  const parentElement = popup.parentElement;
  if (!parentElement) return;
  const parentRect = parentElement.getBoundingClientRect();
  popup.style.left = `${coordinates.left - parentRect.left}px`;
  popup.style.top = `${coordinates.bottom - parentRect.top + 4}px`;
}

type PointerGesture = { index: number; x: number; y: number; scrolled: boolean };

function optionIndexFromEvent(event: Event): number | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const option = target.closest<HTMLElement>('[role="option"]');
  const index = Number(option?.dataset['index']);
  return option && Number.isSafeInteger(index) ? index : null;
}

/** Pointer selection for one popup: track visibility, then clean up. */
export interface PopupPointerSelection {
  /** Listen for the end of pointer interactions only while the popup is open. */
  setOpen(open: boolean): void;
  destroy(): void;
}

/**
 * Commit an option on click. Pointerdown is prevented so the editor keeps its
 * selection and focus. When a pointer or touch gesture was recorded, it
 * commits only if it stayed on the same option and neither scrolled nor was
 * cancelled. A click with no recorded gesture (from assistive technology or
 * the keyboard) always commits.
 *
 * A recorded gesture never outlives its pointer interaction: while the popup
 * is open, a pointerup or pointercancel anywhere outside it forgets the
 * gesture, and a cancel inside it is forgotten once the current task ends.
 */
export function bindPopupPointerSelection(
  popup: HTMLElement,
  onSelect: (index: number) => void,
): PopupPointerSelection {
  const ownerDocument = popup.ownerDocument;
  let gesture: PointerGesture | null = null;
  let listening = false;
  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    const index = optionIndexFromEvent(event);
    gesture =
      index === null ? null : { index, x: event.clientX, y: event.clientY, scrolled: false };
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!gesture) return;
    const distance = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
    if (distance > SCROLL_GESTURE_THRESHOLD) gesture.scrolled = true;
  };
  const onScroll = () => {
    if (gesture) gesture.scrolled = true;
  };
  // A cancelled gesture (typically a touch that became a scroll) never commits
  // a click from the same interaction, and is forgotten after it.
  const onCancel = () => {
    const cancelled = gesture;
    if (!cancelled) return;
    cancelled.scrolled = true;
    queueMicrotask(() => {
      if (gesture === cancelled) gesture = null;
    });
  };
  const onPointerEndOutside = (event: PointerEvent) => {
    if (event.target instanceof Node && popup.contains(event.target)) return;
    gesture = null;
  };
  const setListening = (next: boolean) => {
    if (next === listening) return;
    listening = next;
    if (next) {
      ownerDocument.addEventListener('pointerup', onPointerEndOutside, true);
      ownerDocument.addEventListener('pointercancel', onPointerEndOutside, true);
    } else {
      ownerDocument.removeEventListener('pointerup', onPointerEndOutside, true);
      ownerDocument.removeEventListener('pointercancel', onPointerEndOutside, true);
    }
  };
  const onMouseDown = (event: MouseEvent) => event.preventDefault();
  const onClick = (event: MouseEvent) => {
    const index = optionIndexFromEvent(event);
    const recorded = gesture;
    gesture = null;
    if (index === null) return;
    if (recorded && (recorded.scrolled || index !== recorded.index)) return;
    event.preventDefault();
    onSelect(index);
  };

  popup.addEventListener('pointerdown', onPointerDown);
  popup.addEventListener('pointermove', onPointerMove);
  popup.addEventListener('pointercancel', onCancel);
  popup.addEventListener('scroll', onScroll);
  popup.addEventListener('mousedown', onMouseDown);
  popup.addEventListener('click', onClick);
  return {
    setOpen(open: boolean) {
      setListening(open);
      if (!open) gesture = null;
    },
    destroy() {
      setListening(false);
      gesture = null;
      popup.removeEventListener('pointerdown', onPointerDown);
      popup.removeEventListener('pointermove', onPointerMove);
      popup.removeEventListener('pointercancel', onCancel);
      popup.removeEventListener('scroll', onScroll);
      popup.removeEventListener('mousedown', onMouseDown);
      popup.removeEventListener('click', onClick);
    },
  };
}

/**
 * Dismiss the popup on a pointerdown outside it and outside the editor,
 * without preventing the event or moving focus. Returns a cleanup function.
 */
export function bindOutsideDismissal(
  ownerDocument: Document,
  insideElements: readonly Element[],
  onOutside: () => void,
): () => void {
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target;
    if (target instanceof Node && insideElements.some((element) => element.contains(target))) {
      return;
    }
    onOutside();
  };
  ownerDocument.addEventListener('pointerdown', onPointerDown, true);
  return () => ownerDocument.removeEventListener('pointerdown', onPointerDown, true);
}
