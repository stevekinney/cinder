/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: Chip } = await import('./chip.svelte');

afterEach(() => cleanup());

const chipCss = await Bun.file(new URL('./chip.css', import.meta.url)).text();

function cssRuleBody(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return chipCss.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`))?.[1] ?? '';
}

describe('Chip display and brand styling', () => {
  test('display mode renders a span root with data-cinder-mode="display"', () => {
    const { container } = render(Chip, { label: 'Hello' });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.tagName.toLowerCase()).toBe('span');
    expect(chip?.getAttribute('data-cinder-mode')).toBe('display');
    expect(chip?.querySelector('button')).toBeNull();
  });

  test('brandColor uses a semantic foreground with a restrained brand tint', () => {
    const { container } = render(Chip, { label: 'Acme', brandColor: '#ff6600' });
    const chip = requiredInstance(container.querySelector('.cinder-chip'), HTMLElement);
    expect(chip.style.getPropertyValue('--_cinder-chip-brand-color')).toBe('#ff6600');
    const rule = cssRuleBody(
      ".cinder-chip[data-cinder-variant='neutral']:not(:disabled):not([data-cinder-disabled]):not(\n      :focus-visible\n    )[style*='--_cinder-chip-brand-color']",
    );
    expect(rule).toContain('color: var(--cinder-text-default);');
    expect(rule).toContain('var(--_cinder-chip-brand-color) 8%');
    expect(rule).not.toMatch(/(?:^|\n)\s*color:\s*color-mix/);
    expect(
      chipCss.indexOf(
        ".cinder-chip[data-cinder-variant='neutral']:not(:disabled):not([data-cinder-disabled]):not(\n      :focus-visible\n    )[style*='--_cinder-chip-brand-color']",
      ),
    ).toBeGreaterThan(chipCss.indexOf(".cinder-chip[data-cinder-variant='accent']"));
  });

  test('breakable chips expose the URL wrapping and bidi layout contract', () => {
    const { container } = render(Chip, {
      label: 'https://example.com/a-very-long-url',
      breakable: true,
    });
    const chip = container.querySelector('.cinder-chip');
    expect(chip?.getAttribute('data-cinder-breakable')).toBe('true');
    expect(chipCss).toMatch(/overflow-wrap:\s*anywhere/);
    expect(chipCss).toMatch(/unicode-bidi:\s*isolate/);
    expect(chipCss).toMatch(/flex:\s*0 0 auto/);
    expect(chipCss).toMatch(
      /\.cinder-chip\[data-cinder-breakable\] \.cinder-chip__remove[\s\S]*?flex:\s*0 0 auto/,
    );
  });

  test('brandColor selector is scoped to neutral chips', () => {
    expect(chipCss).toContain(
      ".cinder-chip[data-cinder-variant='neutral']:not(:disabled):not([data-cinder-disabled]):not(\n      :focus-visible\n    )[style*='--_cinder-chip-brand-color']",
    );
    expect(chipCss).not.toContain(".cinder-chip[style*='--_cinder-chip-brand-color'] {");
  });

  test('brandColor tint yields to disabled and keyboard-focus states', () => {
    const selector =
      ".cinder-chip[data-cinder-variant='neutral']:not(:disabled):not([data-cinder-disabled]):not(\n      :focus-visible\n    )[style*='--_cinder-chip-brand-color']";
    expect(chipCss).toContain(selector);
    expect(cssRuleBody(selector)).toContain('background: color-mix');
    expect(chipCss).toContain('button.cinder-chip:focus-visible');
    expect(chipCss).toContain('button.cinder-chip:disabled');
  });
});
