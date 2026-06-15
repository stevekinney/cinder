import { createContext } from 'svelte';

export type ContextMenuContext = {
  get disabled(): boolean;
  get isOpen(): boolean;
  get longPressDelay(): number;
  openAt: (x: number, y: number) => void;
  close: () => void;
};

const [getContextMenuContextStrict, setContextMenuContext] = createContext<ContextMenuContext>();

export { setContextMenuContext };

/**
 * Read the nearest enclosing `<ContextMenu>` context. Throws when no
 * `<ContextMenu>` ancestor exists — using `<ContextMenuTrigger>` outside a
 * provider is a programmer error.
 */
export const getContextMenuContext = getContextMenuContextStrict;
