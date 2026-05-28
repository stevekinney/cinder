/**
 * Compile-time regression tests for AlertProps.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 * These verify that the prop type's `Omit` list keeps the live-region attributes
 * that design decision P6-C2 locks off the public surface — Alert owns a
 * non-overridable `role="alert"` assertive live region, so a consumer must not
 * be able to type a role, downgrade the urgency, or fragment the announcement.
 * The runtime scrub in alert.svelte is defense-in-depth; this pins the contract
 * at the type level so a future edit to alert.types.ts trips a compile error.
 */
import type { Snippet } from 'svelte';

import type { AlertProps } from './alert.types.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const noopChildren = null as any as Snippet;

// role is owned by the component (role="alert") and must not be overridable.
// @ts-expect-error - role is excluded from AlertProps
const _roleRejected: AlertProps = { children: noopChildren, role: 'status' };

// role="alert" implies aria-live="assertive"; a consumer must not downgrade it.
// @ts-expect-error - aria-live is excluded from AlertProps
const _ariaLiveRejected: AlertProps = { children: noopChildren, 'aria-live': 'polite' };

// role="alert" implies aria-atomic="true"; overriding to false would fragment
// the assertive announcement, so the attribute is off the surface.
// @ts-expect-error - aria-atomic is excluded from AlertProps
const _ariaAtomicRejected: AlertProps = { children: noopChildren, 'aria-atomic': 'false' };

// prettier-ignore
// @ts-expect-error - aria-relevant is excluded from AlertProps
const _ariaRelevantRejected: AlertProps = { children: noopChildren, 'aria-relevant': 'additions' };

// aria-label remains valid — consumers may name the alert.
const _ariaLabelAccepted: AlertProps = { children: noopChildren, 'aria-label': 'Save failed' };

// aria-busy remains valid — it is a status flag, not a live-region presentation
// attribute, and is left on the surface (matching the runtime scrub set).
const _ariaBusyAccepted: AlertProps = { children: noopChildren, 'aria-busy': true };

void _roleRejected;
void _ariaLiveRejected;
void _ariaAtomicRejected;
void _ariaRelevantRejected;
void _ariaLabelAccepted;
void _ariaBusyAccepted;
