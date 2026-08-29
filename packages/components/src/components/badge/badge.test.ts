/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, waitFor } = await import('@testing-library/svelte');
const { default: Badge } = await import('./badge.svelte');
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
// A top-level static import of 'svelte' resolves to svelte/index-server.js in Bun's
// non-browser environment, making `mount()` throw "not available on the server".
const { createRawSnippet } = await import('svelte');

const badgeCss = await Bun.file(new URL('./badge.css', import.meta.url)).text();

/** Creates a Svelte 5 Snippet that renders text content. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

function cssRule(selector: string): string {
  const escapedSelector = selector.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return badgeCss.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`))?.[0] ?? '';
}

describe('Badge', () => {
  test('renders without errors', () => {
    const { container } = render(Badge, { children: textSnippet('label') });
    expect(container.querySelector('.cinder-badge')).not.toBeNull();
  });

  test('applies class prop alongside cinder-badge', () => {
    const { container } = render(Badge, {
      children: textSnippet('label'),
      class: 'my-custom-class',
    });
    const span = container.querySelector('.cinder-badge');
    expect(span?.getAttribute('class')).toContain('cinder-badge');
    expect(span?.getAttribute('class')).toContain('my-custom-class');
  });

  test.each(['neutral', 'success', 'warning', 'danger', 'info', 'accent'] as const)(
    'renders data-cinder-variant="%s"',
    (variant) => {
      const { container } = render(Badge, {
        children: textSnippet('label'),
        variant,
      });
      const span = container.querySelector('.cinder-badge');
      expect(span?.getAttribute('data-cinder-variant')).toBe(variant);
    },
  );

  test.each(['xs', 'sm', 'md'] as const)('renders data-cinder-size="%s"', (size) => {
    const { container } = render(Badge, {
      children: textSnippet('label'),
      size,
    });
    const span = container.querySelector('.cinder-badge');
    expect(span?.getAttribute('data-cinder-size')).toBe(size);
  });

  test('children snippet content is rendered', () => {
    const { container } = render(Badge, {
      children: textSnippet('hello badge'),
    });
    expect(container.querySelector('.cinder-badge')?.textContent).toContain('hello badge');
  });

  test('xs and sm sizes stay mechanically differentiated for count badges', () => {
    const xsRule = cssRule(".cinder-badge[data-cinder-size='xs']");
    const smRule = cssRule(".cinder-badge[data-cinder-size='sm']");

    expect(xsRule).toContain('font-size: 0.625rem');
    expect(xsRule).toContain('line-height: 0.875rem');
    expect(smRule).toContain('font-size: var(--cinder-text-2xs');
    expect(smRule).toContain('line-height: 1rem');
  });
});

describe('Badge — monospace affordance', () => {
  test('monospace=true stamps data-cinder-monospace on the root span', () => {
    const { container } = render(Badge, {
      children: textSnippet('v1.0.0'),
      monospace: true,
    });
    const span = container.querySelector('.cinder-badge');
    expect(span?.hasAttribute('data-cinder-monospace')).toBe(true);
  });

  test('monospace=false (default) does not stamp data-cinder-monospace', () => {
    const { container } = render(Badge, {
      children: textSnippet('label'),
    });
    const span = container.querySelector('.cinder-badge');
    expect(span?.hasAttribute('data-cinder-monospace')).toBe(false);
  });
});

describe('Badge — subscription state preset', () => {
  const states = [
    ['active', 'success', 'Active', 'lucide-circle-check'],
    ['trialing', 'info', 'Trialing', 'lucide-clock'],
    ['past-due', 'warning', 'Past due', 'lucide-triangle-alert'],
    ['canceled', 'neutral', 'Canceled', 'lucide-circle-x'],
    ['expired', 'danger', 'Expired', 'lucide-archive'],
    ['refunded', 'neutral', 'Refunded', 'lucide-undo-2'],
  ] as const;
  const allIconClasses = states.map(([, , , iconClass]) => iconClass);

  test.each(states)(
    'subscriptionState="%s" renders tone, state, icon, and label',
    async (subscriptionState, variant, label, iconClass) => {
      const { container } = render(Badge, { subscriptionState });
      const badge = container.querySelector('.cinder-badge');

      expect(badge?.getAttribute('data-cinder-subscription-state')).toBe(subscriptionState);
      expect(badge?.getAttribute('data-cinder-variant')).toBe(variant);
      await waitFor(() => {
        const matches = badge?.querySelectorAll(`.${iconClass}.cinder-icon-sm`);
        expect(matches?.length).toBe(1);
        expect(matches?.[0]?.getAttribute('aria-hidden')).toBe('true');
      });
      expect(badge?.innerHTML).toContain(label);

      const otherIconClasses = allIconClasses.filter((className) => className !== iconClass);
      for (const otherIconClass of otherIconClasses) {
        expect(badge?.querySelectorAll(`.${otherIconClass}`).length).toBe(0);
      }
    },
  );

  test('subscriptionState overrides the explicit variant', () => {
    const { container } = render(Badge, {
      subscriptionState: 'active',
      variant: 'danger',
    });
    expect(container.querySelector('.cinder-badge')?.getAttribute('data-cinder-variant')).toBe(
      'success',
    );
  });

  test('subscriptionState tone remains authoritative when severity is also supplied', () => {
    const { container } = render(Badge, {
      subscriptionState: 'active',
      severity: 'high',
    });
    expect(container.querySelector('.cinder-badge')?.getAttribute('data-cinder-variant')).toBe(
      'success',
    );
  });

  test('active subscription suppresses the severity CSS hook', () => {
    const { container } = render(Badge, {
      subscriptionState: 'active',
      severity: 'critical',
    });
    const badge = container.querySelector('.cinder-badge');

    expect(badge?.getAttribute('data-cinder-variant')).toBe('success');
    expect(badge?.hasAttribute('data-cinder-severity')).toBe(false);
    expect(cssRule(".cinder-badge[data-cinder-severity='critical']")).toContain(
      'var(--cinder-severity-critical-background',
    );
  });

  test('subscriptionState children override the preset label', async () => {
    const { container } = render(Badge, {
      subscriptionState: 'active',
      children: textSnippet('Current'),
    });
    const badge = container.querySelector('.cinder-badge');

    await waitFor(() => expect(badge?.querySelector('svg')).not.toBeNull());
    expect(badge?.textContent).toContain('Current');
    expect(badge?.textContent).not.toContain('Active');
  });

  test('subscriptionState renders its icon synchronously', () => {
    const { container } = render(Badge, { subscriptionState: 'active' });
    expect(container.querySelector('.cinder-badge svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  test('subscription state icons are sourced from lucide-svelte, not hand-copied path data', async () => {
    const source = await Bun.file(new URL('./badge.svelte', import.meta.url)).text();
    // The hand-copied path-data lookup must be gone entirely — the identifier
    // shouldn't exist to import, let alone be reachable.
    expect(source).not.toContain('subscriptionStateIconPaths');
    expect(source).toMatch(
      /import\s+CircleCheck\s+from\s+['"]lucide-svelte\/icons\/circle-check['"]/,
    );
  });
});

describe('Badge — omitted children (runtime safety net)', () => {
  test('renders without throwing when children is omitted (JS consumer safety)', () => {
    // children: Snippet is required in TypeScript, but the optional-chain guard
    // ensures a JS consumer who omits it gets an empty badge rather than a crash.
    const { container } = render(Badge, { variant: 'info' } as never);
    expect(container.querySelector('.cinder-badge')).not.toBeNull();
  });
});
