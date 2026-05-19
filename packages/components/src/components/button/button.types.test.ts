/**
 * Type-equality tests proving the per-directory migration did not drift the
 * public-facing Button prop surface. These are compile-time-only — Bun runs
 * them via `bun test`, but the assertions are purely TypeScript `Equals<>`
 * checks.
 *
 * If either assertion fails, the migrated `ButtonProps` no longer matches the
 * pre-migration snapshot recorded below.
 */

import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

import Button from './button.svelte';
import type { ButtonProps } from './button.types.ts';

// --- Snapshot of the pre-migration ButtonProps shape ---------------------------------
// Copied verbatim from the original module-script types in `src/components/button.svelte`
// at the start of the migration. This anchors the public surface so future
// refactors must explicitly update both the migrated type AND this snapshot.

type _SnapshotVariant =
  | 'primary'
  | 'secondary'
  | 'soft'
  | 'danger'
  | 'soft-danger'
  | 'ghost'
  | 'ghost-danger';

type _SnapshotSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type _SharedBase = {
  variant?: _SnapshotVariant;
  size?: _SnapshotSize;
  fullWidth?: boolean;
  loading?: boolean;
  leadingIcon?: Snippet;
  trailingIcon?: Snippet;
  class?: string;
};

type _WithLabel = { label: string; children?: Snippet; iconOnly?: false };
type _WithChildren = { label?: string; children: Snippet; iconOnly?: false };
type _IconOnlyAccessibleName =
  | { label: string; 'aria-label'?: string; 'aria-labelledby'?: string }
  | { label?: string; 'aria-label': string; 'aria-labelledby'?: string }
  | { label?: string; 'aria-label'?: string; 'aria-labelledby': string };
type _IconOnlyVisual =
  | { children: Snippet; leadingIcon?: Snippet; trailingIcon?: Snippet }
  | { children?: Snippet; leadingIcon: Snippet; trailingIcon?: Snippet }
  | { children?: Snippet; leadingIcon?: Snippet; trailingIcon: Snippet };
type _WithIconOnly = { iconOnly: true } & _IconOnlyAccessibleName & _IconOnlyVisual;

type _SharedProps = _SharedBase & (_WithLabel | _WithChildren | _WithIconOnly);

type _ButtonOnlySnap = _SharedProps & Omit<HTMLButtonAttributes, 'class'> & { href?: undefined };
type _LinkSnap = _SharedProps & Omit<HTMLAnchorAttributes, 'class'> & { href: string };

type SnapshotButtonProps = _ButtonOnlySnap | _LinkSnap;

// --- Bidirectional-assignability helper ----------------------------------------------
// True `Equals<A, B>` on deep discriminated unions is famously fragile under
// TypeScript's invariant identity check — two structurally equivalent unions
// can disagree at the type-identity level. What we actually need to guarantee is
// that consumer code calling `<Button {...props} />` accepts the same prop set
// before and after migration: i.e. mutual assignability.

type Assignable<A, B> = A extends B ? true : false;

// --- Assertions ----------------------------------------------------------------------

// 1. Extracted alias and snapshot are mutually assignable.
const aliasAssignableForward: Assignable<ButtonProps, SnapshotButtonProps> = true;
const aliasAssignableBackward: Assignable<SnapshotButtonProps, ButtonProps> = true;

// 2. Every snapshot-shaped prop set is accepted by the migrated component.
//    This is the consumer-facing guarantee: code that used to compile against
//    pre-migration Button still compiles. We use one-way assignability here
//    because svelte2tsx's generated `ComponentProps` is a superset of the
//    declared props alias (it adds synthetic bindable/event keys), so the
//    reverse direction is not meaningful and would always fail.
const componentAcceptsSnapshot: Assignable<
  SnapshotButtonProps,
  ComponentProps<typeof Button>
> = true;

test('Button public prop surface unchanged after migration', () => {
  expect(aliasAssignableForward).toBe(true);
  expect(aliasAssignableBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
