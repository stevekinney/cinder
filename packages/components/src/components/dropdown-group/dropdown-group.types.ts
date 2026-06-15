import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

type DropdownGroupBaseProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'aria-label' | 'aria-labelledby' | 'class' | 'role'
> & {
  /** Additional class names merged onto the group root. */
  class?: string;
  /** DropdownLabel plus grouped DropdownItem rows. */
  children?: Snippet;
};

export type DropdownGroupProps = DropdownGroupBaseProps &
  (
    | {
        /** Accessible label for the group, applied as aria-label. Provide exactly one of `ariaLabel` or `labelledBy`. */
        ariaLabel: string;
        labelledBy?: never;
      }
    | {
        ariaLabel?: never;
        /** ID of an existing element whose text labels the group, applied as aria-labelledby. Provide exactly one of `ariaLabel` or `labelledBy`. */
        labelledBy: string;
      }
  );
