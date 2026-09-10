/// <reference lib="dom" />
/**
 * CIN-242: every public color token is a COMPLETE CSS color value.
 *
 * The generator gates this structurally (`findBareColorComponents` in
 * `scripts/tokens/generate.ts`), but a structural check is a model of the CSS
 * parser, not the parser. This is the real-parser half: it hands each shipped
 * token's resolved value to the browser in the color positions that token is
 * actually used in and asserts the declaration STICKS.
 *
 * Every arm is probed, not just the default one. `[data-theme='light']` and
 * `[data-theme='dark']` each redeclare a large share of the corpus with their
 * own `cssRecipe` values, so a token can be complete at `:root` and broken in
 * one arm. Reading `:root` once would miss that entirely.
 *
 * That distinction is the whole point of the ticket. A bare OKLCH component
 * triplet (`light-dark(0% 0 0, 100% 0 0)`, authored so a call site can staple
 * its own alpha on) is not a color: assigned to `color` or `border-color` it
 * produces an invalid declaration, and CSS drops invalid declarations
 * SILENTLY. Nothing reports it -- not the contrast gate, which reads resolved
 * corpus data rather than the browser, and not a screenshot diff, because the
 * element simply keeps its inherited color. Setting the property and reading
 * it back is the only check that sees the drop.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

type RegistryEntry = {
  path: string;
  cssProperty: string;
  category?: string;
  public: boolean;
};

/** Every public `category: 'color'` token, read from the COMMITTED registry. */
const PUBLIC_COLOR_PROPERTIES: string[] = (() => {
  const registryPath = join(
    import.meta.dirname,
    '..',
    '..',
    'components',
    'src',
    'tokens',
    'registry.generated.json',
  );
  const parsed: unknown = JSON.parse(readFileSync(registryPath, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${registryPath} is not a JSON object.`);
  }
  const entries = Object.getOwnPropertyDescriptor(parsed, 'entries')?.value as unknown;
  if (!Array.isArray(entries)) throw new Error(`${registryPath} has no \`entries\` array.`);
  return (entries as RegistryEntry[])
    .filter((entry) => entry.category === 'color' && entry.public)
    .map((entry) => entry.cssProperty)
    .toSorted();
})();

/**
 * Color positions every color token has to survive. `box-shadow` is included
 * because a token used as a shadow color sits in a position where an invalid
 * color invalidates the WHOLE shorthand, not just the color -- the most
 * destructive of the three and the least visible.
 */
const COLOR_PROPERTIES = ['color', 'background-color', 'border-color'] as const;

/**
 * The theme states a token can be declared in: the default (system-driven
 * `light-dark()`), and each explicit `[data-theme]` override block.
 */
const THEMES = [null, 'light', 'dark'] as const;

test('every public color token parses in the color positions it is used in', async ({ page }) => {
  await page.goto('/page/button?snapshot=1');

  expect(PUBLIC_COLOR_PROPERTIES.length).toBeGreaterThan(100);

  const failures = await page.evaluate(
    ({ properties, colorProperties, themes }) => {
      const probe = document.createElement('div');
      document.body.append(probe);
      const dropped: string[] = [];
      const root = document.documentElement;
      const initialTheme = root.getAttribute('data-theme');

      for (const theme of themes) {
        if (theme === null) root.removeAttribute('data-theme');
        else root.setAttribute('data-theme', theme);
        const label = theme === null ? 'default' : `data-theme=${theme}`;
        // Re-read per arm: the attribute above changes what `:root` resolves
        // to. Within one arm it is stable, so this is hoisted out of the token
        // loop rather than read per token.
        const rootStyle = getComputedStyle(root);

        probeTokens(rootStyle, label);
      }

      if (initialTheme === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', initialTheme);

      probe.remove();
      return dropped;

      function probeTokens(rootStyle: CSSStyleDeclaration, label: string) {
        for (const property of properties) {
          // The token's computed value: the token stream after `var()`
          // substitution, which is exactly what a consumer's own declaration
          // would receive. These are UNREGISTERED custom properties (no
          // `@property` rule), so `color-mix()` and `light-dark()` are still
          // present here rather than collapsed to a color -- collapsing happens
          // when the value lands in a real color property, which is what the
          // probe below does and what this test is actually checking.
          const resolved = rootStyle.getPropertyValue(property).trim();
          if (resolved === '') {
            dropped.push(`[${label}] ${property}: declared no value at :root`);
            continue;
          }
          for (const colorProperty of colorProperties) {
            probe.style.setProperty(colorProperty, '');
            probe.style.setProperty(colorProperty, resolved);
            // An invalid color leaves the property unset: the assignment was
            // dropped. This is the silent failure the ticket is about.
            if (probe.style.getPropertyValue(colorProperty).trim() === '') {
              dropped.push(`[${label}] ${property} (${resolved}) is not a valid ${colorProperty}`);
            }
          }
          // A shadow color sits inside a shorthand, where an invalid color
          // invalidates the entire declaration.
          probe.style.setProperty('box-shadow', '');
          probe.style.setProperty('box-shadow', `0 1px 2px ${resolved}`);
          if (probe.style.getPropertyValue('box-shadow').trim() === '') {
            dropped.push(`[${label}] ${property} (${resolved}) is not a valid box-shadow color`);
          }
        }
      }
    },
    {
      properties: PUBLIC_COLOR_PROPERTIES,
      colorProperties: [...COLOR_PROPERTIES],
      themes: [...THEMES],
    },
  );

  expect(failures).toEqual([]);
});

test('a bare component triplet is rejected by the same probe, so the check has teeth', async ({
  page,
}) => {
  await page.goto('/page/button?snapshot=1');

  const outcome = await page.evaluate(() => {
    const probe = document.createElement('div');
    document.body.append(probe);
    const attempt = (value: string) => {
      probe.style.setProperty('border-color', '');
      probe.style.setProperty('border-color', value);
      return probe.style.getPropertyValue('border-color').trim();
    };
    // The rejected authoring shape from CIN-242's decision record, and the
    // ratified one, through the same code path.
    const result = { bare: attempt('0% 0 0'), complete: attempt('oklch(0% 0 0)') };
    probe.remove();
    return result;
  });

  expect(outcome.bare).toBe('');
  expect(outcome.complete).not.toBe('');
});
