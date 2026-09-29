import type { Ctx } from '@milkdown/kit/ctx';
import type { EditorConfig } from './types.js';

export function notifySelection(
  context: Ctx,
  editorViewCtx: typeof import('@milkdown/kit/core').editorViewCtx,
  isDestroyed: () => boolean,
  onselectionchange: NonNullable<EditorConfig['onselectionchange']>,
  liveSelection?: { from: number; to: number },
): void {
  if (isDestroyed()) return;

  let view;
  try {
    view = context.get(editorViewCtx);
  } catch {
    return;
  }
  if (!view?.state) return;

  const { from, to } = liveSelection ?? view.state.selection;
  onselectionchange({ from, to, isCollapsed: from === to });
}
