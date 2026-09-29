/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';
import { resetEscapeStack, resetScrollLock } from '../../_internal/overlay.ts';
import {
  flushOverflowFadeAnimationFrames,
  installOverflowFadeTestEnvironment,
  OverflowFadeResizeObserver,
  setScrollMeasurements,
} from '../../test/overflow-fade-test-helpers.ts';
import {
  emptySnippet,
  installDrawerDialogStubs,
  installDrawerStyleProbe,
  textSnippet,
} from './drawer-test-helpers.ts';
import type { DrawerProps } from './drawer.types.ts';
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;
const excludesLowercaseNativeCloseHandler: HasKey<DrawerProps, 'onclose'> = false;
const excludesLowercaseNativeCancelHandler: HasKey<DrawerProps, 'oncancel'> = false;
const includesModalProp: HasKey<DrawerProps, 'modal'> = true;

setupHappyDom();
installDrawerDialogStubs();
const restoreDrawerStyles = installDrawerStyleProbe();
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: Drawer } = await import('./drawer.svelte');
const drawerCss = await Bun.file(new URL('./drawer.css', import.meta.url)).text();

afterAll(() => {
  restoreDrawerStyles();
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
  resetEscapeStack();
});
describe('Drawer', () => {
  test('footer renders when provided', () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Test',
        children: emptySnippet,
        footer: textSnippet('Footer content'),
      },
    });
    const footer = container.querySelector('.cinder-drawer__footer');
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain('Footer content');
  });
  test('footer is absent when not provided', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-drawer__footer')).toBeNull();
  });

  // ---- Additional: children content renders in body ----
  test('children render inside the body', () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Test',
        children: textSnippet('Drawer body content'),
      },
    });
    const body = container.querySelector('.cinder-drawer__body');
    expect(body?.textContent).toContain('Drawer body content');
  });

  // ---- Additional: body has tabindex=-1 ----
  test('body container has tabindex="-1"', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    const body = container.querySelector('.cinder-drawer__body');
    expect(body?.getAttribute('tabindex')).toBe('-1');
  });
  test('overflow fade attachment marks and clears the drawer body', () => {
    const cleanupOverflowFade = installOverflowFadeTestEnvironment();
    try {
      const { container } = render(Drawer, {
        props: { open: true, title: 'Test', children: textSnippet('Drawer body content') },
      });
      const body = requiredInstance(container.querySelector('.cinder-drawer__body'), HTMLElement);
      expect(body).not.toBeNull();

      setScrollMeasurements(body, { clientHeight: 100, scrollHeight: 160, scrollTop: 0 });
      OverflowFadeResizeObserver.instances[0]?.trigger();
      flushOverflowFadeAnimationFrames();
      expect(body.hasAttribute('data-cinder-overflows')).toBe(true);

      setScrollMeasurements(body, { clientHeight: 100, scrollHeight: 160, scrollTop: 60 });
      body.dispatchEvent(new Event('scroll'));
      flushOverflowFadeAnimationFrames();
      expect(body.hasAttribute('data-cinder-overflows')).toBe(false);
    } finally {
      cleanupOverflowFade();
    }
  });
  test('body opts into the shared scroll-fade recipe with a surface-colored overlay, never a mask', async () => {
    const css = drawerCss;
    expect(css).toMatch(
      /\.cinder-drawer__body\s*\{[^}]*--_cinder-scroll-fade-color:\s*var\(--cinder-surface\)/s,
    );
    expect(css).not.toContain('mask-image:');
    expect(css).not.toMatch(/(?:-webkit-)?mask(?:-[a-z]+)?\s*:/);

    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: textSnippet('Drawer body content') },
    });
    const body = container.querySelector('.cinder-drawer__body');
    expect(body?.classList.contains('cinder-_scroll-fade')).toBe(true);
  });

  // ---- Additional: close button has correct aria-label ----
  test('close button has aria-label="Close drawer"', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    const closeButton = container.querySelector('.cinder-drawer__close');
    expect(closeButton?.getAttribute('aria-label')).toBe('Close drawer');
  });

  // ---- Initial focus on open: host-managed body focus (the Modal policy) ----
  // The trap runs with `manageInitialFocus: false`; the drawer's own open
  // effect focuses the body container, so opening never lands focus on the
  // close button.
  test('opening focuses the body container when nothing is autofocused', async () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    // Svelte schedules the open-focus effect with tick().then(). In happy-dom,
    // effects run synchronously but the tick().then() microtask needs to drain.
    // Wait for two microtask cycles to ensure both the effect and the tick resolve.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const body = requiredInstance(container.querySelector('.cinder-drawer__body'), HTMLElement);
    expect(body).not.toBeNull();
    expect(document.activeElement).toBe(body);
  });

  // ---------------------------------------------------------------------------
  // Slide direction lifecycle — regression for wrong-edge entry/exit.
  //
  // The panel's `data-cinder-placement` must reflect the side that was current when
  // the drawer *opened* (the active-open-cycle side), not the live `side` prop.
  // happy-dom cannot render CSS, so these tests assert the state contract that
  // drives direction: whichever value `data-cinder-placement` carries on the panel
  // is the value the CSS will use for translate/anchor rules.
  // ---------------------------------------------------------------------------

  test('omits native dialog handlers owned internally', () => {
    expect(excludesLowercaseNativeCloseHandler).toBe(false);
    expect(excludesLowercaseNativeCancelHandler).toBe(false);
    expect(includesModalProp).toBe(true);
  });

  // ---- 1. Renders open dialog when open=true after hydration ----
  test('renders open <dialog> when open=true after hydration', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test Drawer', children: emptySnippet },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(true);
  });

  // ---- 2. Post-hydration: dialog present (closed) once the $effect fires ----
  test('dialog is present but closed after hydration when open=false', () => {
    // In happy-dom $effect runs synchronously, so `hydrated` is true by the
    // time we read the DOM and the dialog is mounted (but closed). The
    // server-side absence of the dialog is asserted separately in the
    // "Drawer SSR contract" describe block below.
    const { container } = render(Drawer, {
      props: { open: false, title: 'Test Drawer', children: emptySnippet },
    });
    // In client (happy-dom), the dialog is present with hydrated=true but closed.
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(false);
  });

  // ---- 3. data-cinder-placement reflects side prop ----
  test('data-cinder-placement on panel reflects side prop (right default)', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    const panel = container.querySelector('.cinder-drawer__panel');
    expect(panel?.getAttribute('data-cinder-placement')).toBe('right');
  });
  test('data-cinder-placement on panel reflects side="left"', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', placement: 'left', children: emptySnippet },
    });
    const panel = container.querySelector('.cinder-drawer__panel');
    expect(panel?.getAttribute('data-cinder-placement')).toBe('left');
  });

  // ---- 4. data-cinder-size reflects size prop ----
  test('data-cinder-size defaults to md', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-drawer__panel')?.getAttribute('data-cinder-size')).toBe(
      'md',
    );
  });
  test('data-cinder-size reflects all four size values', () => {
    for (const size of ['sm', 'md', 'lg', 'xl'] as const) {
      const { container } = render(Drawer, {
        props: { open: true, title: 'Test', size, children: emptySnippet },
      });
      expect(
        container.querySelector('.cinder-drawer__panel')?.getAttribute('data-cinder-size'),
      ).toBe(size);
    }
  });

  // ---- 5. Default header renders title h2 + aria-labelledby ----
  test('default header renders <h2> with title and dialog aria-labelledby matches', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'My Drawer Title', children: emptySnippet },
    });
    const title = container.querySelector('.cinder-drawer__title');
    expect(title).not.toBeNull();
    expect(title?.textContent?.trim()).toBe('My Drawer Title');
    const dialog = container.querySelector('dialog');
    const labelledBy = dialog?.getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    // The aria-labelledby should resolve to the rendered heading
    const heading = container.querySelector(`#${labelledBy}`);
    expect(heading).not.toBeNull();
    expect(heading?.textContent?.trim()).toBe('My Drawer Title');
  });

  // ---- 6. Custom header without ariaLabelledby: visually-hidden h2 ----
  test('custom header without ariaLabelledby renders sr-only title heading', () => {
    const customHeader = createRawSnippet(() => ({
      render: () => `<span>Custom Header Content</span>`,
      setup: () => {},
    }));
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'SR Only Title',
        header: customHeader,
        children: emptySnippet,
      },
    });
    const srOnly = container.querySelector('.cinder-sr-only');
    expect(srOnly).not.toBeNull();
    expect(srOnly?.textContent?.trim()).toBe('SR Only Title');
    const dialog = container.querySelector('dialog');
    const labelledBy = dialog?.getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    const heading = container.querySelector(`#${labelledBy}`);
    expect(heading?.classList.contains('cinder-sr-only')).toBe(true);
  });

  // ---- 7. Custom header with ariaLabelledby: no internal heading ----
  test('custom header with ariaLabelledby uses consumer id and renders no internal title', () => {
    const customHeader = createRawSnippet(() => ({
      render: () => `<h2 id="external-heading">External Heading</h2>`,
      setup: () => {},
    }));
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Unused Title',
        header: customHeader,
        ariaLabelledby: 'external-heading',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('external-heading');
    // No sr-only heading should be present
    expect(container.querySelector('.cinder-sr-only')).toBeNull();
  });

  // ---- 8. Close button in header closes the drawer ----
  test('clicking the close button closes the drawer', async () => {
    let openValue = true;
    const { container } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test',
        children: emptySnippet,
      },
    });
    const closeButton = requiredInstance(
      container.querySelector('.cinder-drawer__close'),
      HTMLButtonElement,
    );
    expect(closeButton).not.toBeNull();
    await fireEvent.click(closeButton);
    expect(openValue).toBe(false);
  });

  // ---- 9. Backdrop click (event.target === dialog) closes drawer ----
});
