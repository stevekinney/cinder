# Theming and dark mode

Cinder's color tokens are written with [`light-dark()`][mdn-light-dark]. That means the library doesn't ship a theme switcher, a context provider, or a class-toggling JavaScript runtime. Instead, **the active theme is whatever value `color-scheme` resolves to on the element where a token is read**. Cinder reads that signal through `light-dark()`, and every semantic color token follows automatically.

This page documents that contract, gives you a minimal Svelte recipe for a user-facing toggle, and shows how to wire the same control into a Storybook toolbar.

> [!NOTE]
> The toggle recipe uses Svelte 5 — runes (`$state`, `$effect`) plus the `bind:group` directive. Cinder supports `svelte >=5.55.0 <6` as its public peer dependency range, so any cinder consumer is already on Svelte 5.

## The contract

Every semantic color token in [`tokens-base.css`](../packages/components/src/styles/tokens-base.css) is defined like this:

```css
--cinder-bg: light-dark(oklch(96.5% 0.012 245), oklch(15% 0.035 245));
```

`light-dark(light-value, dark-value)` returns the first argument when the resolved `color-scheme` is `light`, and the second when it's `dark`. Cinder's `:root` block declares:

```css
color-scheme: light dark;
```

That tells the browser cinder supports both schemes _and_ that the active one should follow the user's OS preference by default. So a user on macOS with **Dark** appearance sees the dark tokens; a user on **Light** sees the light tokens. No additional configuration required.

To override the OS preference, cinder ships two equivalent paths. Pick one and stick with it inside a given app:

- **`data-theme` attribute**: set `data-theme="light"` or `data-theme="dark"` on `:root` (or any ancestor of the styled element). Cinder's stylesheet maps those attributes to `color-scheme` for you:

  ```css
  :root[data-theme='dark'] {
    color-scheme: dark;
  }
  :root[data-theme='light'] {
    color-scheme: light;
  }
  [data-theme='dark'] {
    color-scheme: dark;
  }
  [data-theme='light'] {
    color-scheme: light;
  }
  ```

- **Direct `color-scheme`**: set `color-scheme: light` or `color-scheme: dark` directly via CSS or inline style. Equivalent in outcome; useful when you don't want an attribute on your markup.

Both routes drive `light-dark()` identically. The toggle recipe below uses `data-theme` because it's a single attribute mutation, plays nicely with CSS selectors elsewhere in your app, and doesn't leave inline styles lying around after the component unmounts.

> [!NOTE]
> The non-root `[data-theme]` selectors mean you can scope a theme override to a subtree — for example, a dark-themed code preview embedded in an otherwise-light page. `light-dark()` resolves against the nearest ancestor with a concrete `color-scheme`, so nested overrides work without fighting global state.

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

> [!TIP]
> The script only sets `data-theme` for explicit `light`/`dark` choices. For `system`, the absence of the attribute lets `:root`'s `color-scheme: light dark` declaration (shipped by cinder) fall through to the OS preference. Removing the attribute is what restores system-follow behavior — don't write `data-theme="system"` to the DOM.

> [!WARNING]
> The pre-paint script avoids "flash of incorrect theme" only for users who have already chosen `light` or `dark`. System-mode users rely on cinder's stylesheet (which declares `color-scheme: light dark` on `:root`) loading promptly. If your bundler defers the cinder stylesheet behind a slow code-split chunk, system-mode users may see a brief light flash before the stylesheet resolves. In practice this is invisible on production builds, but worth knowing about if you see it during development.

> [!TIP]
> The storage key (`'app-theme'`) is repeated in the pre-paint script and the toggle component below. Nothing enforces the match — a copy-paste typo silently breaks persistence. The pre-paint script must stay an inline classic `<script>` to run before stylesheets, so you can't `import` a shared constant into it. Either keep the two literals in sync by hand, or inject the value into your HTML template from your server/build system (a SvelteKit `transformPageChunk` hook or a Vite HTML transform).

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

> [!NOTE]
> The import is `@storybook/svelte-vite` (the Storybook 8/9 Svelte + Vite renderer), not the legacy `@storybook/svelte`. `initialGlobals` is the current home for the initial value of a global; older docs that put `defaultValue` directly on `globalTypes` describe Storybook 7 behavior.

> [!NOTE]
> Storybook's [`@storybook/addon-themes`][sb-addon-themes] ships a higher-level wrapper around this pattern. The hand-rolled version above is small enough that the addon is optional — pick whichever your team prefers.

If a story renders the `ThemeToggle` component itself, the toggle reads the current `data-theme` attribute on mount and writes back to `data-theme` (plus `localStorage`) independently of the toolbar global. That's by design for the toggle, but it does mean the two controls compete — flipping the toolbar overwrites the attribute, and flipping the toggle overwrites it again. For visual-regression tests of the toggle, mount it in a story with no other theme controls so the toolbar doesn't fight it.

## Why not a `ThemeSwitcher` component?

A full `ThemeSwitcher` isn't on the v1 roadmap. The recipe above is short enough to copy, and theming-as-a-component tends to bake in opinions (icon set, label copy, layout, focus styles) that don't survive contact with real apps. When two or three reference consumers ship a near-identical toggle and ask cinder to standardize it, that's the signal to promote the recipe into a component.

[mdn-light-dark]: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark
[mdn-color-scheme]: https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme
[sb-toolbars]: https://storybook.js.org/docs/essentials/toolbars-and-globals
[sb-addon-themes]: https://github.com/storybookjs/storybook/tree/next/code/addons/themes
