import { format } from 'prettier';
import { assertPrettierResolvesToRoot } from '../lib/prettier-resolution.ts';
import { prepareCss } from './css-preparation.ts';
import {
  assertUniqueOverrideCssProperties,
  renderBaseDeclarations,
  renderOverrideDeclarations,
  withDependentBaseAliases,
  withOppositeThemeResets,
  withThemeDependentOverrides,
} from './css-support.ts';
import { CSS_PLUGINS, PRETTIER_OPTIONS, REGENERATE_COMMAND } from './generator-configuration.ts';
import { scopeIndexFromDocuments } from './resolved-contexts.ts';
import type { ResolverDocument, TokenDocument } from './types.ts';

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
  const reducedDarkThemeBlock = darkReducedMotionDeclarations
    ? `:root:not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on']) [data-theme='dark'],
:root[data-theme='dark']:not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on']) {
${darkReducedMotionDeclarations}
}`
    : '';
  const reducedLightThemeBlock = lightReducedMotionDeclarations
    ? `:root:not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on']) [data-theme='light'],
:root[data-theme='light']:not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on']) {
${lightReducedMotionDeclarations}
}`
    : '';
  const reducedSystemDarkBlock = darkReducedMotionDeclarations
    ? `@media (prefers-color-scheme: dark) {
  :root:not([data-theme]):not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on']) {
${darkReducedMotionDeclarations}
  }
}`
    : '';
  const reducedSystemLightBlock = lightReducedMotionDeclarations
    ? `@media (prefers-color-scheme: light) {
  :root:not([data-theme]):not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on']) {
${lightReducedMotionDeclarations}
  }
}`
    : '';
  const forcedDarkThemeBlock = darkForcedReducedMotionDeclarations
    ? `:root[data-reduced-motion='on'] [data-theme='dark'],
:root[data-reduced-motion='on'][data-theme='dark'] {
${darkForcedReducedMotionDeclarations}
}`
    : '';
  const forcedLightThemeBlock = lightForcedReducedMotionDeclarations
    ? `:root[data-reduced-motion='on'] [data-theme='light'],
:root[data-reduced-motion='on'][data-theme='light'] {
${lightForcedReducedMotionDeclarations}
}`
    : '';
  const forcedSystemDarkBlock = darkForcedReducedMotionDeclarations
    ? `@media (prefers-color-scheme: dark) {
  :root[data-reduced-motion='on']:not([data-theme]) {
${darkForcedReducedMotionDeclarations}
  }
}`
    : '';
  const forcedSystemLightBlock = lightForcedReducedMotionDeclarations
    ? `@media (prefers-color-scheme: light) {
  :root[data-reduced-motion='on']:not([data-theme]) {
${lightForcedReducedMotionDeclarations}
  }
}`
    : '';

  const css = `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Source: components/cinder/src/tokens/ (the DTCG token corpus).
 * Regenerate: ${REGENERATE_COMMAND}
 */

:root {
  /* Structural: not a design token. */
  color-scheme: light dark;

${rootDeclarations}
}

:root[data-theme='dark'] {
  /* Structural: not a design token. */
  color-scheme: dark;
}

:root[data-theme='light'] {
  /* Structural: not a design token. */
  color-scheme: light;
}

[data-theme='dark'] {
  /* Structural: not a design token. */
  color-scheme: dark;

${darkDeclarations}
}

[data-theme='light'] {
  /* Structural: not a design token. */
  color-scheme: light;

${lightDeclarations}
}

@media (prefers-reduced-motion: reduce) {
  :root:not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on']) {
${reducedMotionDeclarations}
  }
${reducedDarkThemeBlock}
${reducedLightThemeBlock}
${reducedSystemDarkBlock}
${reducedSystemLightBlock}
}

:root[data-reduced-motion='on'] {
${forcedReducedMotionDeclarations}
}
${forcedDarkThemeBlock}
${forcedLightThemeBlock}
${forcedSystemDarkBlock}
${forcedSystemLightBlock}
`;

  assertPrettierResolvesToRoot();
  return format(css, { ...PRETTIER_OPTIONS, parser: 'css', plugins: CSS_PLUGINS });
}

// ---------------------------------------------------------------------------
