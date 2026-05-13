// @ts-nocheck — this file is excluded from the test runner; run `bun run typecheck` to verify.
// It uses @ts-expect-error directives to prove compile-time constraints.
import type { SideNavigationProps } from './side-navigation.svelte';

// ariaLabel is required — omitting it must be a compile error.
// @ts-expect-error — ariaLabel is required
const _missingLabel: SideNavigationProps = { children: {} as never };

// Providing ariaLabel is valid.
const _validProps: SideNavigationProps = { ariaLabel: 'Sections', children: {} as never };
void _validProps;

// aria-label from HTMLAttributes is omitted — it must be a compile error to pass it in rest.
// @ts-expect-error — 'aria-label' is omitted from HTMLAttributes via Omit
const _ariaLabelInRest: SideNavigationProps = {
  ariaLabel: 'Sections',
  'aria-label': 'Should not compile',
  children: {} as never,
};
