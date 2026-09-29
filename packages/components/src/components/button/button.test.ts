import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
setupHappyDom();
const { cleanup, render } = await import('@testing-library/svelte');
const { default: Button } = await import('./button.svelte');
afterEach(cleanup);

describe('Button rendering', () => {
  test('renders a <button> when no href is provided', () => {
    const { container } = render(Button, { props: { label: 'click me' } });
    expect(container.querySelector('button')).not.toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });

  test('renders an <a> when href is provided', () => {
    const { container } = render(Button, { props: { href: '/target', label: 'go' } });
    expect(container.querySelector('a')).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  test('a standalone Button (no ButtonGroup ancestor) does not carry the group styling-contract attribute (COR-459)', () => {
    const { container } = render(Button, { props: { label: 'click me' } });
    expect(container.querySelector('button')?.hasAttribute('data-cinder-button-group-item')).toBe(
      false,
    );
  });

  test('button applies variant + size as data attributes', () => {
    const { container } = render(Button, {
      props: { label: 'tag', variant: 'danger', size: 'lg' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('data-cinder-variant')).toBe('danger');
    expect(button?.getAttribute('data-cinder-size')).toBe('lg');
  });

  test('supports the ghost-danger variant', () => {
    const { container } = render(Button, {
      props: { label: 'Remove', variant: 'ghost-danger' },
    });

    expect(container.querySelector('button')?.getAttribute('data-cinder-variant')).toBe(
      'ghost-danger',
    );
  });

  test('loading button has disabled + aria-busy + aria-disabled', () => {
    const { container } = render(Button, { props: { label: 'sending', loading: true } });
    const button = container.querySelector('button');
    expect(button?.hasAttribute('disabled')).toBe(true);
    expect(button?.getAttribute('aria-busy')).toBe('true');
    expect(button?.getAttribute('aria-disabled')).toBe('true');
    expect(button?.getAttribute('data-cinder-loading')).toBe('');
  });

  test('reactively forwards popover trigger ARIA to the native button', async () => {
    const { container, rerender } = render(Button, {
      props: {
        label: 'Toggle',
        'aria-controls': 'panel-a',
        'aria-expanded': 'true',
        'aria-haspopup': 'dialog',
      },
    });
    const button = container.querySelector('button');

    expect(button?.getAttribute('aria-controls')).toBe('panel-a');
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(button?.getAttribute('aria-haspopup')).toBe('dialog');
    await rerender({
      label: 'Toggle',
      'aria-controls': undefined,
      'aria-expanded': 'false',
      'aria-haspopup': 'menu',
    });
    expect(button?.hasAttribute('aria-controls')).toBe(false);
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    expect(button?.getAttribute('aria-haspopup')).toBe('menu');
  });

  test('loading link removes href and is un-tab-reachable', () => {
    const { container } = render(Button, {
      props: { href: '/target', label: 'go', loading: true },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.hasAttribute('href')).toBe(false);
    expect(anchor?.getAttribute('tabindex')).toBe('-1');
    expect(anchor?.getAttribute('aria-disabled')).toBe('true');
    expect(anchor?.getAttribute('aria-busy')).toBe('true');
  });

  test('loading link does NOT invoke consumer onclick', () => {
    let invocationCount = 0;
    const { container } = render(Button, {
      props: {
        href: '/target',
        label: 'go',
        loading: true,
        onclick: () => {
          invocationCount += 1;
        },
      },
    });
    const anchor = container.querySelector('a');
    anchor?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(invocationCount).toBe(0);
  });

  test('non-loading link DOES invoke consumer onclick', () => {
    let invocationCount = 0;
    const { container } = render(Button, {
      props: {
        href: '/target',
        label: 'go',
        onclick: () => {
          invocationCount += 1;
        },
      },
    });
    const anchor = container.querySelector('a');
    anchor?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(invocationCount).toBe(1);
  });

  test('consumer-provided aria-disabled survives when not loading', () => {
    const { container } = render(Button, {
      props: { label: 'x', 'aria-disabled': 'true' },
    });
    const button = container.querySelector('button');
    // Consumer set aria-disabled='true' manually; not loading, so we preserve it.
    expect(button?.getAttribute('aria-disabled')).toBe('true');
  });

  test('consumer class name merges with .cinder-button', () => {
    const { container } = render(Button, {
      props: { label: 'x', class: 'my-extra-class' },
    });
    const classAttr = container.querySelector('button')?.getAttribute('class') ?? '';
    expect(classAttr).toContain('cinder-button');
    expect(classAttr).toContain('my-extra-class');
  });

  test('rest attributes forward to rendered <button> elements', () => {
    const { container } = render(Button, {
      props: { label: 'Save', 'data-testid': 'button-rest-target' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('data-testid')).toBe('button-rest-target');
  });

  test('rest attributes forward to rendered <a> elements', () => {
    const { container } = render(Button, {
      props: { href: '/target', label: 'Open', 'data-testid': 'link-rest-target' },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('data-testid')).toBe('link-rest-target');
  });
});

describe('Button variants — new additions', () => {
  test('soft variant applies data-cinder-variant="soft"', () => {
    const { container } = render(Button, { props: { label: 'Soft', variant: 'soft' } });
    expect(container.querySelector('button')?.getAttribute('data-cinder-variant')).toBe('soft');
  });

  test('soft-danger variant applies data-cinder-variant="soft-danger"', () => {
    const { container } = render(Button, {
      props: { label: 'Delete', variant: 'soft-danger' },
    });
    expect(container.querySelector('button')?.getAttribute('data-cinder-variant')).toBe(
      'soft-danger',
    );
  });
});

describe('Button loading state', () => {
  test('loading + label: label text remains in DOM', () => {
    const { getByText } = render(Button, { props: { label: 'Saving', loading: true } });
    // Label must remain in the DOM as the accessible name throughout loading.
    expect(getByText('Saving')).not.toBeNull();
  });

  test('loading + label: no DOM spinner node (spinner is a CSS pseudo-element)', () => {
    const { container } = render(Button, { props: { label: 'Saving', loading: true } });
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('.cinder-spinner')).toBeNull();
  });
});

describe('Button ghost-danger disabled state', () => {
  test('ghost-danger disabled button preserves data attributes', () => {
    const { container } = render(Button, {
      props: { label: 'Delete', variant: 'ghost-danger', 'aria-disabled': 'true' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('data-cinder-variant')).toBe('ghost-danger');
    expect(button?.getAttribute('aria-disabled')).toBe('true');
  });
});
