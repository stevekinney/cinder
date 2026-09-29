/// <reference lib="dom" />
import { requiredInstance } from '@lostgradient/testing';
import { createRawSnippet } from 'svelte';

export function nestedFieldSnippet(onFieldEscape: (event: KeyboardEvent) => void) {
  return createRawSnippet(() => ({
    render: () => '<input type="search" id="nested-search" />',
    setup(element: Element) {
      element.addEventListener('keydown', (event) => {
        if (event instanceof KeyboardEvent && event.key === 'Escape') onFieldEscape(event);
      });
    },
  }));
}

export function keyboardNavigationSnippet(clicks: Record<string, number>) {
  return createRawSnippet(() => ({
    render: () => `
      <div>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="home" data-active="true">Home</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="docs"><span data-testid="docs-label">Docs</span></button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="billing" aria-disabled="true">Billing</button>
        <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="settings">Settings</button>
      </div>
    `,
    setup(element: Element) {
      for (const button of element.querySelectorAll<HTMLButtonElement>('.cinder-navigation-item')) {
        button.addEventListener('click', () => {
          const key = button.dataset['key'];
          if (key) clicks[key] = (clicks[key] ?? 0) + 1;
        });
      }
    },
  }));
}

export function iconNavigationSnippet(clicks: Record<string, number>) {
  return createRawSnippet(() => ({
    render: () => `
      <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="home">
        <svg data-testid="home-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 2 2 7h2v7h8V7h2z"></path>
        </svg>
        <span>Home</span>
      </button>
    `,
    setup(element: Element) {
      const button = element.matches('.cinder-navigation-item')
        ? requiredInstance(element, HTMLButtonElement)
        : element.querySelector<HTMLButtonElement>('.cinder-navigation-item');
      button?.addEventListener('click', () => {
        const key = button.dataset['key'];
        if (key) clicks[key] = (clicks[key] ?? 0) + 1;
      });
    },
  }));
}

export function cancelingNavigationSnippet(clicks: Record<string, number>) {
  return createRawSnippet(() => ({
    render: () => `
      <button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="docs">Docs</button>
    `,
    setup(element: Element) {
      const button = element.matches('.cinder-navigation-item')
        ? requiredInstance(element, HTMLButtonElement)
        : element.querySelector<HTMLButtonElement>('.cinder-navigation-item');
      button?.addEventListener('click', (event) => {
        event.preventDefault();
        const key = button.dataset['key'];
        if (key) clicks[key] = (clicks[key] ?? 0) + 1;
      });
    },
  }));
}
