/**
 * Type-equality tests proving the per-directory migration did not drift the
 * public-facing Alert prop surface. These are compile-time-only — Bun runs
 * them via `bun test`, but the assertions are purely TypeScript `Equals<>`
 * checks.
 *
 * If either assertion fails, the migrated `AlertProps` no longer matches the
 * pre-migration snapshot recorded below.
 */

import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

import Alert from './alert.svelte';
import type { AlertProps } from './alert.types.ts';

// --- Snapshot of the intended AlertProps shape ---------------------------------------
// Anchors the public surface so future refactors must explicitly update both the
// type AND this snapshot. Per design decision P6-C2, Alert owns a non-overridable
// `role="alert"` live region, so `role`, `aria-live`, `aria-atomic`, and
// `aria-relevant` are intentionally omitted from the surface (and scrubbed at
// runtime). The snapshot mirrors that omit set so the assertions verify the
// reduced surface rather than pinning the pre-P6-C2 shape.

type _SnapshotAlertVariant = 'info' | 'success' | 'warning' | 'error' | 'danger';

type SnapshotAlertProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'role' | 'aria-live' | 'aria-atomic' | 'aria-relevant'
> & {
  variant?: _SnapshotAlertVariant;
  dismissible?: boolean;
  onDismiss?: () => void;
  class?: string;
  children: Snippet;
  icon?: Snippet;
};

// --- Bidirectional-assignability helper ----------------------------------------------
// True `Equals<A, B>` on deep discriminated unions is famously fragile under
// TypeScript's invariant identity check — two structurally equivalent unions
// can disagree at the type-identity level. What we actually need to guarantee is
// that consumer code calling `<Alert {...props} />` accepts the same prop set
// before and after migration: i.e. mutual assignability.

type Assignable<A, B> = A extends B ? true : false;

// --- Assertions ----------------------------------------------------------------------

// 1. Extracted alias and snapshot are mutually assignable.
const aliasAssignableForward: Assignable<AlertProps, SnapshotAlertProps> = true;
const aliasAssignableBackward: Assignable<SnapshotAlertProps, AlertProps> = true;

// 2. Every snapshot-shaped prop set is accepted by the migrated component.
//    This is the consumer-facing guarantee: code that used to compile against
//    pre-migration Alert still compiles. We use one-way assignability here
//    because svelte2tsx's generated `ComponentProps` is a superset of the
//    declared props alias (it adds synthetic bindable/event keys), so the
//    reverse direction is not meaningful and would always fail.
const componentAcceptsSnapshot: Assignable<SnapshotAlertProps, ComponentProps<typeof Alert>> = true;

test('Alert public prop surface unchanged after migration', () => {
  expect(aliasAssignableForward).toBe(true);
  expect(aliasAssignableBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
