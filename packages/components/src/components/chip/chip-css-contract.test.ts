/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: Chip } = await import('./chip.svelte');

afterEach(() => cleanup());

const chipCss = await Bun.file(new URL('./chip.css', import.meta.url)).text();

function appendChipStyles() {
  const style = document.createElement('style');
  style.textContent = chipCss;
  document.head.append(style);
  return () => style.remove();
}

function rootSurface(chip: Element) {
  const style = getComputedStyle(chip);
  return {
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    borderRadius: style.borderRadius,
  };
}

function cssRuleBody(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return chipCss.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`))?.[1] ?? '';
}

describe('Chip surface and CSS contracts', () => {
  test('resting display, toggle, and removable roots share the same computed surface', () => {
    const removeChipStyles = appendChipStyles();
    try {
      const display = render(Chip, { label: 'Display chip' });
      const toggle = render(Chip, { mode: 'toggle', label: 'Toggle chip', pressed: false });
      const removable = render(Chip, { mode: 'removable', label: 'Removable chip' });

      const chips = [display.container, toggle.container, removable.container].map((container) => {
        const chip = container.querySelector('.cinder-chip');
        expect(chip).not.toBeNull();
        return requiredInstance(chip, Element);
      });
      const surfaces = chips.map(rootSurface);

      expect(surfaces[1]).toEqual(surfaces[0]);
      expect(surfaces[2]).toEqual(surfaces[0]);
    } finally {
      removeChipStyles();
    }
  });

  test('neutral pressed toggle stays on the shared selected-surface recipe', () => {
    const body = cssRuleBody(".cinder-chip[aria-pressed='true'][data-cinder-variant='neutral']");
    expect(body).toContain('background: var(--cinder-surface-pressed)');
    expect(body).toContain('color: var(--cinder-text-default)');
    expect(body).toContain('border-color: var(--cinder-border-strong)');
    expect(body).not.toContain('background: var(--cinder-text-default)');
    expect(body).not.toContain('color: var(--cinder-surface-inset)');
  });

  test('remove button hover uses a circular hover surface without overriding variant color', () => {
    const body = cssRuleBody('.cinder-chip__remove:hover:not(:disabled)');
    expect(body).toContain('background-color: var(--cinder-surface-hover)');
    expect(body).not.toContain('color: var(--cinder-text-default)');
    expect(chipCss).toContain('border-radius: var(--cinder-radius-full)');
  });

  // Native attribute passthrough regression tests.
  // These guard that the HTMLAttributes union extension works end-to-end:
  // arbitrary native attrs reach the DOM, but component-controlled attrs cannot be clobbered.
});

describe('Chip disabled-label contrast guard', () => {
  const css = readFileSync(new URL('./chip.css', import.meta.url), 'utf8');

  test('disabled chip label uses the --cinder-text-disabled token (both paths)', () => {
    const block = css.match(
      /\.cinder-chip\[data-cinder-disabled\]\s*\.cinder-chip__label,\s*button\.cinder-chip:disabled\s*\.cinder-chip__label[\s\S]*?\{[^}]*\}/,
    )?.[0];
    expect(block).toBeDefined();
    expect(block).toContain('color: var(--cinder-text-disabled)');
  });

  test('the disabled chip root does NOT use opacity (would trap the label below AA)', () => {
    // Mute is expressed via color tokens, never a root opacity that composites
    // the label down. The two disabled-root selectors share one combined rule
    // (`button.cinder-chip:disabled, .cinder-chip[data-cinder-disabled] { … }`).
    // Match either selector order — grouped-selector order is cosmetic and a
    // formatter could swap it without changing behavior. Assert no `opacity:`
    // declaration appears in that rule body; the label and icon rules below it
    // set their own colors and are matched separately.
    const buttonFirst =
      /button\.cinder-chip:disabled,\s*\.cinder-chip\[data-cinder-disabled\]\s*\{[^}]*\}/;
    const attrFirst =
      /\.cinder-chip\[data-cinder-disabled\],\s*button\.cinder-chip:disabled\s*\{[^}]*\}/;
    const disabledRoot = (css.match(buttonFirst) ?? css.match(attrFirst))?.[0];
    expect(disabledRoot).toBeDefined();
    expect(disabledRoot).not.toContain('opacity');
  });
});

// Source-level guard: pressed semantic chips must pair the solid accent
// background with its readable *-contrast foreground token, never the soft
// `*-bg` tint that rendered unreadable. Asserting `aria-pressed` alone would
// not catch a foreground regression, so we read the stylesheet directly.
describe('Chip pressed-state foreground tokens', () => {
  const css = readFileSync(new URL('./chip.css', import.meta.url), 'utf8');

  test.each([
    ['success', '--cinder-status-success-contrast', '--cinder-status-success-background'],
    ['warning', '--cinder-status-warning-contrast', '--cinder-status-warning-background'],
    ['danger', '--cinder-status-danger-contrast', '--cinder-status-danger-background'],
    ['info', '--cinder-status-info-contrast', '--cinder-status-info-background'],
  ] as const)(
    'pressed %s chip uses the contrast token, not the soft tint',
    (variant, contrastToken, softTint) => {
      // Selector attribute order matters for this regex: [aria-pressed] then
      // [data-cinder-variant]. The `[^}]*` body match assumes flat rules (no
      // nesting), which holds for these pressed-state declarations.
      const block = css.match(
        new RegExp(
          `\\.cinder-chip\\[aria-pressed='true'\\]\\[data-cinder-variant='${variant}'\\]\\s*\\{[^}]*\\}`,
        ),
      )?.[0];
      expect(block).toBeDefined();
      // Pin the assertion to the `color:` declaration specifically, so a stray
      // mention of the banned token in a comment or another property can't
      // produce a false pass/fail.
      const colorDeclaration = block?.match(/\bcolor:\s*[^;]+;/)?.[0];
      expect(colorDeclaration).toBe(`color: var(${contrastToken});`);
      expect(colorDeclaration).not.toContain(softTint);
    },
  );
});
