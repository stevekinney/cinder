import type { EditorState } from './types.js';
type ReadonlyEditorView = Pick<EditorState['view'], 'dom' | 'setProps'>;
type ReadonlyEditorState = { view: ReadonlyEditorView | undefined };

export function applyReadonlyAria(
  view: ReadonlyEditorView | null | undefined,
  readonly: boolean,
): void {
  if (!view?.dom) return;
  if (readonly) view.dom.setAttribute('aria-readonly', 'true');
  else view.dom.removeAttribute('aria-readonly');
}

export function setEditorReadonly(state: ReadonlyEditorState, readonly: boolean): void {
  state.view?.setProps({ editable: () => !readonly });
  applyReadonlyAria(state.view, readonly);
}

/**
 * Destroy an editor instance and clean up resources.
 */
export async function destroyEditor(state: EditorState): Promise<void> {
  // Mark destroyed first to prevent debounced callbacks from accessing context
  state.markDestroyed();
  state.clearPendingTimers();

  await state.editor.destroy();
}
