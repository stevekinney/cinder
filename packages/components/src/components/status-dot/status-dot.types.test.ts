/**
 * Type-equality tests proving the per-directory migration did not drift the
 * public-facing StatusDot prop surface. These are compile-time-only — Bun runs
 * them via `bun test`, but the assertions are purely TypeScript assignability
 * checks.
 *
 * If either assertion fails, the migrated `StatusDotProps` no longer matches
 * the pre-migration snapshot recorded below.
 */

import { expect, test } from 'bun:test';
import type { ComponentProps } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import StatusDot from './status-dot.svelte';
import type { StatusDotProps } from './status-dot.types.ts';

// --- Snapshot of the pre-migration StatusDotProps shape -------------------------------
// Copied verbatim from the original module-script types in `src/components/status-dot.svelte`
// at the start of the migration. This anchors the public surface so future
// refactors must explicitly update both the migrated type AND this snapshot.

type SnapshotStatusDotStatus =
  | 'online'
  | 'offline'
  | 'warning'
  | 'danger'
  | 'pending'
  | 'neutral'
  | 'success'
  | 'accent';

type SnapshotStatusDotSize = 'sm' | 'md';

type SnapshotStatusDotProps = Omit<HTMLAttributes<HTMLSpanElement>, 'class'> & {
  /** Required semantic status. Drives color via `data-cinder-status`. */
  status: SnapshotStatusDotStatus;
  /** Optional human label. Rendered visibly when `showLabel` is true; used as the accessible name either way. */
  label?: string;
  /** Whether to render the visible label. Default `true`. */
  showLabel?: boolean;
  /** Dot size. Default `'md'`. */
  size?: SnapshotStatusDotSize;
  /** Extra classes appended to the root element. */
  class?: string;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasAssignableForward: Assignable<StatusDotProps, SnapshotStatusDotProps> = true;
const aliasAssignableBackward: Assignable<SnapshotStatusDotProps, StatusDotProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotStatusDotProps,
  ComponentProps<typeof StatusDot>
> = true;

test('StatusDot public prop surface unchanged after migration', () => {
  expect(aliasAssignableForward).toBe(true);
  expect(aliasAssignableBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
