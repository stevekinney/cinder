export const CONTEXT_MENU_CONTEXT = Symbol('cinder-context-menu');

export type ContextMenuContext = {
  get disabled(): boolean;
  get longPressDelay(): number;
  openAt: (x: number, y: number) => void;
};
