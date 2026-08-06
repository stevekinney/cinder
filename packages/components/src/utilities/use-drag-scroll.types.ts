import type { Attachment } from 'svelte/attachments';

export type UseDragScrollOptions = {
  /**
   * Getter for whether the drag engine may attach. Defaults to `() => true`.
   * Callers gate this on a fine-pointer media query and
   * `prefers-reduced-motion` — momentum and rubber-band are exactly the
   * inertial motion that preference is about.
   */
  enabled?: () => boolean;
  /** `'mandatory'` (default) always snaps on release; `'proximity'` only within a third of the snapport. */
  snapMode?: 'mandatory' | 'proximity';
  /** Called once the virtual scroll position settles after a released drag. */
  onSettle?: () => void;
};

export type DragScrollAttachment = Attachment<HTMLElement>;
