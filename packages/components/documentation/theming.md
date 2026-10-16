# Theming and dark mode

Cinder's color tokens are written with [`light-dark()`][mdn-light-dark]. That means the library doesn't ship a theme switcher, a context provider, or a class-toggling JavaScript runtime. Instead, **the active theme is whatever value `color-scheme` resolves to on the element where a token is read**. Cinder reads that signal through `light-dark()`, and every semantic color token follows automatically.

This page documents that contract, gives you a minimal Svelte recipe for a user-facing toggle, and shows how to wire the same control into a Storybook toolbar.

> [!NOTE] The toggle recipe uses Svelte 5 — runes (`$state`, `$effect`) plus the `bind:group` directive. Corvidae owns the Svelte version in its root dependency catalog, shared by Cinder and its consuming applications.

## The contract

Every semantic color token in [`tokens-base.css`](../src/styles/tokens-base.css) is defined like this:

```css
--cinder-surface-canvas: light-dark(oklch(96.5% 0.012 245), oklch(15% 0.035 245));
```

`light-dark(light-value, dark-value)` returns the first argument when the resolved `color-scheme` is `light`, and the second when it's `dark`. Cinder's `:root` block declares:

```css
color-scheme: light dark;
```

That tells the browser cinder supports both schemes _and_ that the active one should follow the user's OS preference by default. So a user on macOS with **Dark** appearance sees the dark tokens; a user on **Light** sees the light tokens. No additional configuration required.

To override the OS preference, cinder supports two related paths. They both influence `light-dark()` resolution, but only `data-theme` also gets Cinder's scoped semantic token redeclarations:

- **`data-theme` attribute**: set `data-theme="light"` or `data-theme="dark"` on `:root` (or any ancestor of the styled element). Cinder's stylesheet maps those attributes to `color-scheme` and pins the core semantic surface, text, border, overlay, interaction, status, and control tokens wherever the `[data-theme]` selector matches, including scoped subtree themes:

  ```css
  :root[data-theme='dark'] {
    color-scheme: dark;
  }
  :root[data-theme='light'] {
    color-scheme: light;
  }
  [data-theme='dark'] {
    color-scheme: dark;
    --cinder-surface: oklch(21% 0.04 245);
    --cinder-surface-raised: oklch(28% 0.045 245);
    --cinder-text-default: oklch(92% 0.02 245);
    --cinder-border-ink: oklch(86% 0.065 250);
    --cinder-accent-solid: oklch(72% 0.14 270);
    --cinder-ring-color: oklch(from var(--cinder-accent-solid) 0.7 0.14 h);
  }
  [data-theme='light'] {
    color-scheme: light;
    --cinder-surface: oklch(99.4% 0.002 255);
    --cinder-surface-raised: oklch(100% 0 255);
    --cinder-text-default: oklch(20% 0.018 245);
    --cinder-border-ink: oklch(20% 0.02 255);
    --cinder-accent-solid: oklch(50% 0.22 270);
    --cinder-ring-color: oklch(from var(--cinder-accent-solid) 0.55 0.16 h);
  }
  ```

- **Direct `color-scheme`**: set `color-scheme: light` or `color-scheme: dark` directly via CSS or inline style. This drives the `light-dark()` tokens, but it does not get the concrete scoped token redeclarations that Cinder wires to `[data-theme]`.

The toggle recipe below uses `data-theme` because it's a single attribute mutation, plays nicely with CSS selectors elsewhere in your app, and doesn't leave inline styles lying around after the component unmounts.

> [!NOTE] Because these `[data-theme]` selectors are not limited to `:root`, you can scope a theme override to a subtree — for example, a dark-themed navigation region embedded in an otherwise-light page. Cinder redeclares the core semantic tokens in that subtree, so components such as `Sidebar` and `Drawer` inherit the local dark surface, text, border, active, focus, and variant-control values without app-level token pinning. Nested `[data-theme='light']` scopes can switch those tokens back for a light island. If your app globally replaces Cinder's public tokens for custom branding, repeat those brand overrides in the scoped selector that should use them.

