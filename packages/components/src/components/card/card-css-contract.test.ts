/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

describe('Card CSS contract', () => {
  test('default body uses the panel surface', async () => {
    const css = await Bun.file(new URL('./card.css', import.meta.url)).text();
    expect(css).toMatch(/\.cinder-card__body\s*\{[^}]*background:\s*var\(--cinder-surface\)/s);
  });

  test('padding="none" targets only the body', async () => {
    const css = await Bun.file(new URL('./card.css', import.meta.url)).text();

    expect(css).toContain(".cinder-card__body[data-cinder-padding='none']");
    expect(css).not.toContain(".cinder-card[data-cinder-padding='none']");
  });

  test('title uses the primary text token', async () => {
    const css = await Bun.file(new URL('./card.css', import.meta.url)).text();
    const titleBlock = css.match(/\.cinder-card__title\s*\{[^}]*\}/)?.[0] ?? '';
    expect(titleBlock).toContain('color: var(--cinder-text-default)');
    expect(titleBlock).not.toContain('color: var(--cinder-text-muted)');
  });

  test('well footer preserves an explicit muted tone', async () => {
    const css = await Bun.file(new URL('./card.css', import.meta.url)).text();

    expect(css).toContain(".cinder-card__footer:not([data-cinder-tone='muted'])");
  });

  test('danger cards preserve explicit muted body and footer tones', async () => {
    const css = await Bun.file(new URL('./card.css', import.meta.url)).text();

    expect(css).toContain(".cinder-card__body:not([data-cinder-tone='muted'])");
    expect(css).toContain(".cinder-card__footer:not([data-cinder-tone='muted'])");
  });

  test('danger tone paints the container surface, border, and icon', async () => {
    const css = await Bun.file(new URL('./card.css', import.meta.url)).text();
    const dangerBlock =
      css.match(/\.cinder-card\[data-cinder-tone='danger'\]\s*\{[^}]*\}/)?.[0] ?? '';
    const iconBlock = css.match(/\.cinder-card__risk-icon\s*\{[^}]*\}/)?.[0] ?? '';

    expect(dangerBlock).toContain('background');
    expect(dangerBlock).toContain('border-color');
    expect(dangerBlock).toContain('var(--cinder-status-danger-background)');
    expect(dangerBlock).toContain('var(--cinder-status-danger-border)');
    expect(css).toContain(".cinder-card[data-cinder-tone='danger'] > .cinder-card__header");
    expect(css).toContain(
      ".cinder-card[data-cinder-tone='danger'] > .cinder-card__header .cinder-card__title",
    );
    expect(css).toContain(".cinder-card[data-cinder-tone='danger'] > .cinder-card__footer");
    expect(iconBlock).toContain('var(--cinder-status-danger-solid)');
  });

  test('resting card uses the sm elevation token and transitions border/shadow/background', async () => {
    const css = await Bun.file(new URL('./card.css', import.meta.url)).text();
    const baseBlock = css.match(/\.cinder-card\s*\{[^}]*\}/)?.[0] ?? '';
    expect(baseBlock).toContain('box-shadow: var(--cinder-shadow-sm)');
    expect(baseBlock).toMatch(/transition:[^;]*border-color var\(--cinder-duration-fast\)/s);
    expect(baseBlock).toMatch(/transition:[^;]*box-shadow var\(--cinder-duration-fast\)/s);
    expect(baseBlock).toMatch(/transition:[^;]*background-color var\(--cinder-duration-fast\)/s);
  });

  test('hover elevates an interactive card only under a hover-capable pointer', async () => {
    const css = await Bun.file(new URL('./card.css', import.meta.url)).text();
    const hoverSection = css.match(/@media \(hover: hover\)\s*\{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(hoverSection).toContain('[data-cinder-interactive]:hover');
    expect(hoverSection).toContain('border-color: var(--cinder-border-strong)');
    expect(hoverSection).toContain('box-shadow: var(--cinder-shadow-md)');
  });

  test('focus-visible paints the ring on the card for both the anchor and stretched-action cases', async () => {
    const css = await Bun.file(new URL('./card.css', import.meta.url)).text();
    const anchorFocusBlock =
      css.match(/\.cinder-card\[data-cinder-interactive\]:focus-visible\s*\{[^}]*\}/)?.[0] ?? '';
    const actionFocusBlock =
      css.match(
        /\.cinder-card\[data-cinder-interactive\]:has\(\.cinder-card__action:focus-visible\)\s*\{[^}]*\}/,
      )?.[0] ?? '';
    expect(anchorFocusBlock).toContain('var(--_cinder-focus-ring-shadow)');
    expect(actionFocusBlock).toContain('var(--_cinder-focus-ring-shadow)');
    // The stretched hit-target button itself must never show its own ring — the
    // parent .cinder-card owns it, so this case is visible on the card, not the control.
    const actionOwnRing = css.match(/\.cinder-card__action:focus-visible\s*\{[^}]*\}/)?.[0] ?? '';
    expect(actionOwnRing).toContain('outline: none');
  });

  test('an explicit non-default elevation still wins on well and danger surfaces', async () => {
    const css = await Bun.file(new URL('./card.css', import.meta.url)).text();

    // The default (sm) elevation stays flat on a STATIC well/danger card, matching the
    // existing look. The :not([data-cinder-interactive]) is load-bearing, not cosmetic:
    // these rules sit after the :hover / :focus-visible rules and carry the same
    // specificity, so without it they win the cascade and flatten an interactive card's
    // hover and focus feedback — reintroducing the discarded-elevation defect one
    // variant over.
    expect(css).toMatch(
      /\.cinder-card\[data-cinder-variant='well'\]\[data-cinder-elevation='sm'\]:not\(\s*\[data-cinder-interactive\]\s*\)\s*\{[^}]*box-shadow:\s*none/s,
    );
    expect(css).toMatch(
      /\.cinder-card\[data-cinder-tone='danger'\]\[data-cinder-elevation='sm'\]:not\(\s*\[data-cinder-interactive\]\s*\)\s*\{[^}]*box-shadow:\s*none/s,
    );

    // And neither flat rule may apply without that exclusion.
    expect(css).not.toMatch(
      /\.cinder-card\[data-cinder-variant='well'\]\[data-cinder-elevation='sm'\]\s*\{/,
    );
    expect(css).not.toMatch(
      /\.cinder-card\[data-cinder-tone='danger'\]\[data-cinder-elevation='sm'\]\s*\{/,
    );

    // Neither the well nor the danger base rule unconditionally forces box-shadow: none
    // anymore -- that would silently discard an explicit elevation='md'/'lg' prop.
    const wellBlock =
      css.match(/\.cinder-card\[data-cinder-variant='well'\]\s*\{[^}]*\}/)?.[0] ?? '';
    const dangerBlock =
      css.match(/\.cinder-card\[data-cinder-tone='danger'\]\s*\{[^}]*\}/)?.[0] ?? '';
    expect(wellBlock).not.toContain('box-shadow');
    expect(dangerBlock).not.toContain('box-shadow');

    // No rule collapses elevation='md' or elevation='lg' to none for well/danger.
    expect(css).not.toMatch(
      /\.cinder-card\[data-cinder-variant='well'\]\[data-cinder-elevation='(md|lg)'\]\s*\{[^}]*box-shadow:\s*none/s,
    );
    expect(css).not.toMatch(
      /\.cinder-card\[data-cinder-tone='danger'\]\[data-cinder-elevation='(md|lg)'\]\s*\{[^}]*box-shadow:\s*none/s,
    );
  });
});
