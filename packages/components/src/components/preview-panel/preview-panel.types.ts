import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type PreviewPanelStatus = 'idle' | 'loading' | 'ready' | 'warning' | 'error' | 'empty';

/** Props for the PreviewPanel component. */
export type PreviewPanelProps = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'role'> & {
  /** Visible panel title. */
  title: string;
  /** Status taxonomy for the preview surface. @default 'idle' */
  status?: PreviewPanelStatus | undefined;
  /** Leading visual or control rendered before the title. */
  leading?: Snippet | undefined;
  /** Action controls rendered in the header. */
  actions?: Snippet | undefined;
  /** Tab controls rendered below the header. */
  tabs?: Snippet | undefined;
  /** Main preview content. */
  children: Snippet;
  /** Footer content such as metadata or secondary controls. */
  footer?: Snippet | undefined;
  /** Custom class merged with `.cinder-preview-panel`. */
  class?: string;
};
