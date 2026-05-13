/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Banner } = await import('./banner.svelte');

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
      // Cast: HTMLAttributes typing exposes live-region attributes, but banner
      // deliberately strips them at runtime so the type-allowed attributes are
      // the worst case we need to verify.
      props: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['aria-live' as any]: 'assertive',
        ['aria-atomic' as any]: 'true',
        ['aria-relevant' as any]: 'additions',
        children: emptySnippet,
      } as never,
    });
    const root = container.querySelector('.cinder-banner');
    expect(root?.hasAttribute('aria-live')).toBe(false);
    expect(root?.hasAttribute('aria-atomic')).toBe(false);
    expect(root?.hasAttribute('aria-relevant')).toBe(false);
  });

  test('consumer-supplied aria-busy is preserved', () => {
    const { container } = render(Banner, {
      props: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['aria-busy' as any]: 'true',
        children: emptySnippet,
      } as never,
    });
    expect(container.querySelector('.cinder-banner')?.getAttribute('aria-busy')).toBe('true');
  });
});

describe('Banner dismiss behavior', () => {
  test('renders a dismiss button when dismissible defaults to true', () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-banner__dismiss')).not.toBeNull();
  });

  test('does not render dismiss button when dismissible={false}', () => {
    const { container } = render(Banner, {
      props: { dismissible: false, children: emptySnippet },
    });
    expect(container.querySelector('.cinder-banner__dismiss')).toBeNull();
  });

  test('dismiss button is a <button type="button"> with aria-label="Dismiss banner"', () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    const button = container.querySelector('.cinder-banner__dismiss');
    expect(button).not.toBeNull();
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.getAttribute('aria-label')).toBe('Dismiss banner');
  });

  test('clicking the dismiss button removes the banner from the DOM', async () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    const button = container.querySelector('.cinder-banner__dismiss') as HTMLButtonElement;
    await fireEvent.click(button);
    expect(container.querySelector('.cinder-banner')).toBeNull();
  });

  test('clicking the dismiss button invokes onDismiss exactly once', async () => {
    let callCount = 0;
    const { container } = render(Banner, {
      props: {
        onDismiss: () => {
          callCount += 1;
        },
        children: emptySnippet,
      },
    });
    const button = container.querySelector('.cinder-banner__dismiss') as HTMLButtonElement;
    await fireEvent.click(button);
    expect(callCount).toBe(1);
  });

  test('dismissing while focused moves focus to the next focusable element', async () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    const after = document.createElement('button');
    after.type = 'button';
    after.textContent = 'Continue';
    container.after(after);

    try {
      const button = container.querySelector('.cinder-banner__dismiss') as HTMLButtonElement;
      button.focus();
      expect(document.activeElement).toBe(button);
      await fireEvent.click(button);
      expect(container.querySelector('.cinder-banner')).toBeNull();
      expect(document.activeElement).toBe(after);
    } finally {
      after.remove();
    }
  });

  test('omitting onDismiss does not throw when the dismiss button is clicked', async () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    const button = container.querySelector('.cinder-banner__dismiss') as HTMLButtonElement;
    await fireEvent.click(button);
    expect(container.querySelector('.cinder-banner')).toBeNull();
  });

  test('dismissing while focused falls back to the nearest preceding focusable element', async () => {
    // Mark every existing focusable as inert-scoped so leakage from prior
    // tests cannot become the "next" candidate. The component's filter skips
    // anything inside a `[inert]` ancestor.
    const inertWrapper = document.createElement('div');
    inertWrapper.setAttribute('inert', '');
    while (document.body.firstChild) {
      inertWrapper.appendChild(document.body.firstChild);
    }
    document.body.appendChild(inertWrapper);

    const before = document.createElement('button');
    before.type = 'button';
    before.textContent = 'Back';
    document.body.appendChild(before);

    const { container, unmount } = render(Banner, {
      props: { children: emptySnippet },
    });

    try {
      const button = container.querySelector('.cinder-banner__dismiss') as HTMLButtonElement;
      button.focus();
      expect(document.activeElement).toBe(button);
      await fireEvent.click(button);
      expect(container.querySelector('.cinder-banner')).toBeNull();
      expect(document.activeElement).toBe(before);
    } finally {
      unmount();
      before.remove();
      // Restore the original body children for subsequent tests.
      while (inertWrapper.firstChild) {
        document.body.appendChild(inertWrapper.firstChild);
      }
      inertWrapper.remove();
    }
  });

  test('rapid double-click on dismiss invokes onDismiss exactly once', async () => {
    let callCount = 0;
    const { container } = render(Banner, {
      props: {
        onDismiss: () => {
          callCount += 1;
        },
        children: emptySnippet,
      },
    });
    const button = container.querySelector('.cinder-banner__dismiss') as HTMLButtonElement;
    await fireEvent.click(button);
    await fireEvent.click(button);
    expect(callCount).toBe(1);
  });

  test('banner is removed from the DOM before onDismiss fires', async () => {
    let bannerStillPresent = true;
    const { container } = render(Banner, {
      props: {
        onDismiss: () => {
          bannerStillPresent = container.querySelector('.cinder-banner') !== null;
        },
        children: emptySnippet,
      },
    });
    const button = container.querySelector('.cinder-banner__dismiss') as HTMLButtonElement;
    await fireEvent.click(button);
    expect(bannerStillPresent).toBe(false);
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
    const root = container.querySelector('.cinder-banner') as HTMLElement;
    const actions = root.querySelector('.cinder-banner__actions') as HTMLElement;
    const dismiss = root.querySelector('.cinder-banner__dismiss') as HTMLElement;
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
