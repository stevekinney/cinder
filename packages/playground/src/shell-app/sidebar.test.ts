/// <reference lib="dom" />
/**
 * Render tests for the playground sidebar.
 *
 * Two contracts are covered:
 *  - the search/filter behavior end-to-end through the real cinder `Input` and
 *    `SideNavigation` components: the list renders humanized labels, typing
 *    narrows the visible items (matching humanized and raw names), an empty
 *    result shows a message, and Escape clears the filter. The accessibility
 *    wiring is asserted too — a single persistent polite live region announces
 *    the filtered count (the visible empty message is plain text, not a second
 *    live region, so zero-result navigations announce exactly once).
 *  - the STABLE onSelect contract: a plain left-click selects, while
 *    modified/middle clicks fall through to native navigation. These target the
 *    onSelect callback rather than incidental DOM structure so they survive
 *    sibling refactors of `sidebar.svelte`.
 *
 * happy-dom is installed via `setupHappyDom()` (also done by the bunfig
 * preload) before `@testing-library/svelte` loads, mirroring the
 * components-package test convention.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../components/src/test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: Sidebar } = await import('./sidebar.svelte');
const { tick } = await import('svelte');

// Unmount every rendered tree between tests. These tests do not unmount each
// render individually, so without cleanup each render leaves its `#sidebar-filter`
// in the shared happy-dom document body. The `focusFilter()` test resolves the
// input via `document.getElementById(FILTER_INPUT_ID)`, which would otherwise
// return a STALE input from a prior render and break the focus assertion once
// the whole suite runs in one process.
afterEach(() => {
  cleanup();
});

const COMPONENTS = ['button', 'tag-input', 'json-schema-editor', 'card'];

function navItemLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('nav[aria-label="Components"] a')].map((node) =>
    (node.textContent ?? '').trim(),
  );
}

function getFilterInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('#sidebar-filter');
  if (input === null) throw new Error('filter input not found');
  return input;
}

function getLiveRegion(container: HTMLElement): HTMLElement {
  const region = container.querySelector<HTMLElement>('[aria-live="polite"]');
  if (region === null) throw new Error('live region not found');
  return region;
}

/**
 * Find the sidebar nav link for a component name. The sidebar renders each
 * entry as an anchor whose href is `/c/<name>` (built by `buildShellHref`), so
 * we select on that stable contract rather than on text or class names.
 */
function linkFor(container: HTMLElement, name: string): HTMLAnchorElement {
  const anchor = container.querySelector<HTMLAnchorElement>(`a[href="/c/${name}"]`);
  if (anchor === null) throw new Error(`No sidebar link found for "${name}"`);
  return anchor;
}

/**
 * Dispatch a click with the given modifiers. We build the event manually so we
 * can set `button` and modifier keys, then dispatch it on the anchor. A default
 * cancelable click lets us also assert `preventDefault` was called.
 */
function dispatchClick(
  element: Element,
  init: {
    button?: number;
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  } = {},
): MouseEvent {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: init.button ?? 0,
    metaKey: init.metaKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
  });
  element.dispatchEvent(event);
  return event;
}

