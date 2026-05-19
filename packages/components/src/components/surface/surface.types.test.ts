/**
 * Type-equality tests proving the per-directory migration did not drift the
 * public-facing Surface prop surface. These are compile-time-only — Bun runs
 * them via `bun test`, but the assertions are purely TypeScript assignability
 * checks.
 *
 * If either assertion fails, the migrated `SurfaceProps` no longer matches the
 * pre-migration snapshot recorded below.
 */

import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import type { SurfaceTone } from '../../_internal/surface-context.ts';
import Surface from './surface.svelte';
import type { SurfaceProps } from './surface.types.ts';

// --- Snapshot of the pre-migration SurfaceProps shape --------------------------------
// Copied verbatim from the original module-script types in `src/components/surface.svelte`
// at the start of the migration. This anchors the public surface so future
// refactors must explicitly update both the migrated type AND this snapshot.

type SnapshotSurfaceProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  tone?: SurfaceTone;
  /** Additional CSS classes */
  class?: string;
  children?: Snippet;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasAssignableForward: Assignable<SurfaceProps, SnapshotSurfaceProps> = true;
const aliasAssignableBackward: Assignable<SnapshotSurfaceProps, SurfaceProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotSurfaceProps,
  ComponentProps<typeof Surface>
> = true;

test('Surface public prop surface unchanged after migration', () => {
  expect(aliasAssignableForward).toBe(true);
  expect(aliasAssignableBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
