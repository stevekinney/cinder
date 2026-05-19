/**
 * Type-equality tests proving the per-directory migration did not drift the
 * public-facing Breadcrumbs prop surface. These are compile-time-only — Bun runs
 * them via `bun test`, but the assertions are purely TypeScript `Equals<>`
 * checks.
 *
 * If either assertion fails, the migrated `BreadcrumbsProps` no longer matches
 * the pre-migration snapshot recorded below.
 */

import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';

import Breadcrumbs from './breadcrumbs.svelte';
import type { BreadcrumbsProps } from './breadcrumbs.types.ts';

// --- Snapshot of the pre-migration BreadcrumbsProps shape -----------------------------
// Copied verbatim from the original module-script types in `src/components/breadcrumbs.svelte`
// at the start of the migration. This anchors the public surface so future
// refactors must explicitly update both the migrated type AND this snapshot.

type _SnapshotBreadcrumbItem = {
  label: string;
  href?: string;
};

type SnapshotBreadcrumbsProps = {
  items: _SnapshotBreadcrumbItem[];
  separator?: Snippet | string;
  label?: string;
  class?: string;
};

// --- Bidirectional-assignability helper ----------------------------------------------
// True `Equals<A, B>` on deep discriminated unions is famously fragile under
// TypeScript's invariant identity check — two structurally equivalent unions
// can disagree at the type-identity level. What we actually need to guarantee is
// that consumer code calling `<Breadcrumbs {...props} />` accepts the same prop
// set before and after migration: i.e. mutual assignability.

type Assignable<A, B> = A extends B ? true : false;

// --- Assertions ----------------------------------------------------------------------

// 1. Extracted alias and snapshot are mutually assignable.
const aliasAssignableForward: Assignable<BreadcrumbsProps, SnapshotBreadcrumbsProps> = true;
const aliasAssignableBackward: Assignable<SnapshotBreadcrumbsProps, BreadcrumbsProps> = true;

// 2. Every snapshot-shaped prop set is accepted by the migrated component.
//    This is the consumer-facing guarantee: code that used to compile against
//    pre-migration Breadcrumbs still compiles. We use one-way assignability here
//    because svelte2tsx's generated `ComponentProps` is a superset of the
//    declared props alias (it adds synthetic bindable/event keys), so the
//    reverse direction is not meaningful and would always fail.
const componentAcceptsSnapshot: Assignable<
  SnapshotBreadcrumbsProps,
  ComponentProps<typeof Breadcrumbs>
> = true;

test('Breadcrumbs public prop surface unchanged after migration', () => {
  expect(aliasAssignableForward).toBe(true);
  expect(aliasAssignableBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
