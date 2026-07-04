import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Visual layout direction for Toolbar and Toolbar.Group. */
export type ToolbarOrientation = 'horizontal' | 'vertical';

type ToolbarBaseProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'aria-label' | 'aria-labelledby' | 'aria-orientation' | 'class' | 'role' | 'children'
> & {
  /** Additional class merged with `.cinder-toolbar`. */
  class?: string;
  /** Layout direction for roving-key ownership and vertical group separator placement. */
  orientation?: ToolbarOrientation;
  /** Controls rendered inside the toolbar. */
  children: Snippet;
};

/**
 * Public Toolbar props.
 * Requires an accessible name through either `aria-label` or `aria-labelledby`.
 */
export type ToolbarProps = ToolbarBaseProps &
  (
    | { 'aria-label': string; 'aria-labelledby'?: never }
    | { 'aria-label'?: never; 'aria-labelledby': string }
  );

/** Toolbar.Group props. */
export type ToolbarGroupProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'aria-orientation' | 'class'
> & {
  /** Additional class merged with `.cinder-toolbar__group`. */
  class?: string;
  /** Visual layout direction for the group's children. Defaults to the parent Toolbar orientation. */
  orientation?: ToolbarOrientation;
  /** Group contents. */
  children: Snippet;
};

/** Toolbar.Spacer props. */
export type ToolbarSpacerProps = Omit<HTMLAttributes<HTMLDivElement>, 'aria-hidden' | 'class'> & {
  /** Additional class merged with `.cinder-toolbar__spacer`. */
  class?: string;
  /** Positive flex-grow value used to push later groups away. */
  flex?: number;
};

/** Schema-facing Toolbar props. */
export interface ToolbarSchemaProps {
  /**
   * Layout direction for keyboard ownership and vertical group separator placement.
   * @default "horizontal"
   */
  orientation?: ToolbarOrientation;
  /** Additional class merged with `.cinder-toolbar`. */
  class?: string;
}
