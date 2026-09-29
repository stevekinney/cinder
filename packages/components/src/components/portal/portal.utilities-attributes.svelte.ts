import { closestAcrossShadow, getShadowHost } from './portal.utilities-events.svelte.ts';

export type PortalFallbackAttributes = {
  dir: string | null | undefined;
  lang: string | null | undefined;
  dataTheme: string | null | undefined;
  theme: string | null | undefined;
  preserveDirection?: boolean;
  preserveLanguage?: boolean;
  preserveDataTheme?: boolean;
  preserveTheme?: boolean;
};

export type PortalInheritedAttributes = {
  dir: string | null;
  lang: string | null;
  dataTheme: string | null;
  theme: string | null;
};

export function copyInheritedPortalAttributes(
  element: HTMLElement,
  source: HTMLElement | null | undefined,
  inheritAttributes: boolean,
  fallbackAttributes: PortalFallbackAttributes = {
    dir: element.getAttribute('dir'),
    lang: element.getAttribute('lang'),
    dataTheme: element.getAttribute('data-theme'),
    theme: element.getAttribute('data-cinder-theme'),
  },
): PortalInheritedAttributes {
  const inheritedDirectionAttribute = 'data-cinder-portal-inherited-direction';
  const preservesExplicitDirection =
    fallbackAttributes.preserveDirection || element.dataset['cinderExplicitDirection'] === 'true';
  const inheritedDir = resolveInheritedDirection(
    source,
    inheritAttributes && !preservesExplicitDirection,
    inheritedDirectionAttribute,
  );
  applyDirection(
    element,
    inheritedDir,
    fallbackAttributes.dir ?? null,
    preservesExplicitDirection,
    inheritedDirectionAttribute,
  );
  const inheritedLanguage = resolveInheritedAttribute(
    source,
    shouldInheritLanguage(fallbackAttributes, inheritAttributes),
    '[lang]',
  );
  applyAttribute(element, 'lang', inheritedLanguage ?? fallbackAttributes.lang, true);
  const { dataTheme: inheritedDataTheme, theme: inheritedTheme } = applyThemeAttributes(
    element,
    source,
    inheritAttributes,
    fallbackAttributes,
  );
  return {
    dir: inheritedDir ?? null,
    lang: inheritedLanguage ?? null,
    dataTheme: inheritedDataTheme ?? null,
    theme: inheritedTheme ?? null,
  };
}

function shouldInheritLanguage(fallback: PortalFallbackAttributes, inherit: boolean): boolean {
  return inherit && !(fallback.preserveLanguage ?? fallback.lang !== null);
}

function applyThemeAttributes(
  element: HTMLElement,
  source: HTMLElement | null | undefined,
  inherit: boolean,
  fallback: PortalFallbackAttributes,
): { dataTheme: string | null; theme: string | null } {
  const dataTheme = resolveInheritedAttribute(
    source,
    inherit && fallback.preserveDataTheme !== true && fallback.dataTheme === null,
    '[data-theme]',
  );
  applyAttribute(element, 'data-theme', dataTheme ?? fallback.dataTheme);
  const theme = resolveInheritedAttribute(
    source,
    inherit && fallback.preserveTheme !== true && fallback.theme === null,
    '[data-cinder-theme]',
  );
  applyAttribute(element, 'data-cinder-theme', theme ?? fallback.theme);
  return { dataTheme, theme };
}

function resolveInheritedDirection(
  source: HTMLElement | null | undefined,
  shouldInherit: boolean,
  inheritedDirectionAttribute: string,
): string | null | undefined {
  if (!shouldInherit || !source) return null;
  let inherited: string | null | undefined = null;
  let generatedFallback: string | null = null;
  let computedDirection: string | null = null;
  let hasComputedDirection = false;
  const readComputedDirection = () => {
    if (!hasComputedDirection) {
      computedDirection =
        typeof getComputedStyle === 'function' ? getComputedStyle(source).direction : null;
      hasComputedDirection = true;
    }
    return computedDirection;
  };
  const result = scanDirectionAncestors(source, inheritedDirectionAttribute, readComputedDirection);
  inherited = result.inherited;
  generatedFallback = result.generatedFallback;
  return inherited ?? readComputedDirection() ?? generatedFallback;
}

function scanDirectionAncestors(
  source: HTMLElement,
  marker: string,
  readComputedDirection: () => string | null,
): { inherited: string | null | undefined; generatedFallback: string | null } {
  let inherited: string | null | undefined = null;
  let generatedFallback: string | null = null;
  let current: HTMLElement | null = source;
  let crossedGeneratedBoundary = false;
  while (current) {
    const matching = closestAcrossShadow(current, '[dir]');
    if (!matching) {
      current = getShadowHost(current);
      continue;
    }
    const result = resolveDirectionMatch(
      matching,
      marker,
      crossedGeneratedBoundary,
      readComputedDirection,
    );
    if (result.inherited !== undefined) {
      inherited = result.inherited;
      break;
    }
    generatedFallback ??= result.generatedFallback;
    crossedGeneratedBoundary = true;
    current = matching.parentElement ?? getShadowHost(matching);
  }
  return { inherited, generatedFallback };
}

function resolveDirectionMatch(
  matching: HTMLElement,
  marker: string,
  crossedGeneratedBoundary: boolean,
  readComputedDirection: () => string | null,
): { inherited: string | null | undefined; generatedFallback: string | null } {
  if (matching.hasAttribute(marker))
    return { inherited: undefined, generatedFallback: matching.getAttribute('dir') };
  const explicit = matching.getAttribute('dir');
  const normalized = explicit?.toLowerCase();
  if (crossedGeneratedBoundary)
    return { inherited: normalized === 'auto' ? 'auto' : null, generatedFallback: null };
  const documentDirection =
    matching === document.documentElement && normalized !== 'auto' ? readComputedDirection() : null;
  return {
    inherited: normalized === 'auto' ? normalized : documentDirection || explicit,
    generatedFallback: null,
  };
}

function resolveInheritedAttribute(
  source: HTMLElement | null | undefined,
  shouldInherit: boolean,
  selector: string,
): string | null {
  return shouldInherit && source
    ? (closestAcrossShadow(source, selector)?.getAttribute(selector.slice(1, -1)) ?? null)
    : null;
}

function applyDirection(
  element: HTMLElement,
  inherited: string | null | undefined,
  fallback: string | null,
  preservesExplicit: boolean | undefined,
  marker: string,
): void {
  const next = inherited ?? fallback;
  if (!next) {
    element.removeAttribute('dir');
    element.removeAttribute(marker);
    return;
  }
  element.setAttribute('dir', next);
  if (!preservesExplicit && inherited !== null) element.setAttribute(marker, 'true');
  else element.removeAttribute(marker);
}

function applyAttribute(
  element: HTMLElement,
  name: string,
  value: string | null | undefined,
  preserveEmpty = false,
): void {
  if (value || (preserveEmpty && value === '')) element.setAttribute(name, value ?? '');
  else element.removeAttribute(name);
}
