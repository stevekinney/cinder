import { getShadowHost } from './portal.utilities-events.svelte.ts';

const typographyProperties = [
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
];

export function getInheritedPortalStyle(source: HTMLElement | null | undefined): string {
  if (!source || typeof window === 'undefined') return '';
  const computed = getComputedStyle(source);
  const typographySource = hasDirectTypography(source) ? source : (source.parentElement ?? source);
  const typography = getComputedStyle(typographySource);
  const inherited = document.createElement('div').style;
  const customPropertyNames = collectCustomPropertyNames(source, computed);
  for (const property of customPropertyNames) {
    const value = computed.getPropertyValue(property);
    if (value) inherited.setProperty(property, value);
  }
  copyComputedProperties(inherited, typography, typographyProperties);
  copyDirectionAndColor(inherited, source, computed);
  copyExplicitCustomProperties(inherited, source);
  if (source.style.colorScheme) inherited.setProperty('color-scheme', source.style.colorScheme);
  return inherited.cssText;
}

function copyDirectionAndColor(
  target: CSSStyleDeclaration,
  source: HTMLElement,
  computed: CSSStyleDeclaration,
): void {
  const colorScheme = computed.colorScheme || source.style.colorScheme;
  if (colorScheme) target.setProperty('color-scheme', colorScheme);
  if (!source.hasAttribute('dir') && computed.direction) {
    target.setProperty('direction', computed.direction);
  }
}

function hasDirectTypography(source: HTMLElement): boolean {
  return (
    source.tagName === 'NAV' ||
    (source.parentElement === null &&
      typographyProperties.some((property) => source.style.getPropertyValue(property) !== ''))
  );
}

function collectCustomPropertyNames(
  source: HTMLElement,
  computed: CSSStyleDeclaration,
): Set<string> {
  const names = new Set<string>();
  let current: HTMLElement | null = source;
  while (current) {
    for (const property of Array.from(current.style)) {
      if (property.startsWith('--cinder-')) names.add(property);
    }
    current = current.parentElement ?? getShadowHost(current);
  }
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    if (property.startsWith('--cinder-')) names.add(property);
  }
  return names;
}

function copyComputedProperties(
  target: CSSStyleDeclaration,
  source: CSSStyleDeclaration,
  properties: readonly string[],
): void {
  for (const property of properties) {
    const value = source.getPropertyValue(property);
    if (value) target.setProperty(property, value);
  }
}

function copyExplicitCustomProperties(target: CSSStyleDeclaration, source: HTMLElement): void {
  for (const property of Array.from(source.style)) {
    if (!property.startsWith('--cinder-')) continue;
    const value = source.style.getPropertyValue(property);
    if (!value.includes('var(')) target.setProperty(property, value);
  }
}
