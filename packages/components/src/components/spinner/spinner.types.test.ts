/**
 * Type-equality tests proving the per-directory migration did not drift the
 * public-facing Spinner prop surface. These are compile-time-only — Bun runs
 * them via `bun test`, but the assertions are purely TypeScript assignability
 * checks.
 *
 * If either assertion fails, the migrated `SpinnerProps` no longer matches the
 * pre-migration snapshot recorded below.
 */

import { expect, test } from 'bun:test';
import type { ComponentProps } from 'svelte';

import Spinner from './spinner.svelte';
import type { SpinnerProps } from './spinner.types.ts';

// --- Snapshot of the pre-migration SpinnerProps shape --------------------------------
// Copied verbatim from the original module-script types in `src/components/spinner.svelte`
// at the start of the migration. This anchors the public surface so future
// refactors must explicitly update both the migrated type AND this snapshot.

type SnapshotSpinnerSize = 'sm' | 'md' | 'lg';

type SnapshotSpinnerProps = {
  size?: SnapshotSpinnerSize;
  label?: string;
  class?: string;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasAssignableForward: Assignable<SpinnerProps, SnapshotSpinnerProps> = true;
const aliasAssignableBackward: Assignable<SnapshotSpinnerProps, SpinnerProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotSpinnerProps,
  ComponentProps<typeof Spinner>
> = true;

test('Spinner public prop surface unchanged after migration', () => {
  expect(aliasAssignableForward).toBe(true);
  expect(aliasAssignableBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
