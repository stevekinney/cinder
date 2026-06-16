import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import type { SurfaceTone } from '../../_internal/surface-context.ts';
export type { SurfaceTone } from '../../_internal/surface-context.ts';

export type SurfaceProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  tone?: SurfaceTone;
  /** Additional CSS classes */
  class?: string;
  /** Content rendered inside the surface container. */
  children?: Snippet;
};

export interface SurfaceSchemaProps {
  /** Surface tone. @default "default" */
  tone?: SurfaceTone;
  /** Additional CSS classes */
  class?: string;
}
