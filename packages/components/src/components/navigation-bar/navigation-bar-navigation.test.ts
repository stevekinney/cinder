/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { nestedFieldSnippet } from './navigation-bar-interaction-snippet-helpers.ts';
import { textSnippet, toggleSnippet } from './navigation-bar-snippet-helpers.ts';
import {
  emitNavigationBarResize,
  getItemsRegion,
  withResizeObserver,
} from './navigation-bar-test-helpers.ts';
setupHappyDom();
const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { resetEscapeStack } = await import('../../_internal/overlay.ts');
const { default: NavigationBar } = await import('./navigation-bar.svelte');
const { tick } = await import('svelte');
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetEscapeStack();
});

afterEach(() => cleanup());

describe('NavigationBar', () => {
  test('consumer data-collapsible rest prop cannot override internal value', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
      'data-collapsible': 'false',
    });
    expect(container.querySelector('nav')?.getAttribute('data-collapsible')).toBe('true');
  });

  // ── Composed onkeydown ───────────────────────────────────────────────────

  test('rest-prop onkeydown is composed for non-Escape keys', async () => {
    let spyFired = false;
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
        onkeydown: () => {
          spyFired = true;
        },
      });

      await tick();
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLElement);
      const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
      emitNavigationBarResize(nav, 640);
      await tick();

      await fireEvent.click(toggle);
      await fireEvent.keyDown(nav, { key: 'a' });

      expect(spyFired).toBe(true);
    });
  });

  test('CIN-428 / cooperative Escape: a consumer onkeydown that calls preventDefault() cancels the close', async () => {
    // The stack handler runs at the window capture phase — necessarily
    // before the event reaches <nav>'s own bubble-phase onkeydown — but it
    // no longer decides synchronously there. It stashes the event and lets
    // it keep propagating so the composed consumer handler (which still
    // runs first inside handleKeyDown, per navigation-bar.a11y.md's
    // "Cooperative Escape semantics") gets to call preventDefault() and
    // cancel the close, exactly as documented.
    let spyFired = false;
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
        onkeydown: (event: KeyboardEvent) => {
          spyFired = true;
          event.preventDefault();
        },
      });

      await tick();
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLElement);
      const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
      emitNavigationBarResize(nav, 640);
      await tick();

      await fireEvent.click(toggle);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');

      const escapeEvent = new window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      nav.dispatchEvent(escapeEvent);

      expect(escapeEvent.defaultPrevented).toBe(true);
      expect(spyFired).toBe(true);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');
    });
  });

  test('cooperative Escape: a nested control inside the items region gets first refusal', async () => {
    // navigation-bar.a11y.md: "If a component inside the navbar (a search
    // field, combobox, or nested disclosure) calls event.preventDefault()
    // on a keydown event, the menu's Escape handler is skipped." The nested
    // field's own keydown listener fires at the target phase, before the
    // event bubbles up through <nav> to the escape-stack's stashed decision
    // — unlike the pre-fix behavior, where stopPropagation() at the window
    // capture phase meant the nested field never saw the key at all.
    let fieldSawEscape = false;
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: nestedFieldSnippet((event) => {
          fieldSawEscape = true;
          event.preventDefault();
        }),
        menuToggle: toggleSnippet(),
      });

      await tick();
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLElement);
      const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
      emitNavigationBarResize(nav, 640);
      await tick();

      await fireEvent.click(toggle);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');

      const field = requiredInstance(
        container.querySelector('#nested-search') ?? document.body.querySelector('#nested-search'),
        HTMLElement,
      );
      const escapeEvent = new window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      field.dispatchEvent(escapeEvent);

      expect(fieldSawEscape).toBe(true);
      expect(escapeEvent.defaultPrevented).toBe(true);
      // The nested field owned this Escape — the panel stays open.
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');
    });
  });

  test('cooperative Escape: the panel still closes when no nested handler cancels it', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: nestedFieldSnippet(() => {
          // Sees Escape but does not call preventDefault() — the panel
          // should still close, matching "pressing Escape on <nav> while
          // open closes the menu" above.
        }),
        menuToggle: toggleSnippet(),
      });

      await tick();
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLElement);
      const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
      emitNavigationBarResize(nav, 640);
      await tick();

      await fireEvent.click(toggle);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');

      const field = requiredInstance(
        container.querySelector('#nested-search') ?? document.body.querySelector('#nested-search'),
        HTMLElement,
      );
      await fireEvent.keyDown(field, { key: 'Escape' });

      expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
    });
  });

  test('cooperative Escape: propagation stops once the panel actually accepts the dismissal (review finding)', async () => {
    // Follow-up review findings (Copilot + Codex): once the panel decides to
    // close — whether immediately for a dispatch outside the bar's tree, or
    // after the deferred in-tree decision — the key must not leak past this
    // point to an unrelated ancestor keydown handler, restoring the uniform
    // swallow-at-the-top guarantee every other escape-stack overlay has.
    // This must hold without regressing the cooperative path above: a
    // handler higher up the DOM tree than <nav> should still not see the
    // key once <nav> has claimed it.
    let outerHandlerFired = false;
    const outerHandler = () => {
      outerHandlerFired = true;
    };
    document.body.addEventListener('keydown', outerHandler);

    try {
      await withResizeObserver(async () => {
        const { container } = render(NavigationBar, {
          items: nestedFieldSnippet(() => {
            // Sees Escape but does not cancel it — the panel closes.
          }),
          menuToggle: toggleSnippet(),
        });

        await tick();
        const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLElement);
        const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
        emitNavigationBarResize(nav, 640);
        await tick();

        await fireEvent.click(toggle);
        expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');

        const field = requiredInstance(
          container.querySelector('#nested-search') ??
            document.body.querySelector('#nested-search'),
          HTMLElement,
        );
        const escapeEvent = new window.KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        });
        field.dispatchEvent(escapeEvent);

        expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
        expect(outerHandlerFired).toBe(false);
      });
    } finally {
      document.body.removeEventListener('keydown', outerHandler);
    }
  });
});
