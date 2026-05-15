# Theming and dark mode

Cinder's color tokens are written with [`light-dark()`][mdn-light-dark]. That means the library doesn't ship a theme switcher, a context provider, or a class-toggling JavaScript runtime. Instead, **the active theme is whatever value `color-scheme` resolves to on your root element**. Cinder reads that signal through `light-dark()`, and every semantic color token follows automatically.

This page documents that contract, gives you a minimal Svelte recipe for a user-facing toggle, and shows how to wire the same control into a Storybook toolbar.

## The contract

Every semantic color token in [`tokens-base.css`](../packages/components/src/styles/tokens-base.css) is defined like this:

```css
--cinder-bg: light-dark(oklch(96.5% 0.012 245), oklch(15% 0.035 245));
```

`light-dark(light-value, dark-value)` returns the first argument when the element's [`color-scheme`][mdn-color-scheme] resolves to `light`, and the second when it resolves to `dark`. Cinder's `:root` block declares:

```css
color-scheme: light dark;
```

That tells the browser cinder supports both schemes _and_ that the active one should follow the user's OS preference by default. Concretely:

- A user on macOS with **Auto** or **Dark** appearance sees dark tokens.
- A user on macOS with **Light** appearance sees light tokens.
- A consuming app that wants to override the OS preference sets `color-scheme: light` or `color-scheme: dark` on `:root` (or any ancestor), and `light-dark()` resolves from there.

That last bullet is the whole API. There is no `ThemeProvider`, no `data-theme` attribute to set, no `.dark` class to toggle. **Set `color-scheme` on `:root`** — cinder's tokens follow.

> [!NOTE]
> `light-dark()` needs a concrete `color-scheme` declaration on the element (or an ancestor) to resolve correctly. Cinder declares it on `:root` in `tokens-base.css`, so you don't have to. If you override it lower in the tree, make sure you set `color-scheme` on the same element.

## Minimal Svelte toggle

Three states — `light`, `dark`, `system` — and a single mutation: write `color-scheme` on the root element. Persist the user's choice in `localStorage` so it survives reloads, and apply it before paint so dark-mode users don't flash light first.

### The pre-paint script

Put this in your app's `<head>`, _before_ any stylesheet. It runs synchronously, reads the persisted choice, and sets `color-scheme` on `:root` before the first paint:

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
      /* localStorage may be unavailable in private mode — fall back to system */
    }
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.style.colorScheme = theme;
    }
    // Reflect the choice so CSS can branch on it (e.g. icon swap for "system" mode).
    document.documentElement.dataset.theme = theme;
  })();
</script>
```

If you're on SvelteKit, drop the same body into `src/app.html` inside the `<head>`. If you're on Vite + Svelte, it goes in `index.html`.

> [!TIP]
> Reading `localStorage` synchronously in `<head>` is the standard pattern for avoiding a "flash of incorrect theme." A 2KB inline script that runs before paint is cheaper than the flash.

### The toggle component

```svelte
<!-- ThemeToggle.svelte -->
<script lang="ts">
  type Theme = 'light' | 'dark' | 'system';

  const STORAGE_KEY = 'app-theme';

  let theme = $state<Theme>(readStoredTheme());

  function readStoredTheme(): Theme {
    if (typeof localStorage === 'undefined') return 'system';
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  }

  function setTheme(next: Theme) {
    theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    const root = document.documentElement;
    root.dataset.theme = next;
    if (next === 'system') {
      root.style.removeProperty('color-scheme');
    } else {
      root.style.colorScheme = next;
    }
  }
</script>

<fieldset>
  <legend>Theme</legend>
  {#each ['light', 'system', 'dark'] as const as option}
    <label>
      <input
        type="radio"
        name="theme"
        value={option}
        checked={theme === option}
        onchange={() => setTheme(option)}
      />
      {option}
    </label>
  {/each}
</fieldset>
```

A few notes on what's happening:

- **`system` clears the inline `color-scheme`**, which lets the `:root` declaration (`light dark`) fall back to the OS preference. Don't set `color-scheme: light dark` explicitly here — _removing_ the property is what restores the system-follows behavior.
- **`data-theme` reflects the choice itself**, not the resolved scheme. Use it when you need to render a different control state for "system" — `color-scheme` alone can't tell you whether the user picked dark or whether dark was inferred.
- **Three options, not two.** A binary light/dark toggle hides the system option, which is what most users actually want. If you must ship a two-state switch, default to `system` and let the toggle move between `light` and `dark` only.

That's the whole recipe. No store, no context, no provider. `color-scheme` on `:root` is the source of truth, and cinder's tokens read from it.

## Storybook toolbar integration

If your consumer app uses Storybook, you can wire the same `color-scheme` mutation into a [global toolbar control][sb-toolbars]. The pattern: declare a `globalTypes` entry for the theme, then use a decorator that applies the value to `document.documentElement`.

```ts
// .storybook/preview.ts
import type { Preview } from '@storybook/svelte';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color scheme',
      defaultValue: 'system',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'system', title: 'System' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (story, context) => {
      const theme = context.globals.theme as 'light' | 'dark' | 'system';
      const root = document.documentElement;
      root.dataset.theme = theme;
      if (theme === 'system') {
        root.style.removeProperty('color-scheme');
      } else {
        root.style.colorScheme = theme;
      }
      return story();
    },
  ],
};

export default preview;
```

Import cinder's stylesheet once in `.storybook/preview.ts` (or via a `preview-head.html` `<link>`), and every story renders against the active theme. The decorator runs on every story render, so flipping the toolbar control updates the canvas immediately.

> [!NOTE]
> Storybook's [`@storybook/addon-themes`][sb-addon-themes] ships a higher-level wrapper around this pattern. The hand-rolled version above is small enough that the addon is optional — pick whichever your team prefers.

## When you need more than `color-scheme`

A few cases the simple recipe doesn't cover:

- **Reading the resolved scheme in JavaScript.** `color-scheme: light dark` doesn't tell you which one is active. Use `window.matchMedia('(prefers-color-scheme: dark)').matches` to check, and listen on the same `MediaQueryList` for live updates when the user is in `system` mode.
- **Per-region theme overrides.** Setting `color-scheme: dark` on a nested element (a code block on a light-themed page, for example) re-resolves cinder's tokens inside that scope. `light-dark()` is fully nestable — there is no global theme to fight against.
- **Custom semantic tokens.** If you add your own `--app-*` tokens, define them with `light-dark()` too. They'll resolve from the same `color-scheme` cinder reads, so a single toggle controls everything.

A full `ThemeSwitcher` component isn't on the v1 roadmap. The recipe above is short enough to copy, and theming-as-a-component tends to bake in opinions (icon set, label copy, layout) that don't survive contact with real apps.

[mdn-light-dark]: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark
[mdn-color-scheme]: https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme
[sb-toolbars]: https://storybook.js.org/docs/essentials/toolbars-and-globals
[sb-addon-themes]: https://github.com/storybookjs/storybook/tree/next/code/addons/themes
