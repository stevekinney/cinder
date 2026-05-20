/**
 * Shared context contract between CommandPalette and CommandItem.
 *
 * This module is intentionally kept under `_internal/` so the context handles
 * are accessible to both components without being part of the package's public
 * surface. Consumers cannot reach the context without dotting into
 * `_internal/`, matching the convention already established by
 * `_internal/overlay.ts`.
 *
 * The context is *required* — a `CommandItem` outside a `CommandPalette` is a
 * programmer error. The `getCommandPaletteContext` getter therefore throws
 * (via Svelte 5's `createContext`) when no provider exists; `CommandItem`
 * still calls `hasCommandPaletteContext` first so it can throw a more helpful
 * domain-specific error.
 */

import { createContext } from 'svelte';

/**
 * Live registration input provided by each CommandItem on mount.
 * Getters are used so the palette always reads the current prop values
 * without requiring the item to re-register when props change.
 */
export type CommandItemRegistrationInput = {
  /** Live getter for the item's submitted value. */
  getValue: () => string;
  /** Live getter for the activation callback. */
  getOnselect: () => () => void;
  /** Live getter for the disabled flag. */
  getDisabled: () => boolean;
};

/**
 * Context provided by CommandPalette and consumed by CommandItem.
 */
export type CommandPaletteContext = {
  /** Stable id for the listbox; items compose their own ids from this. */
  readonly listboxId: string;
  /** Current input value. Read-only from items. */
  readonly query: string;
  /** Id of the currently active (virtually focused) item, or null. */
  readonly activeItemId: string | null;
  /**
   * Called by each CommandItem when it mounts.
   * Returns a stable id and an unregister function.
   */
  register: (
    input: CommandItemRegistrationInput,
    node: HTMLElement,
  ) => { id: string; unregister: () => void };
  /** Called by items on pointerenter to sync hover with arrow-key navigation. */
  setActiveById: (id: string) => void;
};

const [getCommandPaletteContextStrict, setCommandPaletteContextRaw] =
  createContext<CommandPaletteContext>();

/** Publish the command palette context for descendant CommandItems. */
export function setCommandPaletteContext(context: CommandPaletteContext): void {
  setCommandPaletteContextRaw(context);
}

/**
 * Read the enclosing `<CommandPalette>` context. Throws via Svelte 5's
 * `createContext` if no provider exists — callers that want a friendlier
 * domain-specific error should gate with `hasCommandPaletteContext` first.
 */
export function getCommandPaletteContext(): CommandPaletteContext {
  return getCommandPaletteContextStrict();
}

/** True when a `<CommandPalette>` ancestor has published its context. */
export function hasCommandPaletteContext(): boolean {
  try {
    getCommandPaletteContextStrict();
    return true;
  } catch {
    return false;
  }
}
