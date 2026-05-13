/**
 * Compile-time regression tests for ButtonGroupProps discriminated union.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 * These verify that invalid prop combinations are rejected by the type system.
 */
import type { Snippet } from 'svelte';

import type { ButtonGroupProps } from './button-group.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const noopChildren = null as any as Snippet;

// label and labelledBy are mutually exclusive — TypeScript must reject this.
// @ts-expect-error - labelledBy must be never when label is provided
const _bothPresent: ButtonGroupProps = {
  label: 'a',
  labelledBy: 'b',
  children: noopChildren,
};

// At least one of label or labelledBy is required — TypeScript must reject this.
// @ts-expect-error - labelledBy or label is required
const _neitherPresent: ButtonGroupProps = {
  children: noopChildren,
};

void _bothPresent;
void _neitherPresent;
