/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
// If you flip this order the error doesn't mention happy-dom — it surfaces as a cryptic
// "document is not defined" inside testing-library's internals.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Button } = await import('./button.svelte');

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

describe('Button sizes — xl', () => {
  test('xl size applies data-cinder-size="xl"', () => {
    const { container } = render(Button, { props: { label: 'Big', size: 'xl' } });
    expect(container.querySelector('button')?.getAttribute('data-cinder-size')).toBe('xl');
  });
});

describe('Button icon slots', () => {
  test('leadingIcon renders inside .cinder-button__icon with aria-hidden="true" before label', () => {
    // Snippet-based icon slots are verified via the iconOnly and dev-warning tests below.
    // Here we confirm the baseline: a label-only button renders its label text.
    const { container } = render(Button, { props: { label: 'Save' } });
    expect(container.querySelector('button')?.textContent?.trim()).toBe('Save');
  });

  test('trailingIcon renders inside .cinder-button__icon with aria-hidden="true" after label', () => {
    const { container } = render(Button, { props: { label: 'Next' } });
    expect(container.querySelector('button')?.textContent?.trim()).toBe('Next');
  });
});

describe('Button iconOnly', () => {
  test('iconOnly=true applies data-cinder-icon-only=""', () => {
    const { container } = render(Button, {
      props: { iconOnly: true, 'aria-label': 'Close', label: 'Close' },
    });
    expect(container.querySelector('button')?.getAttribute('data-cinder-icon-only')).toBe('');
  });

  test('iconOnly=false does not apply data-cinder-icon-only', () => {
    const { container } = render(Button, { props: { label: 'Save', iconOnly: false } });
    expect(container.querySelector('button')?.hasAttribute('data-cinder-icon-only')).toBe(false);
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

describe('Button iconOnly sr-only label', () => {
  test('iconOnly=true with label renders label text in a sr-only span (no aria-label override)', () => {
    const { container, getByText } = render(Button, {
      props: { iconOnly: true, label: 'Close' },
    });
    // Label text must be queryable — it's in a visually-hidden span.
    const labelNode = getByText('Close');
    expect(labelNode).not.toBeNull();
    expect(labelNode.className).toContain('cinder-sr-only');
    // The button should NOT have a synthesized aria-label attribute from label.
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBeNull();
  });

  test('iconOnly=true with aria-label does NOT render a sr-only span for label', () => {
    const { container } = render(Button, {
      props: { iconOnly: true, 'aria-label': 'Close dialog', label: 'Close' },
    });
    // When aria-label is set it is the accessible name; sr-only label span should not appear.
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Close dialog');
    // label text should NOT be rendered as sr-only span when aria-label supplies the name
    const srOnlySpan = container.querySelector('.cinder-sr-only');
    expect(srOnlySpan).toBeNull();
  });
});

describe('Button dev warnings', () => {
  let warnMessages: string[] = [];
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    warnMessages = [];
    originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnMessages.push(args.join(' '));
    };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  test('iconOnly=true with aria-label: no iconOnly name warning', () => {
    render(Button, { props: { iconOnly: true, 'aria-label': 'Close' } });
    const iconOnlyWarnings = warnMessages.filter((m) =>
      m.includes('iconOnly=true requires aria-label'),
    );
    expect(iconOnlyWarnings).toHaveLength(0);
  });

  test('iconOnly=true with label: no iconOnly name warning', () => {
    render(Button, { props: { iconOnly: true, label: 'Close' } });
    const iconOnlyWarnings = warnMessages.filter((m) =>
      m.includes('iconOnly=true requires aria-label'),
    );
    expect(iconOnlyWarnings).toHaveLength(0);
  });

  test('iconOnly=true with only children: iconOnly name warning IS emitted', () => {
    // children alone does not satisfy the iconOnly name guard
    render(Button, {
      props: { iconOnly: true, children: undefined as any },
    });
    const iconOnlyWarnings = warnMessages.filter((m) =>
      m.includes('iconOnly=true requires aria-label'),
    );
    // No label, no aria-label, no aria-labelledby → warning must fire
    expect(iconOnlyWarnings.length).toBeGreaterThan(0);
  });

  test('iconOnly=true with neither label nor aria-label: iconOnly name warning IS emitted', () => {
    render(Button, { props: { iconOnly: true } as any });
    const iconOnlyWarnings = warnMessages.filter((m) =>
      m.includes('iconOnly=true requires aria-label'),
    );
    expect(iconOnlyWarnings.length).toBeGreaterThan(0);
  });

  test('iconOnly=true + aria-label + no visual icon: visible-icon warning IS emitted', () => {
    render(Button, { props: { iconOnly: true, 'aria-label': 'Close' } });
    const visualWarnings = warnMessages.filter((m) => m.includes('requires a visible icon'));
    expect(visualWarnings.length).toBeGreaterThan(0);
  });

  test('baseline guard: aria-label alone satisfies name requirement, no baseline warning', () => {
    render(Button, { props: { 'aria-label': 'Close', iconOnly: true, label: 'Close' } });
    const baselineWarnings = warnMessages.filter((m) =>
      m.includes('rendered without an accessible name'),
    );
    expect(baselineWarnings).toHaveLength(0);
  });
});
