import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import type { PortalAttachmentOptions, PortalTargetInput } from './portal.utilities.svelte.ts';

export type PortalProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> & {
  children: Snippet;
  target?: PortalTargetInput;
  disabled?: boolean;
  class?: string;
  inheritAttributes?: boolean;
};

export interface PortalSchemaProps {
  target?: string | null;
  disabled?: boolean;
  class?: string;
  inheritAttributes?: boolean;
}

export type { PortalAttachmentOptions };
