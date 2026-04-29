/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: Popover } = await import('./popover.svelte');

function snippetWith(html: string) {
  return createRawSnippet(() => ({ render: () => html }));
}

describe('Popover (experimental)', () => {
  test('renders the trigger snippet', () => {
    const { container } = render(Popover, {
      trigger: snippetWith('<button>Open</button>'),
      children: snippetWith('<p>Content</p>'),
    });
    expect(container.querySelector('button')?.textContent?.trim()).toBe('Open');
  });

  test('placement prop sets the data attribute', () => {
    const { container } = render(Popover, {
      placement: 'top-end',
      trigger: snippetWith('<button>Open</button>'),
      children: snippetWith('<p>Content</p>'),
    });
    expect(
      container.querySelector('.cinder-popover-wrapper')?.getAttribute('data-cinder-placement'),
    ).toBe('top-end');
  });

  test('wires aria-haspopup, aria-expanded, aria-controls onto the trigger button', () => {
    const { container } = render(Popover, {
      open: true,
      trigger: snippetWith('<button>Open</button>'),
      children: snippetWith('<p>Content</p>'),
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(button?.getAttribute('aria-controls')).toMatch(/^cinder-popover-/);
  });

  test('aria-expanded=false when closed', () => {
    const { container } = render(Popover, {
      open: false,
      trigger: snippetWith('<button>Open</button>'),
      children: snippetWith('<p>Content</p>'),
    });
    expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
  });
});