describe('Sidebar', () => {
  test('renders Cinder chrome hooks required by the shell stylesheet', () => {
    const { container } = render(Sidebar, {
      props: { components: COMPONENTS, currentComponent: 'button', onSelect: () => {} },
    });

    expect(container.querySelector('input.cinder-input#sidebar-filter')).not.toBeNull();
    expect(container.querySelector('nav.cinder-side-navigation')).not.toBeNull();
    expect(container.querySelector('.cinder-side-navigation__list')).not.toBeNull();
    expect(container.querySelectorAll('.cinder-side-navigation__item').length).toBe(
      COMPONENTS.length,
    );
  });

  test('renders every component as a humanized label', () => {
    const { container } = render(Sidebar, {
      props: { components: COMPONENTS, currentComponent: 'button', onSelect: () => {} },
    });
    expect(navItemLabels(container)).toEqual(['Button', 'Tag Input', 'JSON Schema Editor', 'Card']);
  });

  test('keeps the raw kebab name in the item href', () => {
    const { container } = render(Sidebar, {
      props: { components: COMPONENTS, currentComponent: 'button', onSelect: () => {} },
    });
    const hrefs = [...container.querySelectorAll('nav[aria-label="Components"] a')].map((node) =>
      node.getAttribute('href'),
    );
    expect(hrefs).toContain('/c/json-schema-editor');
    expect(hrefs).toContain('/c/tag-input');
  });

  test('filter narrows the list by humanized name (case-insensitive)', async () => {
    const { container } = render(Sidebar, {
      props: { components: COMPONENTS, currentComponent: 'button', onSelect: () => {} },
    });
    await fireEvent.input(getFilterInput(container), { target: { value: 'schema' } });
    await tick();
    expect(navItemLabels(container)).toEqual(['JSON Schema Editor']);
  });

  test('filter matches the acronym in the humanized name', async () => {
    const { container } = render(Sidebar, {
      props: { components: COMPONENTS, currentComponent: 'button', onSelect: () => {} },
    });
    await fireEvent.input(getFilterInput(container), { target: { value: 'json' } });
    await tick();
    expect(navItemLabels(container)).toEqual(['JSON Schema Editor']);
  });

  test('filter matches the raw kebab name', async () => {
    const { container } = render(Sidebar, {
      props: { components: COMPONENTS, currentComponent: 'button', onSelect: () => {} },
    });
    await fireEvent.input(getFilterInput(container), { target: { value: 'tag-input' } });
    await tick();
    expect(navItemLabels(container)).toEqual(['Tag Input']);
  });

  test('shows an empty-state message when nothing matches', async () => {
    const { container } = render(Sidebar, {
      props: { components: COMPONENTS, currentComponent: 'button', onSelect: () => {} },
    });
    await fireEvent.input(getFilterInput(container), { target: { value: 'zzz-no-match' } });
    await tick();
    expect(navItemLabels(container)).toEqual([]);
    // The visible empty-state paragraph is plain text — NOT a live region.
    // Announcing zero results is the job of the persistent aria-live region
    // below it (asserted separately); marking this paragraph role="status" too
    // would double-announce.
    const message = container.querySelector('.sidebar-empty');
    expect(message?.getAttribute('role')).toBeNull();
    expect(message?.textContent).toContain('No components match');
    // The single live region carries the count for assistive tech.
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent).toContain('0 components shown');
  });

  test('Escape clears the filter and restores the full list', async () => {
    const { container } = render(Sidebar, {
      props: { components: COMPONENTS, currentComponent: 'button', onSelect: () => {} },
    });
    const input = getFilterInput(container);
    await fireEvent.input(input, { target: { value: 'schema' } });
    await tick();
    expect(navItemLabels(container)).toEqual(['JSON Schema Editor']);

    await fireEvent.keyDown(input, { key: 'Escape' });
    await tick();
    expect(input.value).toBe('');
    expect(navItemLabels(container)).toEqual(['Button', 'Tag Input', 'JSON Schema Editor', 'Card']);
  });

  test('focusFilter() focuses and selects the filter input', async () => {
    const { container, component } = render(Sidebar, {
      props: { components: COMPONENTS, currentComponent: 'button', onSelect: () => {} },
    });
    const input = getFilterInput(container);
    component['focusFilter']();
    await tick();
    expect(container.ownerDocument.activeElement).toBe(input);
  });

  test('a persistent polite live region announces the filtered count', async () => {
    const { container } = render(Sidebar, {
      props: { components: COMPONENTS, currentComponent: 'button', onSelect: () => {} },
    });
    const region = getLiveRegion(container);
    expect(region.getAttribute('aria-atomic')).toBe('true');
    expect((region.textContent ?? '').trim()).toBe('4 components shown');

    // The region stays in the DOM and updates to a narrowed plural count.
    await fireEvent.input(getFilterInput(container), { target: { value: 'a' } });
    await tick();
    const narrowed = navItemLabels(container).length;
    expect((getLiveRegion(container).textContent ?? '').trim()).toBe(
      `${narrowed} components shown`,
    );

    // Singular grammar when exactly one component matches.
    await fireEvent.input(getFilterInput(container), { target: { value: 'schema' } });
    await tick();
    expect((getLiveRegion(container).textContent ?? '').trim()).toBe('1 component shown');

    // The region survives an empty result instead of unmounting.
    await fireEvent.input(getFilterInput(container), { target: { value: 'zzz-no-match' } });
    await tick();
    expect((getLiveRegion(container).textContent ?? '').trim()).toBe('0 components shown');
  });
});