## Minimal Svelte toggle

Three states — `light`, `dark`, `system` — and a single source of truth: the `data-theme` attribute on `<html>`. Persist the user's choice in `localStorage` so it survives reloads, and apply it before paint so dark-mode users don't flash light first.

### The pre-paint script

This goes in your app's `<head>`, _before_ any stylesheet. It runs synchronously and sets `data-theme` on `<html>` before the first paint:

```html
<script>
  (function () {
    var theme = 'system';
    try {
      var stored = localStorage.getItem('app-theme');
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        theme = stored;
      }
    } catch (error) {
      /* localStorage may be unavailable (private mode, sandboxed iframe) — fall back to system */
    }
    // For light/dark, set the attribute so cinder's [data-theme] selectors apply.
    // For system, leave it unset so :root's `color-scheme: light dark` follows the OS preference.
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  })();
</script>
```

On SvelteKit, put the body inside the `%sveltekit.head%`-adjacent `<head>` block in `src/app.html`. On Vite + Svelte, it goes in `index.html`'s `<head>`. In both cases the inline script runs before external stylesheets load — SvelteKit injects its assets after the literal `<head>` contents you write — so the attribute is set before paint.

> [!TIP] The script only sets `data-theme` for explicit `light`/`dark` choices. For `system`, the absence of the attribute lets `:root`'s `color-scheme: light dark` declaration (shipped by cinder) fall through to the OS preference. Removing the attribute is what restores system-follow behavior — don't write `data-theme="system"` to the DOM.

> [!WARNING] The pre-paint script avoids "flash of incorrect theme" only for users who have already chosen `light` or `dark`. System-mode users rely on cinder's stylesheet (which declares `color-scheme: light dark` on `:root`) loading promptly. If your bundler defers the cinder stylesheet behind a slow code-split chunk, system-mode users may see a brief light flash before the stylesheet resolves. In practice this is invisible on production builds, but worth knowing about if you see it during development.

> [!TIP] The storage key (`'app-theme'`) is repeated in the pre-paint script and the toggle component below. Nothing enforces the match — a copy-paste typo silently breaks persistence. The pre-paint script must stay an inline classic `<script>` to run before stylesheets, so you can't `import` a shared constant into it. Either keep the two literals in sync by hand, or inject the value into your HTML template from your server/build system (a SvelteKit `transformPageChunk` hook or a Vite HTML transform).

### The toggle component

```svelte
<!-- ThemeToggle.svelte -->
<script lang="ts">
  type Theme = 'light' | 'dark' | 'system';

  // Must match the key used by the pre-paint script in app.html / index.html.
  const STORAGE_KEY = 'app-theme';
  const THEMES: readonly Theme[] = ['light', 'system', 'dark'];

  import { onMount } from 'svelte';

  // Initialize to 'system' on both server and client so the SSR-rendered
  // radio markup matches the first client render. After mount, read the
  // real value from the DOM (set by the pre-paint script) and reconcile
  // state. The `mounted` flag gates the write effect until that read has
  // happened, so the write effect can't clobber the pre-paint attribute
  // with the placeholder `'system'` value before `onMount` runs.
  let theme = $state<Theme>('system');
  let mounted = $state(false);

  onMount(() => {
    const value = document.documentElement.getAttribute('data-theme');
    theme = value === 'light' || value === 'dark' ? value : 'system';
    mounted = true;
  });

  function setTheme(next: Theme) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore — localStorage may be unavailable */
    }
    const root = document.documentElement;
    if (next === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', next);
    }
  }

  // Sync `theme` to the DOM and localStorage on every change. The `mounted`
  // guard prevents the first run (with the placeholder `'system'` value)
  // from running before `onMount` reads the real value out of the DOM. Once
  // `onMount` flips the flag, the effect runs once with the just-read value
  // (an idempotent re-write of the attribute and a re-write of localStorage)
  // and then reruns on every subsequent user change.
  $effect(() => {
    if (!mounted) return;
    setTheme(theme);
  });
</script>

<fieldset>
  <legend>Theme</legend>
  {#each THEMES as option}
    <label>
      <input type="radio" name="theme" value={option} bind:group={theme} />
      {option}
    </label>
  {/each}
</fieldset>
```

