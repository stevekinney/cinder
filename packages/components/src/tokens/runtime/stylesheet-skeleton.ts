/**
 * The selector and media skeleton of a Cinder token stylesheet.
 *
 * The generator (`tokens-base.css`) and the theme builder's deployment CSS both fill this
 * one template, so the root/descendant `[data-theme]`, `prefers-reduced-motion` and
 * `[data-reduced-motion]` precedence contract is written down exactly once. Each field is
 * a block of ready-made declarations (without braces); an empty block is not emitted
 * where the contract allows omitting it.
 */

export type StylesheetDeclarations = {
  /** The `:root` declarations every context starts from. */
  root: string;
  /** Declarations for `[data-theme='dark']` / `[data-theme='light']`, root or descendant. */
  dark: string;
  light: string;
  /** `prefers-reduced-motion: reduce`, with no theme named. */
  reducedMotion: string;
  darkReducedMotion: string;
  lightReducedMotion: string;
  /** `[data-reduced-motion='on']`, with no theme named. */
  forcedReducedMotion: string;
  darkForcedReducedMotion: string;
  lightForcedReducedMotion: string;
  /**
   * Declarations for a root with no `data-theme` under `prefers-color-scheme: dark`. The
   * generator leaves this empty (its `:root` uses `light-dark()`); a complete theme needs it.
   */
  systemDark?: string;
};

const NOT_FORCED_OFF =
  ":not([data-cinder-reduced-motion='false']):not([data-reduced-motion='off']):not([data-reduced-motion='on'])";

function themeBlock(theme: 'dark' | 'light', declarations: string): string {
  return declarations
    ? `:root${NOT_FORCED_OFF} [data-theme='${theme}'],
:root[data-theme='${theme}']${NOT_FORCED_OFF} {
${declarations}
}`
    : '';
}

function reducedSystemBlock(scheme: 'dark' | 'light', declarations: string): string {
  return declarations
    ? `@media (prefers-color-scheme: ${scheme}) {
  :root:not([data-theme])${NOT_FORCED_OFF} {
${declarations}
  }
}`
    : '';
}

function forcedThemeBlock(theme: 'dark' | 'light', declarations: string): string {
  return declarations
    ? `:root[data-reduced-motion='on'] [data-theme='${theme}'],
:root[data-reduced-motion='on'][data-theme='${theme}'] {
${declarations}
}`
    : '';
}

/** Everything after the file header: `:root` through the forced-motion blocks. */
export function renderStylesheetSkeleton(d: StylesheetDeclarations): string {
  const systemDark = d.systemDark
    ? `@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
${d.systemDark}
  }
}

`
    : '';
  return `:root {
  /* Structural: not a design token. */
  color-scheme: light dark;

${d.root}
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

${d.dark}
}

[data-theme='light'] {
  /* Structural: not a design token. */
  color-scheme: light;

${d.light}
}

${systemDark}@media (prefers-reduced-motion: reduce) {
  :root${NOT_FORCED_OFF} {
${d.reducedMotion}
  }
${themeBlock('dark', d.darkReducedMotion)}
${themeBlock('light', d.lightReducedMotion)}
${reducedSystemBlock('dark', d.darkReducedMotion)}
${reducedSystemBlock('light', d.lightReducedMotion)}
}

:root[data-reduced-motion='on'] {
${d.forcedReducedMotion}
}
${forcedThemeBlock('dark', d.darkForcedReducedMotion)}
${forcedThemeBlock('light', d.lightForcedReducedMotion)}
${d.darkForcedReducedMotion ? `@media (prefers-color-scheme: dark) {\n  :root[data-reduced-motion='on']:not([data-theme]) {\n${d.darkForcedReducedMotion}\n  }\n}` : ''}
${d.lightForcedReducedMotion ? `@media (prefers-color-scheme: light) {\n  :root[data-reduced-motion='on']:not([data-theme]) {\n${d.lightForcedReducedMotion}\n  }\n}` : ''}
`;
}
