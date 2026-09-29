/**
 * Anchor decorations and selection helpers.
 *
 * @module
 */

import type { EditorState } from '@milkdown/kit/prose/state';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { anchorPluginKey } from './anchor-plugin-state.js';

// ============================================================================
// Decorations
// ============================================================================

/**
 * Compute decorations for all anchors.
 *
 * All anchors get a simple inline highlight. Active and hovered states
 * are indicated via additional CSS classes.
 *
 * cinder#1304: the decoration used to carry only `class` and `data-thread-id`
 * — both invisible to assistive tech — so an anchored comment was mouse-only.
 * `role="mark"` and `aria-description` fix the announcement half (a screen
 * reader now identifies the run of text as carrying a comment, the same job
 * `<mark>` does natively, without a `<mark>` element ProseMirror does not
 * render here). They do NOT fix reachability: `role="mark"` carries no
 * default tab stop, deliberately — `tabindex` on an inline decoration inside
 * a contenteditable is fragile (it fights ProseMirror's own selection/caret
 * handling on every render) and was rejected as "probably not the fix" in the
 * issue itself. The keyboard route lives in `review-editor-impl.svelte`
 * instead: a container-level Ctrl-Alt-ArrowDown/Up command that moves the
 * caret between anchors in document order and opens the one it lands on,
 * which needs `threads` state this plugin does not have and so cannot live
 * here.
 *
 * `aria-details` (pointing at the thread's sidebar entry, as the issue also
 * suggested) is deliberately NOT set: `CommentSidebar` only mounts while
 * `sidebarOpen`, so the referenced id would not exist in the DOM most of the
 * time — an `aria-details` that dangles whenever the sidebar is closed is a
 * worse failure mode (an axe `aria-valid-attr-value` violation) than the one
 * this fix exists to close.
 */
export function computeDecorations(state: EditorState): DecorationSet {
  const pluginState = anchorPluginKey.getState(state);
  if (!pluginState) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  const docSize = state.doc.content.size;
  const activeThreadId = pluginState.activeThreadId;
  const hoveredThreadId = pluginState.hoveredThreadId;

  for (const [threadId, anchor] of pluginState.anchors) {
    // An orphaned anchor's quote is not in the document, so there is nothing to
    // highlight. It stays tracked (and retried) rather than decorated.
    if (anchor.status === 'orphaned') continue;

    // Bounds checking: clamp positions to valid doc range
    const from = Math.max(0, Math.min(anchor.from, docSize));
    const to = Math.max(from, Math.min(anchor.to, docSize));

    // Skip invalid ranges
    if (from >= to) continue;

    const isActive = activeThreadId === threadId;
    const activeClass = isActive ? ' comment-anchor--active' : '';
    const isHovered = hoveredThreadId === threadId;
    const hoveredClass = isHovered ? ' comment-anchor--hovered' : '';

    // Standard highlight for all anchors
    decorations.push(
      Decoration.inline(
        from,
        to,
        {
          class: `comment-anchor${activeClass}${hoveredClass}`,
          'data-thread-id': threadId,
          role: 'mark',
          'aria-description': 'Commented text',
        },
        { key: `anchor-${threadId}` },
      ),
    );
  }

  return DecorationSet.create(state.doc, decorations);
}

/**
 * Move `view`'s selection to cover `[from, to)` and scroll it into view.
 *
 * Exists so ReviewEditor's keyboard "next/previous comment" navigation
 * (cinder#1304 — the keyboard route to an anchor that has no `tabindex` of
 * its own, see `computeDecorations` above) can move the caret to an anchor's
 * range WITHOUT importing ProseMirror value modules directly into
 * `review-editor-impl.svelte`. That component reaches ProseMirror only
 * through this file, which `review-editor.ssr.test.ts` enforces at the
 * source level (`@milkdown/`/`prosemirror-` value imports are only SSR-safe
 * here, not at the component layer) — a second entry point there would be a
 * new, unaudited one.
 *
 * Returns `false` (and dispatches nothing) if the range cannot be resolved
 * against the CURRENT document, e.g. a stale position after an intervening
 * edit the caller has not re-checked.
 */
export function selectAnchorRange(view: EditorView, from: number, to: number): boolean {
  if (from < 0 || to > view.state.doc.content.size || from > to) return false;
  try {
    const selection = TextSelection.create(view.state.doc, from, to);
    view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
    return true;
  } catch {
    // Position valid by size but not addressable (mid-node boundary).
    return false;
  }
}

/**
 * Resolve the range to select for `threadId`'s anchor, preferring this
 * plugin's own LIVE, per-transaction-mapped position over the caller's
 * `fallback` (typically converted from the thread's own cached
 * `anchor.from`/`to`, which `computeDecorations` above also reads from the
 * SAME plugin state, not from a thread).
 *
 * cinder#1304's keyboard "next/previous comment" navigation used to read
 * only the fallback: an ordinary edit before an anchor maps this plugin's
 * tracked position through the transaction immediately (the position
 * `computeDecorations` paints the live decoration from), but does not call
 * `onAnchorsUpdate` — that only fires during deferred re-anchoring — so a
 * caller holding the thread's own cached anchor (never told about the
 * mapped shift) could select stale, unrelated text at the anchor's FORMER
 * position even though the decoration itself had already moved to the
 * right one. Falls back to `fallback` if the plugin has no live entry for
 * `threadId` (e.g. the anchor plugin isn't mounted, or the thread was never
 * synced into it).
 */
export function resolveAnchorSelectionRange(
  view: EditorView,
  threadId: string,
  fallback: { from: number; to: number },
): { from: number; to: number } {
  const liveAnchor = anchorPluginKey.getState(view.state)?.anchors.get(threadId);
  if (!liveAnchor) return fallback;
  return { from: liveAnchor.from, to: liveAnchor.to };
}