A few notes on what's happening:

- **`data-theme` is the only mutation.** The component never touches `color-scheme` directly; cinder's stylesheet does that translation. That keeps the DOM clean — no inline styles to remove later — and makes it trivial to query the active choice from elsewhere (`getAttribute('data-theme')`).
- **`system` removes the attribute** rather than setting `data-theme="system"`. The absence of the attribute is what lets `:root`'s default `color-scheme: light dark` fall back to the OS preference.
- **State starts at `'system'` on both server and client.** That matches the SSR-rendered radio markup to the first client render. The `onMount` callback reads the real value from the DOM (populated by the pre-paint script) and reconciles state; the `mounted` guard keeps the write effect from running with the placeholder value before that read. After mount, the effect runs once with the just-read value — an idempotent re-write of the same `data-theme` attribute — and then on every subsequent user change. Net result: no hydration mismatch.
- **Three options, not two.** A binary light/dark toggle hides the system option, which is what most users actually want.

That's the whole recipe. No store, no context, no provider.

### Reading the resolved scheme

`color-scheme: light dark` doesn't tell JavaScript which one is _active_ — only that both are supported. If you need to know the resolved value (for example, to swap a hand-authored SVG between light and dark variants), check the media query:

```ts
function getResolvedScheme(): 'light' | 'dark' {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
```

Listen on the same `MediaQueryList` (`addEventListener('change', …)`) if you need live updates when the user is in `system` mode and changes their OS appearance.

## Storybook toolbar integration

If your consumer app uses Storybook, you can wire the same `data-theme` mutation into a [global toolbar control][sb-toolbars]. Declare a `globalTypes` entry for the toolbar, set the initial value via `initialGlobals`, and use a decorator that mirrors the toolbar state onto `document.documentElement`:

```ts
// .storybook/preview.ts
import type { Preview } from '@storybook/svelte-vite';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color scheme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'system', title: 'System' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'system',
  },
  decorators: [
    (story, context) => {
      const theme = context.globals.theme as 'light' | 'dark' | 'system';
      const root = document.documentElement;
      if (theme === 'system') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', theme);
      }
      return story(context);
    },
  ],
};

export default preview;
```

Import cinder's stylesheet once in `.storybook/preview.ts` (or via a `preview-head.html` `<link>`), and every story renders against the active theme. The decorator runs on every story render, so flipping the toolbar control updates the canvas immediately.

> [!NOTE] The import is `@storybook/svelte-vite` (the Storybook 8/9 Svelte + Vite renderer), not the legacy `@storybook/svelte`. `initialGlobals` is the current home for the initial value of a global; older docs that put `defaultValue` directly on `globalTypes` describe Storybook 7 behavior.

> [!NOTE] Storybook's [`@storybook/addon-themes`][sb-addon-themes] ships a higher-level wrapper around this pattern. The hand-rolled version above is small enough that the addon is optional — pick whichever your team prefers.

If a story renders the `ThemeToggle` component itself, the toggle reads the current `data-theme` attribute on mount and writes back to `data-theme` (plus `localStorage`) independently of the toolbar global. That's by design for the toggle, but it does mean the two controls compete — flipping the toolbar overwrites the attribute, and flipping the toggle overwrites it again. For visual-regression tests of the toggle, mount it in a story with no other theme controls so the toolbar doesn't fight it.

## Why not a `ThemeSwitcher` component?

