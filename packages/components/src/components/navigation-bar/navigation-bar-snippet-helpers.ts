/// <reference lib="dom" />
import { createRawSnippet } from 'svelte';

export function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

/**
 * Creates a toggle button snippet that wires aria-expanded, aria-controls, and onclick
 * from the snippet parameter. The setup closure captures the click handler from the
 * initial render. Attribute updates (aria-expanded) after interaction are observable
 * via the items region's data-open attribute, which Svelte binds directly in the template.
 */
export function toggleSnippet(buttonId = 'toggle-btn') {
  return createRawSnippet<
    [
      {
        'aria-expanded': string;
        'aria-controls': string;
        onclick?: (event: MouseEvent) => void;
        onkeydown?: (event: KeyboardEvent) => void;
      },
    ]
  >((getAttrs) => ({
    render: () => `<button type="button" id="${buttonId}">Menu</button>`,
    setup(element: Element) {
      const attrs = getAttrs();
      element.setAttribute('aria-expanded', attrs['aria-expanded']);
      element.setAttribute('aria-controls', attrs['aria-controls']);
      if (attrs.onclick) {
        element.addEventListener('click', (event) => {
          if (event instanceof MouseEvent) attrs.onclick?.(event);
        });
      }
      if (attrs.onkeydown) {
        element.addEventListener('keydown', (event) => {
          if (event instanceof KeyboardEvent) attrs.onkeydown?.(event);
        });
      }
    },
  }));
}

export function glyphToggleSnippet(buttonId = 'toggle-glyph-btn') {
  return createRawSnippet<
    [
      {
        'aria-expanded': string;
        'aria-controls': string;
        onclick?: (event: MouseEvent) => void;
        onkeydown?: (event: KeyboardEvent) => void;
      },
    ]
  >((getAttrs) => ({
    render: () =>
      `<button type="button" id="${buttonId}" aria-label="Open menu"><span aria-hidden="true">☰</span></button>`,
    setup(element: Element) {
      const attrs = getAttrs();
      element.setAttribute('aria-expanded', attrs['aria-expanded']);
      element.setAttribute('aria-controls', attrs['aria-controls']);
      if (attrs.onclick) {
        element.addEventListener('click', (event) => {
          if (event instanceof MouseEvent) attrs.onclick?.(event);
        });
      }
      if (attrs.onkeydown) {
        element.addEventListener('keydown', (event) => {
          if (event instanceof KeyboardEvent) attrs.onkeydown?.(event);
        });
      }
    },
  }));
}

export function actionButtonSnippet() {
  return createRawSnippet(() => ({
    render: () => '<button type="button" id="nav-action">Account</button>',
  }));
}

export function hiddenThenActionButtonSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      '<div><input type="hidden" id="hidden-action"><button type="button" id="nav-action">Account</button></div>',
  }));
}

export function cssHiddenThenActionButtonSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      '<div><button type="button" style="display: none">Hidden</button><button type="button" id="nav-action">Account</button></div>',
  }));
}

export function negativeThenActionButtonSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      '<div><button type="button" id="skipped-action" tabindex="-1">Skipped</button><button type="button" id="nav-action">Account</button></div>',
  }));
}

export function brandLinkSnippet() {
  return createRawSnippet(() => ({
    render: () => '<a href="/home" id="brand-link">Acme</a>',
  }));
}

export function negativeFinalBrandSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      '<div><a href="/home" id="brand-home">Home</a><button type="button" id="brand-skipped" tabindex="-1">Skipped</button></div>',
  }));
}

export function multiControlBrandSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      '<div><a href="/home" id="brand-home">Home</a><a href="/products" id="brand-products">Products</a></div>',
  }));
}

export function svgBrandSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      '<svg id="brand-svg" tabindex="0" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 2 7h2v7h8V7h2z"></path></svg>',
  }));
}

/** A brand whose only focus target is a button inside its own open shadow root. */
export function shadowBrandSnippet() {
  return createRawSnippet(() => ({
    render: () => '<div id="brand-shadow-host"></div>',
    setup(element: Element) {
      const shadow = element.attachShadow({ mode: 'open' });
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'brand-shadow-button';
      button.textContent = 'Shadow Brand';
      shadow.append(button);
    },
  }));
}

export function positiveThenNormalBrandSnippet() {
  return createRawSnippet(() => ({
    render: () =>
      '<div><button type="button" id="brand-positive" tabindex="1">Positive</button><a href="/home" id="brand-normal">Acme</a></div>',
  }));
}

/** A brand whose only focus target is a positive-tabindex control. */
export function positiveOnlyBrandSnippet() {
  return createRawSnippet(() => ({
    render: () => '<button type="button" id="brand-positive" tabindex="1">Positive</button>',
  }));
}

export function disabledFirstNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item aria-disabled="true">Disabled</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="enabled">Enabled</button>
      </div>
    `,
  }));
}

export function negativeFirstNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="skipped" tabindex="-1">Skipped</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="enabled">Enabled</button>
      </div>
    `,
  }));
}

export function negativeFinalNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="enabled">Enabled</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="skipped" tabindex="-1">Skipped</button>
      </div>
    `,
  }));
}

export function inlineControlBeforeNegativeNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="enabled">Enabled</button>
        <button type="button" id="inline-control">Inline control</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="skipped" tabindex="-1">Skipped</button>
      </div>
    `,
  }));
}

export function positiveFirstNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="home" tabindex="2">Home</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="settings">Settings</button>
      </div>
    `,
  }));
}

export function positiveThenNormalNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="positive" tabindex="1">Positive</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="normal">Normal</button>
      </div>
    `,
  }));
}

export function normalThenPositiveNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="normal">Normal</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="positive" tabindex="1">Positive</button>
      </div>
    `,
  }));
}

export function allExcludedNavigationSnippet() {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item aria-disabled="true">Disabled</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item tabindex="-1">Excluded</button>
      </div>
    `,
  }));
}

/**
 * Renders a search field inside the items region with its own local Escape
 * handling, simulating a nested disclosure that wants first refusal on
 * Escape (navigation-bar.a11y.md's "Cooperative Escape semantics").
 */
