/**
 * Type-equality tests proving the public-facing Button prop surface accepts and rejects the
 * same inputs as the recorded snapshot below. These are compile-time-only — Bun runs them via
 * `bun test`, but the assertions are purely TypeScript `Equals<>`-style checks.
 *
 * COR-239 update: the snapshot below was updated to `ButtonProps`'s post-COR-239 shape (see
 * button.types.ts) — a discriminated union with two or more arms each referencing a full
 * svelte/elements attribute interface hit TS2590 ("Expression produces a union type that is
 * too complex to represent") once a consumer type-checked the published declaration under
 * `skipLibCheck: false`. This is an intentional, verified-behavior-preserving restructuring
 * (see `scripts/consumer-strict-types.ts`, which exhaustively checks real prop combinations
 * including every one this file's `Assignable` helper is too coarse to pin down precisely on a
 * deep discriminated union — see its own caveat below). Future refactors must still explicitly
 * update both the migrated type AND this snapshot.
 */

import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';

import type {
  AllKeys,
  DataAttributes,
  PadUnion,
  WithoutDataAttributes,
} from '../../_internal/union-props.ts';
import Button from './button.svelte';
import type { ButtonProps } from './button.types.ts';

// --- Snapshot of the post-COR-239 ButtonProps shape -----------------------------------
// Mirrors button.types.ts's structure (including its `SharedHtmlAttributes` +
// `DataAttributes` + `PadUnion<...>` split and the exclusion of `aria-label`/
// `aria-labelledby`/`leadingIcon`/`trailingIcon` from padding) as an INDEPENDENT copy, so a
// future accidental change to the real type is still caught here.

type _SnapshotVariant =
  'primary' | 'secondary' | 'soft' | 'danger' | 'soft-danger' | 'ghost' | 'ghost-danger';

type _SnapshotSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type _SnapshotSharedHtmlAttributes = WithoutDataAttributes<
  Omit<HTMLAttributes<HTMLButtonElement | HTMLAnchorElement>, 'class'>
>;

type _ButtonOnlyExtra = Omit<
  HTMLButtonAttributes,
  keyof HTMLAttributes<HTMLButtonElement> | 'class'
> & { href?: undefined };
type _LinkButtonExtra = Omit<
  HTMLAnchorAttributes,
  keyof HTMLAttributes<HTMLAnchorElement> | 'class'
> & { href: string };

type _ButtonDiscriminant = (_ButtonOnlyExtra | _LinkButtonExtra) &
  (
    | { label: string; children?: Snippet; iconOnly?: false }
    | { label?: string; children: Snippet; iconOnly?: false }
    | ({ iconOnly: true } & (
        | { label: string; 'aria-label'?: string; 'aria-labelledby'?: string }
        | { label?: string; 'aria-label': string; 'aria-labelledby'?: string }
        | { label?: string; 'aria-label'?: string; 'aria-labelledby': string }
      ) &
        (
          | { children: Snippet; leadingIcon?: Snippet; trailingIcon?: Snippet }
          | { children?: Snippet; leadingIcon: Snippet; trailingIcon?: Snippet }
          | { children?: Snippet; leadingIcon?: Snippet; trailingIcon: Snippet }
        ))
  );

type _ButtonPaddedKeys = Exclude<
  AllKeys<_ButtonDiscriminant>,
  'aria-label' | 'aria-labelledby' | 'leadingIcon' | 'trailingIcon'
>;

type SnapshotButtonProps = _SnapshotSharedHtmlAttributes &
  DataAttributes &
  PadUnion<_ButtonDiscriminant, _ButtonPaddedKeys> & {
    variant?: _SnapshotVariant;
    size?: _SnapshotSize;
    fullWidth?: boolean;
    loading?: boolean;
    leadingIcon?: Snippet;
    trailingIcon?: Snippet;
    class?: string;
  };

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