A full `ThemeSwitcher` isn't on the v1 roadmap. The recipe above is short enough to copy, and theming-as-a-component tends to bake in opinions (icon set, label copy, layout, focus styles) that don't survive contact with real apps. When two or three reference consumers ship a near-identical toggle and ask cinder to standardize it, that's the signal to promote the recipe into a component.

## Overriding tokens

Dark mode is the headline use of the token system, but the same mechanism themes _anything_. To re-skin cinder, override the documented design tokens on `:root` (or any ancestor of the styled subtree) and every component that consumes them follows:

```css
:root {
  --cinder-accent-solid: oklch(62% 0.22 25); /* a warmer brand accent */
  --cinder-radius-lg: 1.25rem; /* rounder cards and surfaces */
  --cinder-surface: oklch(95% 0.03 280);
}
```

To author a complete theme instead of hand-writing overrides, use the [theme builder](#the-theme-builder), which edits the whole public registry and exports a stylesheet that does this for every context.

### No migration-alias namespace

Cinder deliberately does not ship a second namespace of legacy, product-specific, or migration-only token aliases. The documented `--cinder-*` design tokens are the contract. A permanent alias layer obscures which values are live, lets stale mappings survive indefinitely, and turns another product's historical vocabulary into Cinder API.

When an application migrates from another token system, keep the temporary mapping in that application, update call sites to the Cinder tokens, and delete the mapping when the migration finishes. Do not add those aliases to Cinder's token registry or published styles.

The set of tokens you can safely override is exactly the table in [`tokens.md`](./tokens.md) — the global `--cinder-*` design tokens declared in `tokens-base.css`. You do **not** override a component's own implementation variables; those are not a stable API.

How do you know an override actually reaches a component, rather than hitting a hard-coded value the override can't touch? Two layers enforce it:

### Token categories

Every `--cinder-*` custom property a component references falls into one of four categories. Only the first is consumer-facing theme API:

| Category                            | Shape                                         | Who owns it              | Override it?                                                       |
| ----------------------------------- | --------------------------------------------- | ------------------------ | ------------------------------------------------------------------ |
| **Global design token**             | `--cinder-accent-solid`, `--cinder-radius-lg` | `tokens-base.css`        | **Yes** — this is the theme API.                                   |
| **Component override variable**     | `--cinder-color-picker-hue`                   | the component            | Advanced; per-component, documented in that component's variables. |
| **Private implementation variable** | `--_cinder-button-ring`                       | the component, internal  | No — not an API.                                                   |
| **Runtime-state variable**          | `--cinder-toast-height` (set from JS)         | the component at runtime | No — written by the component.                                     |

### The guards

Two local audits check component CSS against the override contract. Run them from the Corvidae root with `--strict` to reject regressions from their checked-in baselines.

- **Token-usage audit** ([`check-component-css-token-usage.ts`](../scripts/check-component-css-token-usage.ts)) classifies every `var(--cinder-*)` reference into the four categories above and reports any that resolve to nothing — a typo, a stale rename, or an undeclared "looks-like-a-token" name. Those references silently fall back to their inline default, so the component stops tracking the token system without any error. Run `bun components/cinder/scripts/check-component-css-token-usage.ts --strict` for the full inventory.

- **Raw-color audit** ([`check-component-css-raw-colors.ts`](../scripts/check-component-css-raw-colors.ts)) reports raw color values (`#hex`, `rgb()`, `hsl()`, `oklch()`, `light-dark()`) in component CSS — values that don't track token overrides. Not every raw color is debt: a color-domain control (a color picker's hue spectrum) or a structural pattern (a transparency checkerboard) is intrinsic. Mark those intentional sites inline so the audit classifies them correctly:

  ```css
  background: linear-gradient(
    /* … hue spectrum … */
  ); /* cinder-allow-raw-color: domain-rendering — the hue the user is picking */
  ```

  Anything unmarked counts as **migration debt** — a color that should become a token or a shared recipe.

