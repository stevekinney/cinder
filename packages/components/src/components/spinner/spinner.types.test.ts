/**
 * Type-safety tests for SpinnerProps. These are compile-time-only — Bun runs
 * them via `bun test`, but the assertions are purely TypeScript assignability
 * checks.
 *
 * SpinnerProps now intersects `Omit<HTMLAttributes<HTMLSpanElement>, 'role' |
 * 'aria-label' | 'class'>` so the bespoke props (size, label, class) are a
 * strict subset AND the component-controlled a11y attributes (role, aria-label)
 * are forbidden at the type level — they're scrubbed at runtime and the type
 * now expresses that protection.
 */

import { expect, test } from 'bun:test';
import type { ComponentProps } from 'svelte';

import Spinner from './spinner.svelte';
import type { SpinnerProps } from './spinner.types.ts';

type SpinnerSize = 'sm' | 'md' | 'lg';

/** Bespoke-only prop subset that must always be accepted by SpinnerProps. */
type BespokeSpinnerProps = {
  size?: SpinnerSize;
  label?: string;
  class?: string;
};

type Assignable<A, B> = A extends B ? true : false;
/** True when key K is NOT an accepted prop of T (Omit-ted out of the surface). */
type Forbidden<T, K extends PropertyKey> = K extends keyof T ? false : true;

// SpinnerProps must still cover every bespoke prop.
const aliasAssignableForward: Assignable<SpinnerProps, BespokeSpinnerProps> = true;
// The component must accept the bespoke-only subset.
const componentAcceptsSnapshot: Assignable<
  BespokeSpinnerProps,
  ComponentProps<typeof Spinner>
> = true;

// The a11y contract is component-owned: `role` and `aria-label` must NOT be part
// of the prop surface (mirroring the runtime scrub), while a native passthrough
// attribute like `id` must remain accepted.
const roleForbidden: Forbidden<SpinnerProps, 'role'> = true;
const ariaLabelForbidden: Forbidden<SpinnerProps, 'aria-label'> = true;
/** True when key K IS an accepted prop of T (the inverse of Forbidden). */
type Present<T, K extends PropertyKey> = K extends keyof T ? true : false;
// `id` (a native passthrough attribute) must remain part of the prop surface. This
// resolves to `false` (failing compilation) if `id` is ever Omit-ted out, without
// over-constraining its value type (svelte/elements types `id` as `string | null`).
const idAllowed: Present<SpinnerProps, 'id'> = true;

test('Spinner bespoke props are a subset of the full prop surface', () => {
  expect(aliasAssignableForward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});

test('Spinner forbids component-controlled a11y attrs but allows native passthrough', () => {
  expect(roleForbidden).toBe(true);
  expect(ariaLabelForbidden).toBe(true);
  expect(idAllowed).toBe(true);
});
