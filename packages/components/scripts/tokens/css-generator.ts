import { format } from 'prettier';
import { scopeIndexFromDocuments } from '../../src/tokens/runtime/context-order.ts';
import {
  assertUniqueOverrideCssProperties,
  renderBaseDeclarations,
  renderOverrideDeclarations,
  withDependentBaseAliases,
  withOppositeThemeResets,
  withThemeDependentOverrides,
} from '../../src/tokens/runtime/css-support.ts';
import { renderStylesheetSkeleton } from '../../src/tokens/runtime/stylesheet-skeleton.ts';
import type { ResolverDocument, TokenDocument } from '../../src/tokens/runtime/types.ts';
import { assertPrettierResolvesToRoot } from '../lib/prettier-resolution.ts';
import { prepareCss } from './css-preparation.ts';
import { CSS_PLUGINS, PRETTIER_OPTIONS, REGENERATE_COMMAND } from './generator-configuration.ts';

export async function buildTokensBaseCss(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
): Promise<string> {
  const preparation = prepareCss(resolver, documentsByPath);
  const {
    baseIndex,
    baseResolveReferences,
    darkOverrides,
    lightOverrides,
    darkScopeIndex,
    lightScopeIndex,
    reducedMotionOverrides,
    forcedReducedMotionOverrides,
    systemReducedMotionScopeDocuments,
    systemForcedReducedMotionScopeDocuments,
    lightReducedMotionScopeIndex,
    darkReducedMotionScopeIndex,
    lightForcedReducedMotionScopeIndex,
    darkForcedReducedMotionScopeIndex,
    systemReducedMotionResolveReferences,
    systemForcedReducedMotionResolveReferences,
    lightResolveReferences,
    darkResolveReferences,
    lightReducedMotionResolveReferences,
    darkReducedMotionResolveReferences,
    lightForcedReducedMotionResolveReferences,
    darkForcedReducedMotionResolveReferences,
  } = preparation;

  const rootDeclarations = renderBaseDeclarations(baseIndex, baseResolveReferences);
  const darkDependentAliases = withDependentBaseAliases(
    darkOverrides,
    baseIndex,
    baseResolveReferences,
    darkResolveReferences,
  );
  const lightDependentAliases = withDependentBaseAliases(
    lightOverrides,
    baseIndex,
    baseResolveReferences,
    lightResolveReferences,
  );
  // Both unions are taken from the RAW maps, so neither depends on the other
  // having been widened first.
  const darkAliases = withOppositeThemeResets(
    darkDependentAliases,
    lightDependentAliases,
    baseIndex,
  );
  const lightAliases = withOppositeThemeResets(
    lightDependentAliases,
    darkDependentAliases,
    baseIndex,
  );
  assertUniqueOverrideCssProperties(
    darkAliases,
    baseIndex,
    darkScopeIndex,
    'theme.dark dependent aliases',
    darkResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    lightAliases,
    baseIndex,
    lightScopeIndex,
    'theme.light dependent aliases',
    lightResolveReferences,
  );
  const darkDeclarations = renderOverrideDeclarations(
    darkAliases,
    baseIndex,
    darkResolveReferences,
  );
  const lightDeclarations = renderOverrideDeclarations(
    lightAliases,
    baseIndex,
    lightResolveReferences,
  );
  const reducedMotionAliases = withDependentBaseAliases(
    reducedMotionOverrides,
    baseIndex,
    baseResolveReferences,
    systemReducedMotionResolveReferences,
  );
  const forcedReducedMotionAliases = withDependentBaseAliases(
    forcedReducedMotionOverrides,
    baseIndex,
    baseResolveReferences,
    systemForcedReducedMotionResolveReferences,
  );
  const lightReducedMotionAliases = withThemeDependentOverrides(
    reducedMotionOverrides,
    baseIndex,
    systemReducedMotionResolveReferences,
    lightReducedMotionResolveReferences,
  );
  const darkReducedMotionAliases = withThemeDependentOverrides(
    reducedMotionOverrides,
    baseIndex,
    systemReducedMotionResolveReferences,
    darkReducedMotionResolveReferences,
  );
  const lightForcedReducedMotionAliases = withThemeDependentOverrides(
    forcedReducedMotionOverrides,
    baseIndex,
    systemForcedReducedMotionResolveReferences,
    lightForcedReducedMotionResolveReferences,
  );
  const darkForcedReducedMotionAliases = withThemeDependentOverrides(
    forcedReducedMotionOverrides,
    baseIndex,
    systemForcedReducedMotionResolveReferences,
    darkForcedReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    reducedMotionAliases,
    baseIndex,
    scopeIndexFromDocuments(systemReducedMotionScopeDocuments),
    'motion.reduced dependent aliases',
    systemReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    forcedReducedMotionAliases,
    baseIndex,
    scopeIndexFromDocuments(systemForcedReducedMotionScopeDocuments),
    'motion.forced-reduced-motion dependent aliases',
    systemForcedReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    lightReducedMotionAliases,
    baseIndex,
    lightReducedMotionScopeIndex,
    'motion.reduced dependent aliases (light theme)',
    lightReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    darkReducedMotionAliases,
    baseIndex,
    darkReducedMotionScopeIndex,
    'motion.reduced dependent aliases (dark theme)',
    darkReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    lightForcedReducedMotionAliases,
    baseIndex,
    lightForcedReducedMotionScopeIndex,
    'motion.forced-reduced-motion dependent aliases (light theme)',
    lightForcedReducedMotionResolveReferences,
  );
  assertUniqueOverrideCssProperties(
    darkForcedReducedMotionAliases,
    baseIndex,
    darkForcedReducedMotionScopeIndex,
    'motion.forced-reduced-motion dependent aliases (dark theme)',
    darkForcedReducedMotionResolveReferences,
  );
  const reducedMotionDeclarations = renderOverrideDeclarations(
    reducedMotionAliases,
    baseIndex,
    systemReducedMotionResolveReferences,
  );
  const forcedReducedMotionDeclarations = renderOverrideDeclarations(
    forcedReducedMotionAliases,
    baseIndex,
    systemForcedReducedMotionResolveReferences,
  );
  const lightReducedMotionDeclarations = renderOverrideDeclarations(
    lightReducedMotionAliases,
    baseIndex,
    lightReducedMotionResolveReferences,
  );
  const darkReducedMotionDeclarations = renderOverrideDeclarations(
    darkReducedMotionAliases,
    baseIndex,
    darkReducedMotionResolveReferences,
  );
  const lightForcedReducedMotionDeclarations = renderOverrideDeclarations(
    lightForcedReducedMotionAliases,
    baseIndex,
    lightForcedReducedMotionResolveReferences,
  );
  const darkForcedReducedMotionDeclarations = renderOverrideDeclarations(
    darkForcedReducedMotionAliases,
    baseIndex,
    darkForcedReducedMotionResolveReferences,
  );
  const css = `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Source: components/cinder/src/tokens/ (the DTCG token corpus).
 * Regenerate: ${REGENERATE_COMMAND}
 */

${renderStylesheetSkeleton({
  root: rootDeclarations,
  dark: darkDeclarations,
  light: lightDeclarations,
  reducedMotion: reducedMotionDeclarations,
  darkReducedMotion: darkReducedMotionDeclarations,
  lightReducedMotion: lightReducedMotionDeclarations,
  forcedReducedMotion: forcedReducedMotionDeclarations,
  darkForcedReducedMotion: darkForcedReducedMotionDeclarations,
  lightForcedReducedMotion: lightForcedReducedMotionDeclarations,
})}`;

  assertPrettierResolvesToRoot();
  return format(css, { ...PRETTIER_OPTIONS, parser: 'css', plugins: CSS_PLUGINS });
}

// ---------------------------------------------------------------------------
