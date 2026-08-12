/// <reference lib="dom" />

/**
 * EditorSkeleton's loading status text must be screen-reader-only in fact, not
 * just in name.
 *
 * The skeleton is what SSR emits, so a mis-named hiding class does not merely
 * flash — it renders as ordinary body copy for the whole load, and forever for
 * a reader with JavaScript disabled. This is the same defect already fixed in
 * `review-editor/live-region.svelte`.
 *
 * The check is deliberately written against the *definition* rather than
 * against one hard-coded class name: a class hides an element only if some
 * stylesheet in reach declares it. Cinder's `utilities.css` is where the
 * shipped `.cinder-sr-only` lives, and a component may alternatively declare
 * its own rule in its `<style>` block (as `comment-composer.svelte` does). A
 * class defined in neither — a bare `sr-only` — hides nothing at all.
 *
 * @module
 */

import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import.
// testing-library reads `globalThis.document` / `window` at module-init.
setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: EditorSkeleton } = await import('./editor-skeleton.svelte');

afterEach(() => cleanup());

const skeletonSource = await Bun.file(new URL('./editor-skeleton.svelte', import.meta.url)).text();

// Cinder owns the `.cinder-sr-only` utility; the editor package composes it
// rather than redeclaring it, so this reaches across the package boundary into
// cinder's own utilities stylesheet.
const utilitiesCss = await Bun.file(
  new URL('../../../../../components/src/styles/utilities.css', import.meta.url),
).text();

const scopedStyles = skeletonSource.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? '';

/**
 * The element that actually carries the status text — the innermost one, since
 * every ancestor's `textContent` reports it too (the shimmer lines are empty).
 */
function findStatusText(container: HTMLElement): Element {
  const element = Array.from(container.querySelectorAll('*')).find(
    (candidate) =>
      candidate.childElementCount === 0 && candidate.textContent?.trim() === 'Loading editor...',
  );
  expect(element, 'EditorSkeleton no longer renders a loading status text').toBeDefined();
  return element as Element;
}

function declaresClass(css: string, className: string): boolean {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // A class selector: the name followed by anything that cannot continue an
  // identifier, so `.sr-only` does not match a `.sr-only-thing` rule.
  return new RegExp(`\\.${escaped}(?![\\w-])`).test(css);
}

describe('EditorSkeleton — the loading status text is genuinely hidden', () => {
  test('the status text is hidden by a class some stylesheet actually defines', () => {
    const { container } = render(EditorSkeleton, { props: {} });

    const label = findStatusText(container);

    // Svelte appends its own `svelte-*` scope hash; it carries no declarations
    // of its own, so it can never be what hides the element.
    const hidingClasses = Array.from(label.classList).filter((name) => !name.startsWith('svelte-'));

    const defined = hidingClasses.filter(
      (name) => declaresClass(utilitiesCss, name) || declaresClass(scopedStyles, name),
    );

    expect(
      defined,
      `None of [${hidingClasses.join(', ')}] is declared in cinder's utilities.css or in ` +
        `editor-skeleton.svelte's own <style> block, so the text is visible to everyone.`,
    ).not.toHaveLength(0);
  });

  test('it uses the visually-hidden utility Cinder ships', () => {
    const { container } = render(EditorSkeleton, { props: {} });

    expect(findStatusText(container).classList.contains('cinder-sr-only')).toBe(true);
  });
});