describe('sidebar drawer (narrow-viewport) wiring', () => {
  test('exposes a stable #sidebar-drawer id for the toggle aria-controls', () => {
    const { container } = render(Sidebar, {
      props: { components: COMPONENTS, currentComponent: 'button', onSelect: () => {} },
    });
    expect(container.querySelector('#sidebar-drawer.sidebar-chrome')).not.toBeNull();
  });

  test('reflects the isOpen prop as the is-open class', async () => {
    const { container, rerender } = render(Sidebar, {
      props: {
        components: COMPONENTS,
        currentComponent: 'button',
        onSelect: () => {},
        isOpen: false,
      },
    });
    const drawer = container.querySelector('#sidebar-drawer');
    expect(drawer?.classList.contains('is-open')).toBe(false);

    await rerender({
      components: COMPONENTS,
      currentComponent: 'button',
      onSelect: () => {},
      isOpen: true,
    });
    expect(drawer?.classList.contains('is-open')).toBe(true);
  });

  test('the close button invokes onClose', async () => {
    let closed = 0;
    const { container } = render(Sidebar, {
      props: {
        components: COMPONENTS,
        currentComponent: 'button',
        onSelect: () => {},
        onClose: () => {
          closed += 1;
        },
      },
    });
    const closeButton = container.querySelector<HTMLButtonElement>('.sidebar-close');
    expect(closeButton).not.toBeNull();
    expect(closeButton?.getAttribute('aria-label')).toBe('Close component list');
    // happy-dom does not evaluate the `@media (max-width: 720px)` rule that
    // makes this button display:inline-flex, so it is display:none here — but
    // .click() still dispatches. That is the right thing to test: this asserts
    // the onClose CALLBACK WIRING, not the (CSS-driven, viewport-gated)
    // visibility, which is covered by the Playwright narrow-viewport test.
    closeButton?.click();
    await tick();
    expect(closed).toBe(1);
  });
});

const ONSELECT_COMPONENTS = ['avatar', 'button', 'card'];

describe('sidebar onSelect contract', () => {
  let selected: string[];
  let onSelect: (name: string) => void;

  beforeEach(() => {
    selected = [];
    onSelect = (name: string) => {
      selected.push(name);
    };
  });

  test('plain left-click calls onSelect with the clicked component name', async () => {
    const { container } = render(Sidebar, {
      components: ONSELECT_COMPONENTS,
      currentComponent: 'avatar',
      onSelect,
    });
    await tick();

    const event = dispatchClick(linkFor(container, 'button'));

    expect(selected).toEqual(['button']);
    expect(event.defaultPrevented).toBe(true);
  });

  test('clicking different entries reports the right name each time', async () => {
    const { container } = render(Sidebar, {
      components: ONSELECT_COMPONENTS,
      currentComponent: 'avatar',
      onSelect,
    });
    await tick();

    dispatchClick(linkFor(container, 'card'));
    dispatchClick(linkFor(container, 'avatar'));

    expect(selected).toEqual(['card', 'avatar']);
  });

  test('metaKey (cmd) click does NOT call onSelect', async () => {
    const { container } = render(Sidebar, {
      components: ONSELECT_COMPONENTS,
      currentComponent: 'avatar',
      onSelect,
    });
    await tick();

    const event = dispatchClick(linkFor(container, 'button'), { metaKey: true });

    expect(selected).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  test('ctrlKey click does NOT call onSelect', async () => {
    const { container } = render(Sidebar, {
      components: ONSELECT_COMPONENTS,
      currentComponent: 'avatar',
      onSelect,
    });
    await tick();

    const event = dispatchClick(linkFor(container, 'button'), { ctrlKey: true });

    expect(selected).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  test('shiftKey and altKey clicks do NOT call onSelect', async () => {
    const { container } = render(Sidebar, {
      components: ONSELECT_COMPONENTS,
      currentComponent: 'avatar',
      onSelect,
    });
    await tick();

    dispatchClick(linkFor(container, 'button'), { shiftKey: true });
    dispatchClick(linkFor(container, 'button'), { altKey: true });

    expect(selected).toEqual([]);
  });

  test('middle-click (button 1) does NOT call onSelect', async () => {
    const { container } = render(Sidebar, {
      components: ONSELECT_COMPONENTS,
      currentComponent: 'avatar',
      onSelect,
    });
    await tick();

    const event = dispatchClick(linkFor(container, 'button'), { button: 1 });

    expect(selected).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });
});
