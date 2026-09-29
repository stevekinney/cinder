/**
 * Compile-time regression tests for ButtonGroupProps discriminated union.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 * These verify that invalid prop combinations are rejected by the type system.
 */
import type { Snippet } from 'svelte';

import type { ButtonGroupProps } from './button-group.svelte';

declare const noopChildren: Snippet;

// label and ariaLabelledby are mutually exclusive — TypeScript must reject this.
// @ts-expect-error - ariaLabelledby must be never when label is provided
const bothPresent: ButtonGroupProps = {
  label: 'a',
  ariaLabelledby: 'b',
  children: noopChildren,
};

// At least one of label or ariaLabelledby is required — TypeScript must reject this.
// @ts-expect-error - ariaLabelledby or label is required
const neitherPresent: ButtonGroupProps = {
  children: noopChildren,
};

void bothPresent;
void neitherPresent;
