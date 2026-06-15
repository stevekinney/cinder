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
  /** CSS selector string or `null` specifying where the portal content is appended. Defaults to `document.body` when `null` or omitted. */
  target?: string | null;
  /** When true, renders the content inline in normal document flow instead of teleporting it to the target. */
  disabled?: boolean;
  /** Additional class applied to the portal wrapper element. */
  class?: string;
  /** When true (default), HTML attributes passed to the portal are forwarded onto the wrapper element inside the target. */
  inheritAttributes?: boolean;
}

export type { PortalAttachmentOptions };
