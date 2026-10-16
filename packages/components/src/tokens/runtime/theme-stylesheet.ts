/**
 * Deployment CSS for a theme: a complete standalone stylesheet built from the six evaluated
 * property maps, written into the `cinder-theme` cascade layer.
 *
 * The maps are exactly what the theme builder's preview applies for each concrete context,
 * so the stylesheet reproduces the preview by construction. The selector and media
 * structure is the generator's own (`renderStylesheetSkeleton`): root and descendant
 * `[data-theme]` blocks, `prefers-reduced-motion` and `[data-reduced-motion='on']` blocks
 * with the same precedence. This module only decides which declarations go in which block.
 * It emits no reset, preflight or component selector.
 *
 * Nothing is trusted: a property name outside `--cinder-*` or a value that could close a
 * declaration, open a rule, add a comment or fetch a resource throws instead of being
 * written into a stylesheet.
 */

import { renderStylesheetSkeleton } from './stylesheet-skeleton.ts';

export type StylesheetContext =
  | 'light/default'
  | 'light/reduced'
  | 'light/forced-reduced-motion'
  | 'dark/default'
  | 'dark/reduced'
  | 'dark/forced-reduced-motion';

export type ContextProperties = Readonly<
  Record<StylesheetContext, Readonly<Record<string, string>>>
>;

export const THEME_LAYER = 'cinder-theme';
const LAYER_ORDER = `cinder.tokens, cinder.foundation, cinder.components, cinder.utilities, ${THEME_LAYER}`;

const PROPERTY_NAME = /^--cinder-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UNSAFE_VALUE = /[;{}\\<>@!]|\/\*|\*\/|url\(|image\(|image-set\(|src\(|expression\(/i;

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) < 32) return true;
  }
  return false;
}

export class StylesheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StylesheetError';
  }
}

function declaration(name: string, value: string): string {
  if (!PROPERTY_NAME.test(name)) throw new StylesheetError(`"${name}" is not a Cinder property.`);
  if (value.trim() === '' || UNSAFE_VALUE.test(value) || hasControlCharacter(value)) {
    throw new StylesheetError(`The value of ${name} is not a plain CSS value.`);
  }
  return `  ${name}: ${value};`;
}

function lines(names: Iterable<string>, values: Readonly<Record<string, string>>): string {
  return [...names]
    .sort()
    .filter((name) => values[name] !== undefined)
    .map((name) => declaration(name, values[name] ?? ''))
    .join('\n');
}

function differing(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): Set<string> {
  const names = new Set([...Object.keys(left), ...Object.keys(right)]);
  return new Set([...names].filter((name) => left[name] !== right[name]));
}

const REFERENCE = /var\(\s*(--[\w-]+)/g;

/**
 * Custom properties substitute `var()` where they are declared, so a nested scope inherits
 * the substituted value of an alias declared above it. Whenever a property changes in a
 * block, every property whose value reads it, directly or through other properties, must be
 * declared in that block too (the generator's "dependent aliases"). `sources` are every map
 * whose text may refer to a changed property.
 */
function withDependents(
  seed: ReadonlySet<string>,
  sources: ReadonlyArray<Readonly<Record<string, string>>>,
): Set<string> {
  const references = new Map<string, Set<string>>();
  for (const source of sources) {
    for (const [name, value] of Object.entries(source)) {
      const found = references.get(name) ?? new Set<string>();
      for (const match of value.matchAll(REFERENCE)) found.add(match[1] ?? '');
      references.set(name, found);
    }
  }
  const result = new Set(seed);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, found] of references) {
      if (!result.has(name) && [...found].some((reference) => result.has(reference))) {
        result.add(name);
        grew = true;
      }
    }
  }
  return result;
}

function comment(text: string): string {
  return text.replace(/\*\//g, '* /').replace(/[\r\n]+/g, ' ');
}

export type ThemeStylesheetOptions = {
  /** One line naming the theme and the exact Cinder base it was checked against. */
  identity?: string;
};

type MotionName = 'reduced' | 'forced-reduced-motion';

/** The declarations a motion block restates for one theme. */
function motionDeclarations(
  maps: ContextProperties,
  theme: 'light' | 'dark',
  motion: MotionName,
): string {
  const system = differing(maps[`light/${motion}`], maps['light/default']);
  const own = differing(maps[`${theme}/${motion}`], maps[`${theme}/default`]);
  const names = withDependents(new Set([...system, ...own]), [
    maps[`${theme}/${motion}`],
    maps[`${theme}/default`],
    maps[`light/${motion}`],
  ]);
  return lines(names, maps[`${theme}/${motion}`]);
}

/**
 * The stylesheet for six evaluated contexts. Every public property of `light/default` is
 * declared on `:root`; the dark theme block, the system-dark root and each motion block
 * restate only what differs, with the generator's precedence.
 */
export function renderThemeStylesheet(
  maps: ContextProperties,
  options: ThemeStylesheetOptions = {},
): string {
  const light = maps['light/default'];
  const dark = maps['dark/default'];
  const themeDiff = withDependents(differing(light, dark), [light, dark]);
  const css = renderStylesheetSkeleton({
    root: lines(Object.keys(light), light),
    dark: lines(themeDiff, dark),
    light: lines(themeDiff, light),
    systemDark: lines(themeDiff, dark),
    reducedMotion: motionDeclarations(maps, 'light', 'reduced'),
    darkReducedMotion: motionDeclarations(maps, 'dark', 'reduced'),
    lightReducedMotion: motionDeclarations(maps, 'light', 'reduced'),
    forcedReducedMotion: motionDeclarations(maps, 'light', 'forced-reduced-motion'),
    darkForcedReducedMotion: motionDeclarations(maps, 'dark', 'forced-reduced-motion'),
    lightForcedReducedMotion: motionDeclarations(maps, 'light', 'forced-reduced-motion'),
  });
  const identity = options.identity === undefined ? '' : ` * ${comment(options.identity)}\n`;
  return `/*
 * Cinder theme stylesheet. Complete and standalone: no reset, no preflight, no component rules.
${identity} *
 * Load it after Cinder's own styles. The layer order below puts ${THEME_LAYER} after every Cinder
 * layer, so the theme wins whichever stylesheet is parsed first.
 * Set data-theme="light" or "dark" on the root (or any descendant, including a portal
 * container); data-reduced-motion="on" forces reduced motion.
 * Fonts: font-family stacks are exported as written. Whether a font is installed, and its
 * glyph metrics, depend on the environment that renders the page.
 */
@layer ${LAYER_ORDER};

@layer ${THEME_LAYER} {
${css}}
`;
}
