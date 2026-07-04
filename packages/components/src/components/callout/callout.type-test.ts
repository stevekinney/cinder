/**
 * Compile-time regression tests for CalloutProps.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 * These verify that the prop type's `Omit` list keeps semantically forbidden
 * attributes off the public surface — callout must never be a live region or
 * override the implicit <aside> role.
 */
import type { Snippet } from 'svelte';

import type { CalloutProps } from './callout.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const noopChildren = null as any as Snippet;

// role is owned by the component (<aside>) and must not be overridable.
// @ts-expect-error - role is excluded from CalloutProps
const _roleRejected: CalloutProps = { children: noopChildren, role: 'alert' };

// Callout is static; live-region attributes must not reach the type surface.
// @ts-expect-error - aria-live is excluded from CalloutProps
const _ariaLiveRejected: CalloutProps = { children: noopChildren, 'aria-live': 'polite' };

// @ts-expect-error - aria-atomic is excluded from CalloutProps
const _ariaAtomicRejected: CalloutProps = { children: noopChildren, 'aria-atomic': 'true' };

// prettier-ignore
// @ts-expect-error - aria-relevant is excluded from CalloutProps
const _ariaRelevantRejected: CalloutProps = { children: noopChildren, 'aria-relevant': 'additions' };

// @ts-expect-error - aria-busy is excluded from CalloutProps
const _ariaBusyRejected: CalloutProps = { children: noopChildren, 'aria-busy': 'true' };

// aria-label remains a valid prop — consumers must be able to label the
// landmark when the callout lands at a landmark position.
const _ariaLabelAccepted: CalloutProps = { children: noopChildren, 'aria-label': 'Note' };

// prettier-ignore
// aria-labelledby is similarly allowed and takes precedence over title.
const _ariaLabelledByAccepted: CalloutProps = { children: noopChildren, 'aria-labelledby': 'external-heading' };

// Static note semantics are supported without reopening arbitrary role overrides.
const _semanticNoteAccepted: CalloutProps = { children: noopChildren, semantic: 'note' };

// @ts-expect-error - only the supported semantic modes are accepted
const _invalidSemanticRejected: CalloutProps = { children: noopChildren, semantic: 'alert' };

void _roleRejected;
void _ariaLiveRejected;
void _ariaAtomicRejected;
void _ariaRelevantRejected;
void _ariaBusyRejected;
void _ariaLabelAccepted;
void _ariaLabelledByAccepted;
void _semanticNoteAccepted;
void _invalidSemanticRejected;
