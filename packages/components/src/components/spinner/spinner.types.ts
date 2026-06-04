import type { HTMLAttributes } from 'svelte/elements';

export type SpinnerSize = 'sm' | 'md' | 'lg';

// `role="status"` and `aria-label` are the component's a11y contract — Spinner is a
// live region whose accessible name is `label`. They're scrubbed at runtime (the
// `{...rest}` spread sits before the explicit attrs), and Omit-ing them here makes
// that protection part of the type: `<Spinner role="img" />` is a compile error.
// `class` is omitted because the component re-declares it as an owned prop (merged
// via `classNames`), matching StatusDotProps / AlertProps.
export type SpinnerProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  'role' | 'aria-label' | 'class'
> & {
  size?: SpinnerSize;
  label?: string;
  class?: string;
};

export interface SpinnerSchemaProps {
  /** Spinner size. @default "md" */
  size?: SpinnerSize;
  /** Accessible loading label. @default "Loading" */
  label?: string;
  /** Extra classes appended to the root element. */
  class?: string;
}
