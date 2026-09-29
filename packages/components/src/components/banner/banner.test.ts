/// <reference lib="dom" />
// happy-dom globals are installed in scripts/preload.ts, so static imports of
// @testing-library/svelte and the .svelte components are safe here. Static
// imports also dodge a Bun test-runner deadlock that occurs when many test
// files race to top-level-`await import(...)` the same modules in parallel.
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { requiredInstance } from '@lostgradient/testing';
import Banner from './banner.svelte';

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

const emptySnippet = createRawSnippet(() => ({
  render: () => `<span></span>`,
  setup: () => {},
}));

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('Banner rendering', () => {
  test('renders without errors with required props', () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-banner')).not.toBeNull();
  });

  test('applies custom class prop to root element while preserving cinder-banner', () => {
    const { container } = render(Banner, {
      props: { class: 'my-custom-class', children: emptySnippet },
    });
    const root = container.querySelector('.cinder-banner');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
    expect(root?.classList.contains('cinder-banner')).toBe(true);
  });

  test('rest props are spread onto the root element', () => {
    const { container } = render(Banner, {
      props: { id: 'my-banner', children: emptySnippet },
    });
    expect(container.querySelector('#my-banner')).not.toBeNull();
  });

  for (const variant of ['info', 'success', 'warning', 'danger'] as const) {
    test(`applies data-cinder-variant for variant "${variant}"`, () => {
      const { container } = render(Banner, {
        props: { variant, children: emptySnippet },
      });
      expect(container.querySelector('.cinder-banner')?.getAttribute('data-cinder-variant')).toBe(
        variant,
      );
    });
  }

  test('defaults data-cinder-variant to "info" when variant is omitted', () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-banner')?.getAttribute('data-cinder-variant')).toBe(
      'info',
    );
  });
});

describe('Banner region landmark + accessible name', () => {
  test('root has role="region"', () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-banner')?.getAttribute('role')).toBe('region');
  });

  for (const [variant, expectedLabel] of [
    ['info', 'Information'],
    ['success', 'Success'],
    ['warning', 'Warning'],
    ['danger', 'Error'],
  ] as const) {
    test(`root has aria-label="${expectedLabel}" for variant "${variant}"`, () => {
      const { container } = render(Banner, {
        props: { variant, children: emptySnippet },
      });
      expect(container.querySelector('.cinder-banner')?.getAttribute('aria-label')).toBe(
        expectedLabel,
      );
    });
  }

  test('consumer-provided aria-label overrides variant-derived default', () => {
    const { container } = render(Banner, {
      props: {
        variant: 'warning',
        'aria-label': 'Trial expiring soon',
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-banner')?.getAttribute('aria-label')).toBe(
      'Trial expiring soon',
    );
  });

  test('consumer-provided aria-labelledby suppresses default aria-label', () => {
    const { container } = render(Banner, {
      props: {
        variant: 'warning',
        'aria-labelledby': 'external-heading',
        children: emptySnippet,
      },
    });
    const root = container.querySelector('.cinder-banner');
    expect(root?.getAttribute('aria-labelledby')).toBe('external-heading');
    expect(root?.hasAttribute('aria-label')).toBe(false);
  });

  test('root does not have role="alert" and does not have aria-live', () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    const root = container.querySelector('.cinder-banner');
    expect(root?.getAttribute('role')).not.toBe('alert');
    expect(root?.hasAttribute('aria-live')).toBe(false);
  });

  test('consumer-supplied live-region attributes are stripped', () => {
    const { container } = render(Banner, {
      // HTMLAttributes typing exposes live-region attributes, but Banner
      // deliberately strips them at runtime so the type-allowed attributes are
      // the worst case we need to verify.
      props: {
        'aria-live': 'assertive',
        'aria-atomic': 'true',
        'aria-relevant': 'additions',
        children: emptySnippet,
      },
    });
    const root = container.querySelector('.cinder-banner');
    expect(root?.hasAttribute('aria-live')).toBe(false);
    expect(root?.hasAttribute('aria-atomic')).toBe(false);
    expect(root?.hasAttribute('aria-relevant')).toBe(false);
  });

  test('consumer-supplied aria-busy is preserved', () => {
    const { container } = render(Banner, {
      props: {
        'aria-busy': 'true',
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-banner')?.getAttribute('aria-busy')).toBe('true');
  });
});

describe('Banner snippets', () => {
  test('children snippet renders inside .cinder-banner__content', () => {
    const { container } = render(Banner, {
      props: { children: textSnippet('Maintenance window tonight') },
    });
    expect(container.querySelector('.cinder-banner__content')?.textContent).toContain(
      'Maintenance window tonight',
    );
  });

  test('actions snippet renders inside .cinder-banner__actions when provided', () => {
    const { container } = render(Banner, {
      props: {
        children: emptySnippet,
        actions: textSnippet('Renew now'),
      },
    });
    const actions = container.querySelector('.cinder-banner__actions');
    expect(actions).not.toBeNull();
    expect(actions?.textContent).toContain('Renew now');
  });

  test('.cinder-banner__actions is absent when actions prop is omitted', () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-banner__actions')).toBeNull();
  });

  test('actions region appears before dismiss button in DOM order', () => {
    const { container } = render(Banner, {
      props: {
        children: emptySnippet,
        actions: textSnippet('Renew now'),
      },
    });
    const root = requiredInstance(container.querySelector('.cinder-banner'), HTMLElement);
    const actions = requiredInstance(root.querySelector('.cinder-banner__actions'), HTMLElement);
    const dismiss = requiredInstance(root.querySelector('.cinder-banner__dismiss'), HTMLElement);
    expect(actions).not.toBeNull();
    expect(dismiss).not.toBeNull();
    // compareDocumentPosition: 4 == FOLLOWING
    expect(
      actions.compareDocumentPosition(dismiss) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('Banner persistence', () => {
  test('on initial render the banner is visible', () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-banner')).not.toBeNull();
  });

  test('the banner stays in the DOM until dismissed (no auto-hide)', async () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    // Wait a tick — no timer should remove it.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.querySelector('.cinder-banner')).not.toBeNull();
  });
});
