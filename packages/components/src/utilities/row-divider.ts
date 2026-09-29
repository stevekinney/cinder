import type { Attachment } from 'svelte/attachments';

const ROW_SELECTOR = '.cinder-_row-item, .cinder-_option-row';
const SEPARATOR_SELECTOR = '.cinder-dropdown-separator';
const states = new WeakMap<HTMLElement, ParentState>();

type ParentState = {
  rows: Set<HTMLElement>;
  observer: MutationObserver;
};

function syncRows(parent: HTMLElement, rows: Set<HTMLElement>): void {
  const children = Array.from(parent.children);
  for (const row of rows) {
    const rowIndex = children.indexOf(row);
    if (rowIndex < 0) continue;

    if (row.hidden) {
      row.removeAttribute('data-cinder-row-divider');
      continue;
    }

    let hasVisibleLaterRow = false;
    for (const sibling of children.slice(rowIndex + 1)) {
      if (sibling.matches(SEPARATOR_SELECTOR)) break;
      if (sibling.matches(ROW_SELECTOR) && !(sibling instanceof HTMLElement && sibling.hidden)) {
        hasVisibleLaterRow = true;
        break;
      }
    }
    row.toggleAttribute('data-cinder-row-divider', hasVisibleLaterRow);
  }
}

/** Marks option rows that own a divider before the next visible row in their parent segment. */
export const rowDividerAttachment: Attachment<HTMLElement> = (row) => {
  const parent = row.parentElement;
  if (parent === null) return;
  if (typeof MutationObserver === 'undefined') return;

  let state = states.get(parent);
  if (state === undefined) {
    const rows = new Set<HTMLElement>();
    const observer = new MutationObserver(() => syncRows(parent, rows));
    state = { rows, observer };
    states.set(parent, state);
    observer.observe(parent, {
      childList: true,
      attributes: true,
      attributeFilter: ['hidden'],
      subtree: true,
    });
  }

  state.rows.add(row);
  syncRows(parent, state.rows);

  return () => {
    state?.rows.delete(row);
    row.removeAttribute('data-cinder-row-divider');
    if (state?.rows.size === 0) {
      state.observer.disconnect();
      states.delete(parent);
    }
  };
};
