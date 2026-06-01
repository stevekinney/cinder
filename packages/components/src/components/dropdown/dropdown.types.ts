import type { Placement } from '@floating-ui/dom';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { AnchoredOverlayWidthMode } from '../../_internal/anchored-overlay.svelte.ts';
export type DropdownPlacement = 'bottom-start' | 'bottom-end';
export type DropdownContext = {
  get menuId(): string;
  get isOpen(): boolean;
  get supportsPopover(): boolean;
  readonly anchorElement?: HTMLElement | null | undefined;
  readonly fallbackPlacement?: Placement | undefined;
  readonly widthMode?: AnchoredOverlayWidthMode | undefined;
  readonly initialFocus?: 'first' | 'last' | 'none' | undefined;
  close: () => void;
  focusTrigger: () => void;
};
type DropdownBaseProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  id?: string;
  class?: string;
};
type LegacyDropdownProps = DropdownBaseProps & {
  open?: boolean;
  placement?: DropdownPlacement;
  trigger: Snippet;
  children: Snippet;
};
type CompoundDropdownProps = DropdownBaseProps & {
  id: string;
  children?: Snippet;
  trigger?: never;
  open?: never;
  placement?: never;
};
export type DropdownProps = LegacyDropdownProps | CompoundDropdownProps;
