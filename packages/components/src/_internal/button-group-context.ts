import { createContext } from 'svelte';

import { optionalContext } from './optional-context.ts';

/**
 * Context published by `<ButtonGroup>` for descendant `<Button>`s.
 *
 * Button reads this during its own initialization — which also runs during
 * `svelte/server` rendering — so the connected-corner styling attribute
 * (`data-cinder-button-group-item`) is present in SSR/static markup, not only
 * after the client-only `{@attach}` mutation observer in `button-group.svelte`
 * runs post-hydration. `{@attach}` still owns the attribute for children that
 * are not a Cinder `<Button>` (raw markup, other components) and for children
 * added or moved after mount — see `button-group.svelte`'s `tagDirectChildren`.
 */
export type ButtonGroupContext = {
  /**
   * This group's ownership id — the same value `{@attach}` later writes onto
   * any dynamically added/moved child. Because Button renders this id from
   * context up front, `{@attach}`'s first post-hydration sync writes the
   * identical value, so the attribute is never removed and re-added.
   */
  readonly groupId: string;
};

const [getButtonGroupContextStrict, setButtonGroupContextRaw] = createContext<ButtonGroupContext>();

export function setButtonGroupContext(context: ButtonGroupContext): void {
  setButtonGroupContextRaw(context);
}

/**
 * Read the nearest enclosing `<ButtonGroup>` context, or `undefined` when no
 * `<ButtonGroup>` ancestor exists. A standalone `<Button>` renders normally.
 */
export const getButtonGroupContext: () => ButtonGroupContext | undefined = optionalContext(
  getButtonGroupContextStrict,
);
