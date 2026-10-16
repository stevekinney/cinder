import { scopeIndexFromDocuments } from '../../src/tokens/runtime/context-order.ts';
import {
  assertOverrideScopeConsistency,
  assertUniqueOverrideCssProperties,
} from '../../src/tokens/runtime/css-support.ts';
import type { CssPreparation } from './css-preparation.ts';

export function validateCssScopes(context: CssPreparation): void {
  const {
    reducedMotionOverrides,
    forcedReducedMotionOverrides,
    baseIndex,
    lightReducedMotionScopeIndex,
    darkReducedMotionScopeIndex,
    lightForcedReducedMotionScopeIndex,
    darkForcedReducedMotionScopeIndex,
    lightReducedMotionResolveReferences,
    darkReducedMotionResolveReferences,
    lightForcedReducedMotionResolveReferences,
    darkForcedReducedMotionResolveReferences,
    systemReducedMotionScopeDocuments,
    systemForcedReducedMotionScopeDocuments,
    systemReducedMotionResolveReferences,
    systemForcedReducedMotionResolveReferences,
    lightOverrides,
    darkOverrides,
    lightResolveReferences,
    darkResolveReferences,
  } = context;
  assertUniqueOverrideCssProperties(
    reducedMotionOverrides,
    baseIndex,
    lightReducedMotionScopeIndex,
    'motion.reduced (light theme)',
    lightReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    reducedMotionOverrides,
    baseIndex,
    darkReducedMotionScopeIndex,
    'motion.reduced (dark theme)',
    darkReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    forcedReducedMotionOverrides,
    baseIndex,
    lightForcedReducedMotionScopeIndex,
    'motion.forced-reduced-motion (light theme)',
    lightForcedReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    forcedReducedMotionOverrides,
    baseIndex,
    darkForcedReducedMotionScopeIndex,
    'motion.forced-reduced-motion (dark theme)',
    darkForcedReducedMotionResolveReferences,
  );

  assertUniqueOverrideCssProperties(
    reducedMotionOverrides,
    baseIndex,
    scopeIndexFromDocuments(systemReducedMotionScopeDocuments),
    'motion.reduced (system theme)',
    systemReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    forcedReducedMotionOverrides,
    baseIndex,
    scopeIndexFromDocuments(systemForcedReducedMotionScopeDocuments),
    'motion.forced-reduced-motion (system theme)',
    systemForcedReducedMotionResolveReferences,
  );
  assertOverrideScopeConsistency(
    lightOverrides,
    baseIndex,
    [
      { name: 'motion.default', resolveReferences: lightResolveReferences },
      {
        name: 'motion.reduced',
        resolveReferences: lightReducedMotionResolveReferences,
      },
      {
        name: 'motion.forced-reduced-motion',
        resolveReferences: lightForcedReducedMotionResolveReferences,
      },
    ],
    'theme.light',
  );
  assertOverrideScopeConsistency(
    darkOverrides,
    baseIndex,
    [
      { name: 'motion.default', resolveReferences: darkResolveReferences },
      {
        name: 'motion.reduced',
        resolveReferences: darkReducedMotionResolveReferences,
      },
      {
        name: 'motion.forced-reduced-motion',
        resolveReferences: darkForcedReducedMotionResolveReferences,
      },
    ],
    'theme.dark',
  );
}
