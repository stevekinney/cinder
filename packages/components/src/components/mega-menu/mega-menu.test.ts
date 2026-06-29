/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: MegaMenu } = await import('./mega-menu.svelte');

afterEach(() => cleanup());

const items = [
  {
    id: 'products',
    label: 'Products',
    sections: [
      {
        id: 'core',
        title: 'Core',
        links: [{ id: 'ui', label: 'UI Kit', href: '/ui', description: 'Components and tokens' }],
      },
    ],
    submenu: [
      {
        id: 'frontend',
        label: 'Frontend',
        sections: [
          {
            id: 'fe',
            title: 'Frontend',
            links: [{ id: 'svelte', label: 'Svelte', href: '/svelte' }],
          },
        ],
      },
    ],
  },
  {
    id: 'resources',
    label: 'Resources',
    sections: [
      { id: 'docs', title: 'Docs', links: [{ id: 'guides', label: 'Guides', href: '/guides' }] },
    ],
  },
];

describe('MegaMenu', () => {
  function getTriggerByLabel(container: HTMLElement, label: string): HTMLButtonElement {
    const triggers = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.cinder-mega-menu__trigger'),
    );
    const trigger = triggers.find((element) => element.textContent?.trim() === label);
    if (!trigger) throw new Error(`Missing trigger: ${label}`);
    return trigger;
  }

  test('renders nav landmark and top-level triggers', () => {
    const { container } = render(MegaMenu, { items, label: 'Primary' });
    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute('aria-label')).toBe('Primary');
    expect(container.textContent).toContain('Products');
    expect(container.textContent).toContain('Resources');
  });

  test('click opens panel content and escape closes it', async () => {
    const { container } = render(MegaMenu, { items });
    const trigger = getTriggerByLabel(container, 'Products');
    await fireEvent.click(trigger);
    expect(container.textContent).toContain('UI Kit');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const panelId = trigger.getAttribute('aria-controls') as string;
    const panel = container.querySelector(`#${panelId}`) as HTMLElement;
    await fireEvent.keyDown(panel, { key: 'Escape' });
    expect(container.querySelector(`#${panelId}`)).toBeNull();
  });

  test('arrow navigation moves focus between top-level triggers', async () => {
    const { container } = render(MegaMenu, { items });
    const first = getTriggerByLabel(container, 'Products');
    const second = getTriggerByLabel(container, 'Resources');
    first.focus();
    await fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(second);
  });
});
