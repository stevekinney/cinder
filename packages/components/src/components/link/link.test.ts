/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Link } = await import('./link.svelte');
const { createRawSnippet } = await import('svelte');

/** Creates a Svelte 5 Snippet that renders text content. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('Link rendering', () => {
  test('renders an <a> element by default', () => {
    const { container } = render(Link, {
      props: { href: '/about', children: textSnippet('About') },
    });
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.textContent?.trim()).toContain('About');
  });

  test('applies cinder-link class to the root element', () => {
    const { container } = render(Link, {
      props: { href: '/about', children: textSnippet('About') },
    });
    expect(container.querySelector('.cinder-link')).not.toBeNull();
  });

  test('class prop merges with cinder-link', () => {
    const { container } = render(Link, {
      props: { href: '/about', class: 'extra-class', children: textSnippet('About') },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.classList.contains('cinder-link')).toBe(true);
    expect(anchor?.classList.contains('extra-class')).toBe(true);
  });

  test('href is set on the rendered <a>', () => {
    const { container } = render(Link, {
      props: { href: '/products', children: textSnippet('Products') },
    });
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/products');
  });

  test('data-cinder-link attribute is present', () => {
    const { container } = render(Link, {
      props: { href: '/about', children: textSnippet('About') },
    });
    expect(container.querySelector('[data-cinder-link]')).not.toBeNull();
  });
});

describe('Link underline prop', () => {
  test('defaults to data-underline="hover"', () => {
    const { container } = render(Link, {
      props: { href: '/about', children: textSnippet('About') },
    });
    expect(container.querySelector('[data-underline="hover"]')).not.toBeNull();
  });

  test('data-underline="always" is set when underline="always"', () => {
    const { container } = render(Link, {
      props: { href: '/about', underline: 'always', children: textSnippet('About') },
    });
    expect(container.querySelector('[data-underline="always"]')).not.toBeNull();
  });

  test('data-underline="none" is set when underline="none"', () => {
    const { container } = render(Link, {
      props: { href: '/about', underline: 'none', children: textSnippet('About') },
    });
    expect(container.querySelector('[data-underline="none"]')).not.toBeNull();
  });
});

describe('Link color prop', () => {
  test('defaults to data-color="primary"', () => {
    const { container } = render(Link, {
      props: { href: '/about', children: textSnippet('About') },
    });
    expect(container.querySelector('[data-color="primary"]')).not.toBeNull();
  });

  test('data-color="inherit" is set when color="inherit"', () => {
    const { container } = render(Link, {
      props: { href: '/about', color: 'inherit', children: textSnippet('About') },
    });
    expect(container.querySelector('[data-color="inherit"]')).not.toBeNull();
  });
});

describe('Link external prop', () => {
  test('adds target="_blank" when external=true and no target supplied', () => {
    const { container } = render(Link, {
      props: { href: 'https://example.com', external: true, children: textSnippet('External') },
    });
    expect(container.querySelector('a')?.getAttribute('target')).toBe('_blank');
  });

  test('adds rel="noopener noreferrer" when external=true and no rel supplied', () => {
    const { container } = render(Link, {
      props: { href: 'https://example.com', external: true, children: textSnippet('External') },
    });
    const rel = container.querySelector('a')?.getAttribute('rel') ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  test('merges external rel values with consumer-supplied rel', () => {
    const { container } = render(Link, {
      props: {
        href: 'https://example.com',
        external: true,
        rel: 'sponsored',
        children: textSnippet('External'),
      },
    });
    const rel = container.querySelector('a')?.getAttribute('rel') ?? '';
    expect(rel).toContain('sponsored');
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  test('does not duplicate rel parts already present in consumer rel', () => {
    const { container } = render(Link, {
      props: {
        href: 'https://example.com',
        external: true,
        rel: 'noopener noreferrer',
        children: textSnippet('External'),
      },
    });
    const rel = container.querySelector('a')?.getAttribute('rel') ?? '';
    // "noopener" should appear only once
    expect(rel.split('noopener').length - 1).toBe(1);
  });

  test('preserves consumer-supplied target when external=true', () => {
    const { container } = render(Link, {
      props: {
        href: 'https://example.com',
        external: true,
        target: '_self',
        children: textSnippet('External'),
      },
    });
    expect(container.querySelector('a')?.getAttribute('target')).toBe('_self');
  });

  test('does not add target when external=false', () => {
    const { container } = render(Link, {
      props: { href: '/about', children: textSnippet('About') },
    });
    expect(container.querySelector('a')?.getAttribute('target')).toBeNull();
  });

  test('adds noopener noreferrer when target="_blank" is passed without external', () => {
    // Reverse-tabnabbing guard: any link opening in a new tab gets the safe rel,
    // not just ones flagged external.
    const { container } = render(Link, {
      props: { href: 'https://example.com', target: '_blank', children: textSnippet('Blank') },
    });
    const rel = container.querySelector('a')?.getAttribute('rel') ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  test('de-dupes rel case-insensitively (no duplicate noopener for "NoOpener")', () => {
    const { container } = render(Link, {
      props: {
        href: 'https://example.com',
        external: true,
        rel: 'NoOpener',
        children: textSnippet('External'),
      },
    });
    const rel = container.querySelector('a')?.getAttribute('rel') ?? '';
    // Only the consumer's "NoOpener" remains for that token; "noreferrer" is appended.
    expect(rel.toLowerCase().split('noopener').length - 1).toBe(1);
    expect(rel).toContain('noreferrer');
  });
});

describe('Link disabled prop', () => {
  test('renders a <span> when disabled=true', () => {
    const { container } = render(Link, {
      props: { href: '/about', disabled: true, children: textSnippet('About') },
    });
    expect(container.querySelector('span.cinder-link')).not.toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });

  test('disabled span has aria-disabled="true"', () => {
    const { container } = render(Link, {
      props: { href: '/about', disabled: true, children: textSnippet('About') },
    });
    expect(container.querySelector('span')?.getAttribute('aria-disabled')).toBe('true');
  });

  test('disabled span has data-disabled attribute', () => {
    const { container } = render(Link, {
      props: { href: '/about', disabled: true, children: textSnippet('About') },
    });
    expect(container.querySelector('span')?.hasAttribute('data-disabled')).toBe(true);
  });

  test('disabled span does not have href', () => {
    const { container } = render(Link, {
      props: { href: '/about', disabled: true, children: textSnippet('About') },
    });
    // There's no <a>, so no href possible.
    expect(container.querySelector('[href]')).toBeNull();
  });

  test('disabled span does not add target or rel from external=true', () => {
    const { container } = render(Link, {
      props: {
        href: 'https://example.com',
        disabled: true,
        external: true,
        children: textSnippet('About'),
      },
    });
    const span = container.querySelector('span');
    expect(span?.getAttribute('target')).toBeNull();
    expect(span?.getAttribute('rel')).toBeNull();
  });

  test('enabled link does not render data-disabled', () => {
    const { container } = render(Link, {
      props: { href: '/about', children: textSnippet('About') },
    });
    expect(container.querySelector('[data-disabled]')).toBeNull();
  });

  test('a consumer tabindex is NOT forwarded onto the disabled <span>', () => {
    // tabindex is pulled out of rest and applied only to the enabled <a>, so a disabled
    // link can't be made focusable via a passthrough tabindex.
    const { container } = render(Link, {
      props: { href: '/about', disabled: true, tabindex: 0, children: textSnippet('About') },
    });
    expect(container.querySelector('span')?.hasAttribute('tabindex')).toBe(false);
  });

  test('a consumer tabindex IS forwarded onto the enabled <a>', () => {
    const { container } = render(Link, {
      props: { href: '/about', tabindex: -1, children: textSnippet('About') },
    });
    expect(container.querySelector('a')?.getAttribute('tabindex')).toBe('-1');
  });
});

describe('Link native attribute passthrough', () => {
  test('rest props (data-testid) are forwarded to the rendered element', () => {
    const { container } = render(Link, {
      props: { href: '/about', 'data-testid': 'my-link', children: textSnippet('About') },
    });
    expect(container.querySelector('[data-testid="my-link"]')).not.toBeNull();
  });

  test('id prop is forwarded to the <a>', () => {
    const { container } = render(Link, {
      props: { href: '/about', id: 'link-about', children: textSnippet('About') },
    });
    expect(container.querySelector('a')?.getAttribute('id')).toBe('link-about');
  });

  test('component-controlled aria-disabled on the <span> cannot be clobbered by rest spread', () => {
    // {...spanAttributes} is spread before aria-disabled in the template — the component's value wins.
    const { container } = render(Link, {
      props: {
        href: '/about',
        disabled: true,
        'aria-disabled': 'false' as never,
        children: textSnippet('About'),
      },
    });
    expect(container.querySelector('span')?.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('Link focus-visible underline affordance', () => {
  // The CSS selectors `.cinder-link[data-underline='hover']:focus-visible:not([data-disabled])`
  // and `.cinder-link[data-underline='none']:focus-visible:not([data-disabled])` both require
  // the correct data attributes to be present. These tests verify the attributes so the CSS
  // hook works correctly for keyboard users — keyboard users must see the underline on focus
  // even when `underline='hover'` or `underline='none'` hides it at rest.

  test('underline="hover" link has data-underline="hover" and no data-disabled when enabled', () => {
    const { container } = render(Link, {
      props: { href: '/about', underline: 'hover', children: textSnippet('Focus') },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('data-underline')).toBe('hover');
    expect(anchor?.hasAttribute('data-disabled')).toBe(false);
  });

  test('underline="none" link has data-underline="none" and no data-disabled when enabled', () => {
    const { container } = render(Link, {
      props: { href: '/about', underline: 'none', children: textSnippet('Focus') },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('data-underline')).toBe('none');
    expect(anchor?.hasAttribute('data-disabled')).toBe(false);
  });

  test('disabled link has data-disabled so focus-visible underline rule is suppressed', () => {
    const { container } = render(Link, {
      props: { href: '/about', underline: 'hover', disabled: true, children: textSnippet('Focus') },
    });
    const span = container.querySelector('span');
    expect(span?.hasAttribute('data-disabled')).toBe(true);
  });
});
