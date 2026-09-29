/**
 * Compile-time regression tests for CalloutProps.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 * These verify that the prop type's `Omit` list keeps semantically forbidden
 * attributes off the public surface — callout must never be a live region or
 * override the implicit <aside> role.
 */
import type { Snippet } from 'svelte';

import type { CalloutProps } from './callout.svelte';

declare const noopChildren: Snippet;

// role is owned by the component (<aside>) and must not be overridable.
// @ts-expect-error - role is excluded from CalloutProps
const roleRejected: CalloutProps = { children: noopChildren, role: 'alert' };

// Callout is static; live-region attributes must not reach the type surface.
// @ts-expect-error - aria-live is excluded from CalloutProps
const ariaLiveRejected: CalloutProps = { children: noopChildren, 'aria-live': 'polite' };

// @ts-expect-error - aria-atomic is excluded from CalloutProps
const ariaAtomicRejected: CalloutProps = { children: noopChildren, 'aria-atomic': 'true' };

// prettier-ignore
// @ts-expect-error - aria-relevant is excluded from CalloutProps
const ariaRelevantRejected: CalloutProps = { children: noopChildren, 'aria-relevant': 'additions' };

// @ts-expect-error - aria-busy is excluded from CalloutProps
const ariaBusyRejected: CalloutProps = { children: noopChildren, 'aria-busy': 'true' };

// aria-label remains a valid prop — consumers must be able to label the
// landmark when the callout lands at a landmark position.
const ariaLabelAccepted: CalloutProps = { children: noopChildren, 'aria-label': 'Note' };

// prettier-ignore
// aria-labelledby is similarly allowed and takes precedence over title.
const ariaLabelledByAccepted: CalloutProps = { children: noopChildren, 'aria-labelledby': 'external-heading' };

// Static note semantics are supported without reopening arbitrary role overrides.
const semanticNoteAccepted: CalloutProps = { children: noopChildren, semantic: 'note' };

// @ts-expect-error - only the supported semantic modes are accepted
const invalidSemanticRejected: CalloutProps = { children: noopChildren, semantic: 'alert' };

void roleRejected;
void ariaLiveRejected;
void ariaAtomicRejected;
void ariaRelevantRejected;
void ariaBusyRejected;
void ariaLabelAccepted;
void ariaLabelledByAccepted;
void semanticNoteAccepted;
void invalidSemanticRejected;
