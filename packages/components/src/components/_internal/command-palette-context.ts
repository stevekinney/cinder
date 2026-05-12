/**
 * Shared context contract between CommandPalette and CommandItem.
 *
 * This module is intentionally kept under `_internal/` so the symbol is
 * accessible to both components without being part of the package's public
 * surface. Consumers cannot reach `COMMAND_PALETTE_CONTEXT` without dotting
 * into `_internal/`, which serves as a social signal matching the convention
 * already established by `_internal/overlay.ts`.
 */

export const COMMAND_PALETTE_CONTEXT: unique symbol = Symbol('cinder-command-palette');

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
  register: (input: CommandItemRegistrationInput) => { id: string; unregister: () => void };
  /** Called by items on pointerenter to sync hover with arrow-key navigation. */
  setActiveById: (id: string) => void;
};
