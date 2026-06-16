import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Direction that SpeedDial actions fan out from the trigger. */
export type SpeedDialDirection = 'up' | 'down' | 'left' | 'right';

/** Shared context between SpeedDial and SpeedDial.Action. */
export type SpeedDialContext = {
  get isOpen(): boolean;
  get direction(): SpeedDialDirection;
  close: (options?: { focusTrigger?: boolean }) => void;
  focusTrigger: () => void;
  register: (button: HTMLButtonElement) => void;
  unregister: (button: HTMLButtonElement) => void;
};

/** Props for the SpeedDial component. */
export type SpeedDialProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'aria-label' | 'children' | 'class' | 'hidden'
> & {
  /** Bindable open state. Trigger, Escape, outside click, and action activation update it. */
  open?: boolean;
  /** Direction the actions fan out. */
  direction?: SpeedDialDirection;
  /** Applies the native hidden attribute and makes the whole control inert. */
  hidden?: boolean;
  /** Accessible label for the root group and trigger button. */
  'aria-label'?: string;
  /** Trigger icon or content rendered inside the FloatingActionButton. */
  trigger: Snippet;
  /** `SpeedDial.Action` children. */
  children: Snippet;
  /** Custom class merged with `.cinder-speed-dial`. */
  class?: string;
};

/** Schema-facing props for SpeedDial. */
export interface SpeedDialSchemaProps {
  /**
   * Bindable open state. Trigger, Escape, outside click, and action activation update it.
   * @default false
   */
  open?: boolean;
  /**
   * Direction the actions fan out.
   * @default "up"
   */
  direction?: SpeedDialDirection;
  /**
   * Applies the native hidden attribute and makes the whole control inert.
   * @default false
   */
  hidden?: boolean;
  /** Accessible label for the root group and trigger button. */
  'aria-label'?: string;
  /** Custom class merged with `.cinder-speed-dial`. */
  class?: string;
}
