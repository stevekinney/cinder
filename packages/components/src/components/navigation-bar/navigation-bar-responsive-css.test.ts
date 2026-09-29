/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
setupHappyDom();
const { cleanup } = await import('@testing-library/svelte');
const { resetEscapeStack } = await import('../../_internal/overlay.ts');

const navigationBarCss = readFileSync(new URL('./navigation-bar.css', import.meta.url), 'utf8');
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetEscapeStack();
});

afterEach(() => cleanup());

describe('NavigationBar responsive CSS', () => {
  test('mobile item geometry follows the ResizeObserver-backed mobile panel state', () => {
    expect(navigationBarCss).toContain('container-name: cinder-navigation-bar;');
    expect(navigationBarCss).toContain('@container cinder-navigation-bar (max-width: 47.99rem)');
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\[data-cinder-visible\][\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?inline-size:\s*100%;/,
    );
  });

  test('closed collapsible items are hidden by the container query before hydration', () => {
    expect(navigationBarCss).toMatch(
      /@container cinder-navigation-bar \(max-width: 47\.99rem\)[\s\S]*?\.cinder-navigation-bar\[data-collapsible='true'\][\s\S]*?\.cinder-navigation-bar__items:not\(\[data-cinder-mobile-panel\]\)\s*\{[\s\S]*?display:\s*none;/,
    );
  });

  test('mobile panels are out of body flow before floating positioning completes', () => {
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\s*\{[\s\S]*?position:\s*fixed;/,
    );
  });

  test('mobile panel scrolls its own overflow instead of painting past the fixed panel', () => {
    // The shared floating-surface base rule only enables scrolling for
    // role="listbox"/"menu"; this panel is neither, so it needs its own
    // overflow: auto or a tall item list clips with no way to reach the rest.
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\s*\{[\s\S]*?overflow:\s*auto;/,
    );
  });

  test('portaled scope keeps the mirrored root class selector-only, not box-producing', () => {
    // The portal scope mirrors `cinder-navigation-bar` purely so root-scoped
    // consumer overrides keep matching while portaled — it must not also
    // pick up the root rule's height/padding/background/border, or the
    // portal target grows a blank second nav bar while the mobile menu is
    // open.
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__portal-scope\.cinder-navigation-bar\s*\{[\s\S]*?height:\s*auto;[\s\S]*?padding-inline:\s*0;[\s\S]*?background:\s*none;[\s\S]*?border-bottom:\s*none;/,
    );
  });

  test('portaled scope is not a named container while it is a display:block portal target', () => {
    // The mirrored class also mirrors the root's `container-name:
    // cinder-navigation-bar`. A `display: block` portal target sized to
    // document.body would otherwise be a same-named query container that a
    // future `@container cinder-navigation-bar` rule could resolve against
    // instead of the actual nav bar.
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__portal-scope\.cinder-navigation-bar\s*\{[\s\S]*?container-type:\s*normal;[\s\S]*?container-name:\s*none;/,
    );
  });

  test('collapsed menu toggle stays with trailing actions instead of centering between brand and actions', () => {
    expect(navigationBarCss).toMatch(
      /@container cinder-navigation-bar \(max-width: 47\.99rem\)[\s\S]*?\.cinder-navigation-bar\[data-collapsible='true'\]\[data-cinder-menu-toggle-placement='after-brand'\][\s\S]*?\.cinder-navigation-bar__menu-toggle\s*\{[\s\S]*?margin-inline-start:\s*auto;/,
    );
    expect(navigationBarCss).not.toMatch(
      /data-cinder-menu-toggle-placement='before-brand'[\s\S]*?margin-inline-start:\s*auto;/,
    );
  });

  test('bottom placement owns tab-bar geometry and label visibility without a new component directory', () => {
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar\[data-cinder-placement='bottom'\][\s\S]*?border-top:\s*1px solid var\(--cinder-border-muted\)/,
    );
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar\[data-cinder-placement='bottom'\][\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?flex-direction:\s*column;/,
    );
    expect(navigationBarCss).toContain("[data-cinder-label-visibility='active']");
    expect(navigationBarCss).toContain('[data-cinder-navigation-label]');
    expect(existsSync(new URL('../bottom-navigation', import.meta.url))).toBe(false);
  });

  test('bottom tabs make the touch target the dominant bar dimension', () => {
    expect(navigationBarCss).toMatch(
      /data-cinder-placement='bottom'[\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?min-block-size:\s*4rem;[\s\S]*?padding-block:\s*var\(--cinder-space-1\);/,
    );
  });

  test('bottom tabs also floor the inline axis at the touch-target minimum, not just block', () => {
    // `flex: 1 1 0` has no inline floor on its own — with enough tabs in a
    // narrow bar the item can shrink under 44px wide even though the block
    // axis is already generously covered by the 4rem above.
    expect(navigationBarCss).toMatch(
      /data-cinder-placement='bottom'[\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?min-block-size:\s*4rem;[\s\S]*?min-inline-size:\s*var\(--cinder-touch-target-min\);/,
    );
  });

  test('the bottom tab row scrolls rather than clipping when the touch floor overflows it', () => {
    // The inline floor above is non-negotiable, so enough tabs in a narrow bar WILL
    // exceed the container. Without an overflow strategy the excess is clipped and
    // unreachable, because a bottom bar is normally sticky or fixed inside a clipping
    // host — the floor would then trade one accessibility failure for another.
    const bottomItemsRule =
      navigationBarCss.match(
        /\.cinder-navigation-bar\[data-cinder-placement='bottom'\] \.cinder-navigation-bar__items \{[^}]*\}/,
      )?.[0] ?? '';

    expect(bottomItemsRule).toContain('overflow-x: auto');
    expect(bottomItemsRule).not.toContain('overflow-x: hidden');

    // Scrolling one axis forces the other to compute as `auto` too — CSS does not let
    // one axis scroll while the other stays visible — so this container now clips
    // vertically. navigation-item's focus ring is a box-shadow painted OUTSIDE the
    // tab, so without block padding to sit in, enabling the scroll would have traded
    // an unreachable tab for an invisible focus ring. The negative margin cancels the
    // padding so the bar's height is unchanged.
    expect(bottomItemsRule).toContain('padding-block: var(--_cinder-navigation-bar-tab-ring-room)');
    expect(bottomItemsRule).toContain(
      'margin-block: calc(-1 * var(--_cinder-navigation-bar-tab-ring-room))',
    );
  });

  test('top-collapsible mobile active items use row selection instead of the horizontal underline', () => {
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\[data-cinder-visible\][\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?border-bottom:\s*none;[\s\S]*?border-inline-start:\s*2px solid transparent;/,
    );
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\[data-cinder-visible\][\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\]\[data-active='true'\][\s\S]*?border-inline-start-color:\s*var\(--cinder-accent-solid\);[\s\S]*?background-color:\s*var\(--cinder-surface-inset\);/,
    );
  });

  test('top-collapsible mobile panel rows meet the touch-target minimum', () => {
    // navigation-item.css's shared base rule only floors this row at
    // `min-height: 2rem` (32px); nothing in the mobile-panel rule overrode
    // that until now, so the row rendered under the 44px floor.
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\[data-cinder-visible\][\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?min-block-size:\s*var\(--cinder-touch-target-min\);/,
    );
  });

  test('top-collapsible mobile panel rows are concentric with the panel, not a smaller radius step', () => {
    // The panel is `--cinder-radius-md` inset by its own `--cinder-space-2`
    // padding (this file's `.cinder-navigation-bar__items[data-cinder-mobile-panel]`
    // rule overrides `cinder-_floating-surface`'s default padding). The row's
    // radius must be derived from that same pair of tokens, not an unrelated
    // step off the scale like `--cinder-radius-sm`.
    expect(navigationBarCss).toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\[data-cinder-visible\][\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?border-radius:\s*calc\(var\(--cinder-radius-md\) - var\(--cinder-space-2\)\);/,
    );
    expect(navigationBarCss).not.toMatch(
      /\.cinder-navigation-bar__items\[data-cinder-mobile-panel\]\[data-cinder-visible\][\s\S]*?\.cinder-navigation-item\[data-variant='mobile'\][\s\S]*?border-radius:\s*var\(--cinder-radius-sm\);/,
    );
  });
});
