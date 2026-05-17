/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Callout } = await import('./callout.svelte');

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

describe('Callout rendering', () => {
  test('renders without errors with required props', () => {
    const { container } = render(Callout, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-callout')).not.toBeNull();
  });

  test('root element is an <aside>', () => {
    const { container } = render(Callout, {
      props: { children: emptySnippet },
    });
    const root = container.querySelector('.cinder-callout');
    expect(root?.tagName).toBe('ASIDE');
  });

  test('applies custom class prop while preserving cinder-callout', () => {
    const { container } = render(Callout, {
      props: { class: 'my-custom-class', children: emptySnippet },
    });
    const root = container.querySelector('.cinder-callout');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
    expect(root?.classList.contains('cinder-callout')).toBe(true);
  });

  test('rest props are spread onto the root element', () => {
    const { container } = render(Callout, {
      props: { id: 'my-callout', children: emptySnippet },
    });
    expect(container.querySelector('#my-callout')).not.toBeNull();
  });

  test('renders body children inside the content region', () => {
    const { container } = render(Callout, {
      props: { children: textSnippet('Body text') },
    });
    expect(container.querySelector('.cinder-callout__content')?.textContent).toContain('Body text');
  });
});

describe('Callout variants', () => {
  for (const variant of ['info', 'success', 'warning', 'danger'] as const) {
    test(`applies data-cinder-variant for variant "${variant}"`, () => {
      const { container } = render(Callout, {
        props: { variant, children: emptySnippet },
      });
      expect(container.querySelector('.cinder-callout')?.getAttribute('data-cinder-variant')).toBe(
        variant,
      );
    });
  }

  test('defaults data-cinder-variant to "info" when variant is omitted', () => {
    const { container } = render(Callout, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-callout')?.getAttribute('data-cinder-variant')).toBe(
      'info',
    );
  });
});

describe('Callout title', () => {
  test('renders title as a <p>, not a heading element', () => {
    const { container } = render(Callout, {
      props: { title: 'Heads up', children: emptySnippet },
    });
    const titleElement = container.querySelector('.cinder-callout__title');
    expect(titleElement).not.toBeNull();
    expect(titleElement?.tagName).toBe('P');
    expect(titleElement?.textContent).toBe('Heads up');
  });

  test('omits the title element when no title prop is supplied', () => {
    const { container } = render(Callout, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-callout__title')).toBeNull();
  });

  test('does not inject heading elements into the document outline', () => {
    const { container } = render(Callout, {
      props: { title: 'Heads up', children: textSnippet('Body') },
    });
    expect(container.querySelectorAll('h1, h2, h3, h4, h5, h6').length).toBe(0);
  });
});

describe('Callout icon', () => {
  test('renders icon snippet when provided', () => {
    const { container } = render(Callout, {
      props: { icon: textSnippet('icon-mark'), children: emptySnippet },
    });
    const iconWrapper = container.querySelector('.cinder-callout__icon');
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper?.textContent).toContain('icon-mark');
  });

  test('icon wrapper is aria-hidden', () => {
    const { container } = render(Callout, {
      props: { icon: textSnippet('x'), children: emptySnippet },
    });
    expect(container.querySelector('.cinder-callout__icon')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  test('does not render an icon wrapper when icon prop is omitted', () => {
    const { container } = render(Callout, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-callout__icon')).toBeNull();
  });
});

describe('Callout accessibility', () => {
  test('does not set an explicit role attribute on the root <aside>', () => {
    const { container } = render(Callout, {
      props: { children: emptySnippet },
    });
    const root = container.querySelector('.cinder-callout');
    expect(root?.hasAttribute('role')).toBe(false);
  });

  test('does not set aria-live on the root element', () => {
    const { container } = render(Callout, {
      props: { children: emptySnippet },
    });
    const root = container.querySelector('.cinder-callout');
    expect(root?.hasAttribute('aria-live')).toBe(false);
  });

  test('strips a consumer-supplied role from rest props', () => {
    // role is forbidden by the type, but a consumer can still escape it
    // via `as never`. The runtime must scrub it so consumers cannot
    // override the implicit <aside> role with role="alert" or similar.
    const { container } = render(Callout, {
      props: { role: 'alert', children: emptySnippet } as never,
    });
    const root = container.querySelector('.cinder-callout');
    expect(root?.hasAttribute('role')).toBe(false);
  });

  test('strips aria-live from consumer-supplied rest props', () => {
    const { container } = render(Callout, {
      // aria-live is intentionally forbidden by the type, but a runtime
      // consumer could still pass it through spread props. The component
      // must scrub it so callouts never accidentally become live regions.
      props: { 'aria-live': 'polite', children: emptySnippet } as never,
    });
    const root = container.querySelector('.cinder-callout');
    expect(root?.hasAttribute('aria-live')).toBe(false);
  });

  test('strips aria-atomic, aria-relevant, and aria-busy from consumer rest props', () => {
    const { container } = render(Callout, {
      props: {
        'aria-atomic': 'true',
        'aria-relevant': 'additions',
        'aria-busy': 'true',
        children: emptySnippet,
      } as never,
    });
    const root = container.querySelector('.cinder-callout');
    expect(root?.hasAttribute('aria-atomic')).toBe(false);
    expect(root?.hasAttribute('aria-relevant')).toBe(false);
    expect(root?.hasAttribute('aria-busy')).toBe(false);
  });

  test('forwards aria-label from consumer rest props', () => {
    const { container } = render(Callout, {
      props: { 'aria-label': 'Heads up', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-callout')?.getAttribute('aria-label')).toBe('Heads up');
  });
});

describe('Callout landmark labeling', () => {
  test('derives aria-label from title when no consumer label is provided', () => {
    const { container } = render(Callout, {
      props: { title: 'Heads up', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-callout')?.getAttribute('aria-label')).toBe('Heads up');
  });

  test('does not set aria-label when neither title nor consumer label is supplied', () => {
    const { container } = render(Callout, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-callout')?.hasAttribute('aria-label')).toBe(false);
  });

  test('consumer-supplied aria-label overrides the title-derived label', () => {
    const { container } = render(Callout, {
      props: {
        title: 'Visual title',
        'aria-label': 'Accessible name',
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-callout')?.getAttribute('aria-label')).toBe(
      'Accessible name',
    );
  });

  test('aria-labelledby suppresses the title-derived aria-label so the accessible name has a single source', () => {
    const { container } = render(Callout, {
      props: {
        title: 'Visual title',
        'aria-labelledby': 'external-heading',
        children: emptySnippet,
      },
    });
    const root = container.querySelector('.cinder-callout');
    expect(root?.hasAttribute('aria-label')).toBe(false);
    expect(root?.getAttribute('aria-labelledby')).toBe('external-heading');
  });
});
