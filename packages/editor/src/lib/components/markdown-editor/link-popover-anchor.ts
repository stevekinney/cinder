/**
 * The anchor for MarkdownEditor's link popover when the link shortcut opens it.
 * Moved out of `markdown-editor.svelte` (COR-525) with its behavior unchanged;
 * the priority list no longer names a source-textarea step the code never had.
 */

import type { VirtualElement } from '@floating-ui/dom';

import type { EditorState } from '../../editor/index.ts';

/**
 * Resolve the best available anchor for the link popover when opened via keyboard shortcut.
 * Priority:
 * 1. Floating UI VirtualElement built from ProseMirror coordsAtPos (WYSIWYG mode)
 * 2. editor view.dom bounding rect fallback
 * 3. markdown-editor wrapper bounding rect fallback
 */
export function resolveLinkPopoverAnchor(
  view: EditorState['view'] | undefined,
  wrapperElement: HTMLElement | null,
): VirtualElement | HTMLElement | null {
  if (view) {
    try {
      const from = view.state.selection.from;
      // Probe once up front so an unusable position falls through to the
      // view.dom fallback below.
      const probe = view.coordsAtPos(from);
      if (probe && probe.top > 0) {
        // Recompute coords live inside getBoundingClientRect so Floating UI's
        // autoUpdate tracks the selection through scroll/layout changes rather
        // than freezing the open-time rectangle. contextElement lets Floating
        // UI resolve the correct scroll ancestors. Only needs a rect-shaped
        // object — no DOMRect instance or toJSON.
        return {
          ...(view.dom instanceof HTMLElement ? { contextElement: view.dom } : {}),
          getBoundingClientRect: () => {
            // autoUpdate calls this on every scroll/resize. coordsAtPos can
            // throw if the position is no longer resolvable after a state
            // change — fall back to the editor's own rect so Floating UI keeps
            // a valid anchor instead of rejecting the position update.
            try {
              const coords = view.coordsAtPos(view.state.selection.from);
              return {
                x: coords.left,
                y: coords.top,
                width: coords.right - coords.left,
                height: coords.bottom - coords.top,
                top: coords.top,
                right: coords.right,
                bottom: coords.bottom,
                left: coords.left,
              };
            } catch {
              return view.dom.getBoundingClientRect();
            }
          },
        };
      }
    } catch {
      // Fall through to view.dom fallback
    }
    const viewDom = view.dom;
    if (viewDom instanceof HTMLElement) return viewDom;
  }

  if (wrapperElement) return wrapperElement;
  return null;
}
