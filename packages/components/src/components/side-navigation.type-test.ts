// @ts-nocheck — this file is excluded from the test runner; run `bun run typecheck` to verify.
// It uses @ts-expect-error directives to prove compile-time constraints.
// NOTE: @ts-nocheck is required because tsc cannot resolve svelte module exports;
// svelte-check (run via bun run typecheck) is the authoritative type checker for this file.
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

// aria-labelledby is also omitted — it must be a compile error since it would win over aria-label.
// @ts-expect-error — 'aria-labelledby' is omitted from HTMLAttributes via Omit
const _ariaLabelledByInRest: SideNavigationProps = {
  ariaLabel: 'Sections',
  'aria-labelledby': 'some-other-element',
  children: {} as never,
};
