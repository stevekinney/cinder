/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: MegaMenuLocaleTestHarness } =
  await import('./_mega-menu-locale-test-harness.svelte');
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
      {
        id: 'backend',
        label: 'Backend',
        sections: [
          {
            id: 'be',
            title: 'Backend',
            links: [{ id: 'apis', label: 'APIs', href: '/apis' }],
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
  {
    id: 'company',
    label: 'Company',
    sections: [
      { id: 'about', title: 'About', links: [{ id: 'team', label: 'Team', href: '/team' }] },
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
    panel.focus();
    await fireEvent.keyDown(panel, { key: 'Escape' });
    expect(container.querySelector(`#${panelId}`)).toBeNull();
  });

  test('keeps the top-level sections grid while indenting only nested sections', () => {
    const styles = readFileSync(new URL('./mega-menu.css', import.meta.url), 'utf8');

    expect(styles).toContain('.cinder-mega-menu__sections {');
    expect(styles).toContain('.cinder-mega-menu__sub .cinder-mega-menu__sections {');
    expect(styles).toMatch(/\.cinder-mega-menu__indicator\s*\{[^}]*\bleft:\s*0;/s);
    expect(styles).not.toMatch(/\.cinder-mega-menu__indicator\s*\{[^}]*\binset-inline-start:/s);
  });

  test('renders independently titled nested sections below top-level section headings', async () => {
    const nestedTitleItems = structuredClone(items);
    nestedTitleItems[0]!.submenu![0]!.sections[0]!.title = 'Frameworks';
    const { container } = render(MegaMenu, { items: nestedTitleItems });

    await fireEvent.click(getTriggerByLabel(container, 'Products'));

    const heading = Array.from(container.querySelectorAll('h4')).find(
      (element) => element.textContent === 'Frameworks',
    );
    expect(heading).not.toBeUndefined();
    expect(container.querySelector('h3')?.textContent).toBe('Core');
  });

  test('arrow navigation moves focus between top-level triggers', async () => {
    const { container } = render(MegaMenu, { items });
    const first = getTriggerByLabel(container, 'Products');
    const second = getTriggerByLabel(container, 'Resources');
    first.focus();
    await fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(second);
  });

  test('arrow keys enter, traverse, and leave a nested submenu', async () => {
    const { container } = render(MegaMenu, { items });
    const products = getTriggerByLabel(container, 'Products');
    products.focus();

    await fireEvent.keyDown(products, { key: 'ArrowDown' });

    const uiKit = container.querySelector<HTMLAnchorElement>('a[href="/ui"]');
    expect(document.activeElement).toBe(uiKit);

    const frontend = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.cinder-mega-menu__submenu-trigger'),
    ).find((trigger) => trigger.textContent?.trim() === 'Frontend');
    const backend = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.cinder-mega-menu__submenu-trigger'),
    ).find((trigger) => trigger.textContent?.trim() === 'Backend');
    if (!frontend || !backend) throw new Error('Missing nested submenu triggers.');

    frontend.focus();
    expect(frontend.getAttribute('aria-expanded')).toBe('true');
    expect(frontend.getAttribute('aria-controls')).not.toBeNull();

    await fireEvent.keyDown(frontend, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(backend);
    expect(backend.getAttribute('aria-expanded')).toBe('true');

    await fireEvent.keyDown(backend, { key: 'ArrowRight' });
    const apis = container.querySelector<HTMLAnchorElement>('a[href="/apis"]');
    expect(document.activeElement).toBe(apis);

    if (!apis) throw new Error('Missing nested submenu link.');
    await fireEvent.keyDown(apis, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(backend);

    await fireEvent.keyDown(backend, { key: 'Escape' });
    await Promise.resolve();
    expect(container.querySelector('.cinder-mega-menu__content')).toBeNull();
    expect(document.activeElement).toBe(products);
  });

  test('does not consume modified nested horizontal-arrow shortcuts', async () => {
    const { container } = render(MegaMenu, { items });
    const products = getTriggerByLabel(container, 'Products');
    products.focus();
    await fireEvent.keyDown(products, { key: 'ArrowDown' });

    const frontend = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.cinder-mega-menu__submenu-trigger'),
    ).find((trigger) => trigger.textContent?.trim() === 'Frontend');
    if (!frontend) throw new Error('Missing nested submenu trigger.');
    frontend.focus();

    for (const modifier of ['altKey', 'ctrlKey', 'metaKey'] as const) {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        [modifier]: true,
        bubbles: true,
        cancelable: true,
      });
      frontend.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(frontend);
    }

    await fireEvent.keyDown(frontend, { key: 'ArrowRight' });
    const svelteLink = container.querySelector<HTMLAnchorElement>('a[href="/svelte"]');
    if (!svelteLink) throw new Error('Missing nested submenu link.');
    expect(document.activeElement).toBe(svelteLink);

    for (const modifier of ['altKey', 'ctrlKey', 'metaKey'] as const) {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        [modifier]: true,
        bubbles: true,
        cancelable: true,
      });
      svelteLink.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(svelteLink);
    }
  });

  test('mirrors nested submenu enter and return arrows in right-to-left direction', async () => {
    const { container } = render(MegaMenu, { items, dir: 'rtl' });
    const products = getTriggerByLabel(container, 'Products');
    products.focus();

    await fireEvent.keyDown(products, { key: 'ArrowDown' });
    const frontend = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.cinder-mega-menu__submenu-trigger'),
    ).find((trigger) => trigger.textContent?.trim() === 'Frontend');
    if (!frontend) throw new Error('Missing nested submenu trigger.');

    await fireEvent.keyDown(frontend, { key: 'ArrowLeft' });
    const svelteLink = container.querySelector<HTMLAnchorElement>('a[href="/svelte"]');
    expect(document.activeElement).toBe(svelteLink);

    if (!svelteLink) throw new Error('Missing nested submenu link.');
    await fireEvent.keyDown(svelteLink, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(frontend);
  });

  test('inherits nested submenu direction from LocaleProvider', async () => {
    const { container } = render(MegaMenuLocaleTestHarness, {
      items,
      direction: 'rtl',
    });
    const products = getTriggerByLabel(container, 'Products');
    expect(container.querySelector('nav')?.getAttribute('dir')).toBe('rtl');
    products.focus();

    await fireEvent.keyDown(products, { key: 'ArrowDown' });
    const frontend = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.cinder-mega-menu__submenu-trigger'),
    ).find((trigger) => trigger.textContent?.trim() === 'Frontend');
    if (!frontend) throw new Error('Missing nested submenu trigger.');

    await fireEvent.keyDown(frontend, { key: 'ArrowLeft' });
    const svelteLink = container.querySelector<HTMLAnchorElement>('a[href="/svelte"]');
    expect(document.activeElement).toBe(svelteLink);

    if (!svelteLink) throw new Error('Missing nested submenu link.');
    await fireEvent.keyDown(svelteLink, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(frontend);
  });

  test('mirrors top-level arrow navigation inherited from LocaleProvider', async () => {
    const { container } = render(MegaMenuLocaleTestHarness, {
      items,
      direction: 'rtl',
    });
    const products = getTriggerByLabel(container, 'Products');
    const resources = getTriggerByLabel(container, 'Resources');
    products.focus();

    await fireEvent.keyDown(products, { key: 'ArrowLeft' });

    expect(document.activeElement).toBe(resources);
  });

  test('prefers a nearer DOM direction over LocaleProvider direction', async () => {
    const { container } = render(MegaMenuLocaleTestHarness, {
      items,
      direction: 'rtl',
      localDirection: 'ltr',
    });
    const nav = container.querySelector('nav');
    const products = getTriggerByLabel(container, 'Products');
    const resources = getTriggerByLabel(container, 'Resources');

    expect(nav?.getAttribute('dir')).toBe('ltr');
    products.focus();
    await fireEvent.keyDown(products, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(resources);
  });

  test("prefers the menu's own CSS direction over LocaleProvider direction", async () => {
    const { container } = render(MegaMenuLocaleTestHarness, {
      items,
      direction: 'rtl',
      menuStyle: 'direction: ltr',
    });
    const products = getTriggerByLabel(container, 'Products');
    const resources = getTriggerByLabel(container, 'Resources');

    expect(container.querySelector('nav')?.getAttribute('dir')).toBe('ltr');
    products.focus();
    await fireEvent.keyDown(products, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(resources);
  });

  test('preserves an explicit menu direction over LocaleProvider direction', () => {
    const { container } = render(MegaMenuLocaleTestHarness, {
      items,
      direction: 'rtl',
      menuDirection: 'ltr',
    });

    expect(container.querySelector('nav')?.getAttribute('dir')).toBe('ltr');
  });

  test('closes stale open menu state when the current item is removed', async () => {
    const { container, rerender } = render(MegaMenu, { items });
    const products = getTriggerByLabel(container, 'Products');
    await fireEvent.click(products);
    expect(products.getAttribute('aria-expanded')).toBe('true');

    await rerender({ items: items.filter((item) => item.id !== 'products') });

    const resources = getTriggerByLabel(container, 'Resources');
    expect(resources.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.cinder-mega-menu__content')).toBeNull();
  });
});