When you fix debt (replace a raw color with a token, rename a stale reference), the baseline shrinks: run `bun components/cinder/scripts/check-component-css-raw-colors.ts --update-baseline` (or `bun components/cinder/scripts/check-component-css-token-usage.ts --update-baseline`) to record the new, lower floor.

### Proving it at paint time

The static guards catch leaks in source. A leak that only manifests when styles cascade is caught by the [`alternate-theme.playwright.ts`](../../../scripts/browser-fixtures/tests/alternate-theme.playwright.ts) browser fixture: it loads a real component, overrides documented `:root` tokens to deliberately distinct values, and asserts the component's _computed_ style changes. If a component hard-codes a value instead of consuming the token, the override is inert, the computed style doesn't move, and the test fails. Add a case here whenever you migrate a component family to tokens, so its themeability is locked in.

## The theme builder

The theme builder is the `/theme-builder` route of the playground application (`applications/playground`, package `@lostgradient/playground`). From the repository root, `bun run --filter=@lostgradient/playground dev` serves it, preferring port 5555; the application's static export (`bun run --filter=@lostgradient/playground build`) includes the route as well. The builder belongs to that private application. Cinder itself ships no builder component.

In the builder you browse every public token, edit it for the context you are previewing (light or dark crossed with default, reduced, or forced reduced motion), and watch Cinder components restyle in an isolated preview. The registry it edits, and how each token may be edited, is described in [Editing the full registry in the theme builder](./tokens.md#editing-the-full-registry-in-the-theme-builder). Your work is a draft saved in the browser (the toolbar shows Saved locally or Unsaved locally), edits are undoable, and a Checks pane reports on the current revision. The interaction and layout contract is [`theme-builder.md`](./theme-builder.md).

### Export formats

Export opens a dialog that takes one snapshot of the current revision, so every file in it describes the same revision. It offers five artifacts:

| Artifact                 | File name                                                                    | What it is                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cinder Theme v1 source   | `<name>-<id>.cinder-theme.json`                                              | The lossless envelope (`format: "com.lostgradient.cinder.theme"`, `version: 1`): the embedded Cinder base, your overrides in five trees (`shared`, `light`, `dark`, `reduced`, `forcedReduced`), and per-context CSS-only edits, aliases intact. It is a Cinder format, not a standard DTCG document. Import it to get the theme back exactly. |
| Deployment CSS           | `<name>-<id>.cinder-theme.css`                                               | A standalone stylesheet in the `cinder-theme` cascade layer covering all six contexts. It holds no reset and no component rules.                                                                                                                                                                                                               |
| Portable DTCG (complete) | `<name>-<light\|dark>-<default\|reduced\|forced-reduced-motion>.tokens.json` | Six [DTCG 2025.10](https://www.designtokens.org/tr/2025.10/format/) token documents, one per concrete context. Cinder-only metadata (CSS bindings, trusted CSS recipes, usage categories) is removed. Blocked when any token has no faithful DTCG form.                                                                                        |
| Portable subset          | the same six files plus `<name>-<id>.portability-report.json`                | The same documents without the tokens that have no faithful DTCG form. The report lists each omitted token and the reason, and nothing stands in for an omitted value.                                                                                                                                                                         |
| Validation report        | `<name>-<id>.validation-report.json`                                         | The exact Cinder base (package version and source digest) and revision checked, a findings summary, and the limitations that remain. It contains no timestamp.                                                                                                                                                                                 |

`<name>` is a slug of the theme's name and `<id>` is the first eight characters of its id.

Import ends in exactly one of four outcomes before it can touch your draft: a Cinder Theme v1 envelope, a DTCG token document (laid over the open theme's shared overrides), an unsupported profile, or invalid input. A standalone resolver or another token dialect is recognized and reported as unsupported rather than guessed at; the builder never converts it and never fetches anything it references. A failed import leaves your draft unchanged.

These gates apply to the exports that need a checked theme:

- An invalid source blocks the CSS and both portable exports. The source envelope stays available and is labeled Unvalidated.
- A theme written against a different Cinder base than the build ships cannot be evaluated, so only its source can leave.
- Accessibility errors block the CSS and both portable exports until you fix them in Checks.
- Needs review and Advisory findings hold those exports until you acknowledge them in the dialog. Acknowledging does not turn a finding into a pass, and the validation report keeps listing it.

### Example: export a theme and consume its CSS

This example is checked against the consumer fixture in [`fixtures/tokens-consumer/`](../fixtures/tokens-consumer/). The fixture loads a saved Cinder Theme v1 envelope, produces the deployment CSS through the public `@lostgradient/cinder/tokens/runtime` subpath, and compares the computed styles of a clean page that loads only Cinder's token stylesheet and the exported file against the builder's preview.

1. In the builder, make your edits, open Export, and download the Deployment CSS. Also download the Cinder Theme v1 source if you want to keep editing later.
2. Load the file in your application after Cinder's styles:

```html
<style>
  @layer cinder.tokens, cinder.foundation, cinder.components, cinder.utilities;
  @import url('/tokens.css') layer(cinder.tokens);
</style>
<link rel="stylesheet" href="/theme.css" />
```

The `<style>` block is the fixture's stand-in for Cinder's own styles, which `@lostgradient/cinder` loads into the `cinder.tokens` layer; `/theme.css` is the exported file. In an application that imports Cinder through a bundler, import the exported `.css` file after the module that imports `@lostgradient/cinder`.

The exported file begins with its own layer declaration, so it does not depend on the order your tooling parses stylesheets in:

```css
@layer cinder.tokens, cinder.foundation, cinder.components, cinder.utilities, cinder-theme;

@layer cinder-theme {
  :root {
    /* ... every public --cinder-* property ... */
  }
}
```

That order places `cinder-theme` after every Cinder layer, so its custom properties win over `cinder.tokens` whichever file is parsed first. Your own unlayered CSS still beats both, because unlayered rules outrank layered ones. The file sets `color-scheme: light dark` on `:root` and covers `[data-theme='light']` and `[data-theme='dark']` on the root or any descendant (including a portal container), the `prefers-reduced-motion` media query, and `data-reduced-motion="on"` for forced reduced motion. Fonts are exported as `font-family` stacks and are never fetched or bundled, so the rendered result depends on the fonts the browser has.

To produce the same file without the UI, for example in a build script, run the saved envelope through the runtime, the way the fixture's `check.mjs` does:

```ts
import { readFileSync, writeFileSync } from 'node:fs';

import {
  CINDER_BASE,
  applyCssOnlyOverrides,
  buildThemeSources,
  evaluateThemeProperties,
  renderThemeStylesheet,
  validateThemeSources,
} from '@lostgradient/cinder/tokens/runtime';

const envelope = JSON.parse(readFileSync('brand.cinder-theme.json', 'utf8'));
if (envelope.base.sourceDigest !== CINDER_BASE.sourceDigest) {
  throw new Error('The envelope was written against a different Cinder base.');
}

const sources = buildThemeSources(envelope, 1);
const { diagnostics } = validateThemeSources(sources);
if (diagnostics.length > 0) throw new Error(JSON.stringify(diagnostics.slice(0, 3)));

const evaluation = evaluateThemeProperties(sources);
if (!evaluation.ok) throw new Error('The theme does not evaluate.');

const maps = Object.fromEntries(
  evaluation.contexts.map(({ id }) => [
    id,
    applyCssOnlyOverrides(evaluation.properties[id], envelope.cssOverrides, id),
  ]),
);
writeFileSync('brand.css', renderThemeStylesheet(maps, { identity: envelope.name }));
```

This path skips the builder's export gates. It validates and evaluates the source but runs no accessibility checks, so run them in the builder or treat the result as unchecked. `bun run --filter=@lostgradient/cinder validate:consumer` runs the fixture's browserless check and its Chromium computed-style comparison; the browserless half also runs in `bun run test`.

### What the accessibility checks cover

The Checks pane and the validation report give scoped results for one revision of one theme across its six contexts. They are evidence about specific color pairings and Cinder's own guardrails. They do not certify a theme, a component, or an application as conforming to WCAG, and the builder never describes a theme as "Accessible" or "WCAG certified". The report states this itself.

What the builder measures from tokens, in every context:

- **Source validity.** The token runtime validates the source against DTCG 2025.10 and Cinder's semantic rules. An invalid source is reported first, and the other checks produce no results for that revision.
- **Text contrast, WCAG 2.2 1.4.3.** The unrounded contrast ratio of each text pairing over its composited background must be at least 4.5:1. A pairing is held to the 3:1 large-text threshold only when its rendered size and weight are known, and no pairing records one, so every text pairing is held to 4.5:1.
- **Non-text contrast, WCAG 2.2 1.4.11.** Control boundaries, focus indicators, and essential graphics must reach 3:1 against the adjacent color. Purely decorative separators are classified apart and are not held to 3:1. A disabled foreground has its ratio recorded with no threshold, because WCAG exempts inactive components.

A failed text or non-text measurement is an **accessibility error**, and it blocks the CSS and portable exports. Checks can propose a deterministic fix for a failing foreground color. The fix changes only that color, shows every value it would change before you apply it, and applies as one undoable step.

What is advisory or needs review:

- **Needs review.** A pairing that reaches a gradient, an image, an unknown or translucent background with no known backdrop, a missing value, or color syntax the evaluator does not support cannot be reduced to a ratio. It is reported as Needs review with no ratio. It blocks a passing report, and you can acknowledge it to release the exports.
- **Advisory.** Findings from Cinder's stricter guardrails, which are not WCAG requirements: numeric values outside their usage-profile range (for example opacity outside 0 to 1); perceptible floors for muted, faint, and status borders; consistent and ordered border tiers; chart-series distinguishability (chroma, CIEDE2000 distance, and lightness separation, which is a diagnostic and not a color-vision-deficiency proof); polarity ink contrast; APCA lightness contrast against Lc 60; and a note when a color lies outside sRGB and was clamped to be measured. You can acknowledge them, and they never change a result.

What the report does not cover, and says so in its limitations:

- Rendered criteria are not measured from your theme. Text resize (1.4.4), reflow (1.4.10), text spacing (1.4.12), focus visibility and focus not obscured (2.4.7, 2.4.11), target size (2.5.8), forced colors, and reduced motion are checked by the playground's browser suite (`applications/playground/tests/theme-builder-accessibility.playwright.ts`) against the builder and its reference scenes, not against your exported stylesheet. The builder's rule ledger lists them so the gap is visible.
- Keyboard operation end to end, error wording and labels (3.3.1, 3.3.2), and name, role, and value with assistive technology (4.1.2) need a person. Automated checks cover only part of them. The human accessibility review of the builder's own interface is recorded separately in [`theme-builder.a11y.md`](./theme-builder.a11y.md).
- Only the listed reference scenes and pairings are covered. Passing them does not prove every component combination in your application.
- Font availability and glyph metrics depend on the environment, and CSS parity is promised only against the exact Cinder base named in the report and the fonts available to the browser.
- Portable DTCG documents omit Cinder-only metadata, and the Cinder Theme v1 envelope is not a standard DTCG document.

[mdn-light-dark]: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark
[mdn-color-scheme]: https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme
[sb-toolbars]: https://storybook.js.org/docs/essentials/toolbars-and-globals
[sb-addon-themes]: https://github.com/storybookjs/storybook/tree/next/code/addons/themes
