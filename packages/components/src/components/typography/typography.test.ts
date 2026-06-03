/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Typography } = await import('./typography.svelte');
const { createRawSnippet } = await import('svelte');

/** Creates a Svelte 5 Snippet that renders text content. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('Typography default rendering', () => {
  test('default variant (body1) renders a <p> element', () => {
    const { container } = render(Typography, {
      children: textSnippet('Hello'),
    });
    const element = container.querySelector('p');
    expect(element).not.toBeNull();
  });

  test('default variant sets data-cinder-variant="body1"', () => {
    const { container } = render(Typography, {
      children: textSnippet('Hello'),
    });
    const element = container.querySelector('[data-cinder-variant]');
    expect(element?.getAttribute('data-cinder-variant')).toBe('body1');
  });

  test('applies cinder-typography class', () => {
    const { container } = render(Typography, {
      children: textSnippet('Hello'),
    });
    expect(container.querySelector('.cinder-typography')).not.toBeNull();
  });

  test('renders children content', () => {
    const { container } = render(Typography, {
      children: textSnippet('The quick brown fox'),
    });
    expect(container.querySelector('.cinder-typography')?.textContent).toContain(
      'The quick brown fox',
    );
  });
});

describe('Typography heading variants', () => {
  const headingVariants = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

  for (const variant of headingVariants) {
    test(`variant="${variant}" renders <${variant}> element`, () => {
      const { container } = render(Typography, {
        variant,
        children: textSnippet(variant),
      });
      const element = container.querySelector(variant);
      expect(element).not.toBeNull();
    });

    test(`variant="${variant}" sets data-cinder-variant="${variant}"`, () => {
      const { container } = render(Typography, {
        variant,
        children: textSnippet(variant),
      });
      const element = container.querySelector(variant);
      expect(element?.getAttribute('data-cinder-variant')).toBe(variant);
    });
  }
});

describe('Typography subtitle variants', () => {
  // Subtitles are a visual role, not a heading — they default to <p> so they don't
  // inject orphaned headings into the document outline.
  test('variant="subtitle1" renders <p> element (not a heading)', () => {
    const { container } = render(Typography, {
      variant: 'subtitle1',
      children: textSnippet('Subtitle'),
    });
    expect(container.querySelector('p')).not.toBeNull();
    expect(container.querySelector('h6')).toBeNull();
  });

  test('variant="subtitle1" sets data-cinder-variant="subtitle1"', () => {
    const { container } = render(Typography, {
      variant: 'subtitle1',
      children: textSnippet('Subtitle'),
    });
    expect(container.querySelector('p')?.getAttribute('data-cinder-variant')).toBe('subtitle1');
  });

  test('variant="subtitle2" renders <p> element (not a heading)', () => {
    const { container } = render(Typography, {
      variant: 'subtitle2',
      children: textSnippet('Subtitle 2'),
    });
    expect(container.querySelector('p')).not.toBeNull();
    expect(container.querySelector('h6')).toBeNull();
  });

  test('variant="subtitle2" sets data-cinder-variant="subtitle2"', () => {
    const { container } = render(Typography, {
      variant: 'subtitle2',
      children: textSnippet('Subtitle 2'),
    });
    expect(container.querySelector('p')?.getAttribute('data-cinder-variant')).toBe('subtitle2');
  });

  test('subtitle can opt into a heading element via the component override', () => {
    const { container } = render(Typography, {
      variant: 'subtitle1',
      component: 'h6',
      children: textSnippet('Real sub-heading'),
    });
    expect(container.querySelector('h6')?.getAttribute('data-cinder-variant')).toBe('subtitle1');
  });
});

describe('Typography body variants', () => {
  test('variant="body1" renders <p> element', () => {
    const { container } = render(Typography, {
      variant: 'body1',
      children: textSnippet('Body'),
    });
    expect(container.querySelector('p')).not.toBeNull();
  });

  test('variant="body2" renders <p> element', () => {
    const { container } = render(Typography, {
      variant: 'body2',
      children: textSnippet('Body 2'),
    });
    expect(container.querySelector('p')).not.toBeNull();
  });

  test('variant="body2" sets data-cinder-variant="body2"', () => {
    const { container } = render(Typography, {
      variant: 'body2',
      children: textSnippet('Body 2'),
    });
    expect(container.querySelector('p')?.getAttribute('data-cinder-variant')).toBe('body2');
  });
});

describe('Typography inline variants', () => {
  test('variant="caption" renders <span> element', () => {
    const { container } = render(Typography, {
      variant: 'caption',
      children: textSnippet('Caption text'),
    });
    expect(container.querySelector('span')).not.toBeNull();
  });

  test('variant="caption" sets data-cinder-variant="caption"', () => {
    const { container } = render(Typography, {
      variant: 'caption',
      children: textSnippet('Caption text'),
    });
    expect(container.querySelector('span')?.getAttribute('data-cinder-variant')).toBe('caption');
  });

  test('variant="overline" renders <span> element', () => {
    const { container } = render(Typography, {
      variant: 'overline',
      children: textSnippet('CATEGORY'),
    });
    expect(container.querySelector('span')).not.toBeNull();
  });

  test('variant="overline" sets data-cinder-variant="overline"', () => {
    const { container } = render(Typography, {
      variant: 'overline',
      children: textSnippet('CATEGORY'),
    });
    expect(container.querySelector('span')?.getAttribute('data-cinder-variant')).toBe('overline');
  });

  test('variant="label" renders <span> element', () => {
    const { container } = render(Typography, {
      variant: 'label',
      children: textSnippet('Field label'),
    });
    expect(container.querySelector('span')).not.toBeNull();
  });

  test('variant="label" sets data-cinder-variant="label"', () => {
    const { container } = render(Typography, {
      variant: 'label',
      children: textSnippet('Field label'),
    });
    expect(container.querySelector('span')?.getAttribute('data-cinder-variant')).toBe('label');
  });
});

describe('Typography component override', () => {
  test('component="span" with variant="h1" renders <span> element', () => {
    const { container } = render(Typography, {
      variant: 'h1',
      component: 'span',
      children: textSnippet('Hero heading'),
    });
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    expect(container.querySelector('h1')).toBeNull();
  });

  test('component override preserves data-cinder-variant from the variant prop', () => {
    const { container } = render(Typography, {
      variant: 'h1',
      component: 'span',
      children: textSnippet('Hero heading'),
    });
    const span = container.querySelector('span');
    expect(span?.getAttribute('data-cinder-variant')).toBe('h1');
  });

  test('component="div" with variant="body1" renders <div> element', () => {
    const { container } = render(Typography, {
      variant: 'body1',
      component: 'div',
      children: textSnippet('Content'),
    });
    expect(container.querySelector('div')).not.toBeNull();
    expect(container.querySelector('p')).toBeNull();
  });
});

describe('Typography gutterBottom', () => {
  test('gutterBottom=true adds data-cinder-gutter attribute', () => {
    const { container } = render(Typography, {
      variant: 'h2',
      gutterBottom: true,
      children: textSnippet('Section title'),
    });
    expect(container.querySelector('[data-cinder-gutter]')).not.toBeNull();
  });

  test('gutterBottom=false omits data-cinder-gutter attribute', () => {
    const { container } = render(Typography, {
      variant: 'h2',
      gutterBottom: false,
      children: textSnippet('Section title'),
    });
    expect(container.querySelector('[data-cinder-gutter]')).toBeNull();
  });

  test('gutterBottom defaults to false (no data-cinder-gutter)', () => {
    const { container } = render(Typography, {
      children: textSnippet('No gutter'),
    });
    expect(container.querySelector('[data-cinder-gutter]')).toBeNull();
  });
});

describe('Typography noWrap', () => {
  test('noWrap=true adds data-cinder-nowrap attribute', () => {
    const { container } = render(Typography, {
      noWrap: true,
      children: textSnippet('Truncated text'),
    });
    expect(container.querySelector('[data-cinder-nowrap]')).not.toBeNull();
  });

  test('noWrap=false omits data-cinder-nowrap attribute', () => {
    const { container } = render(Typography, {
      noWrap: false,
      children: textSnippet('Normal text'),
    });
    expect(container.querySelector('[data-cinder-nowrap]')).toBeNull();
  });

  test('noWrap defaults to false (no data-cinder-nowrap)', () => {
    const { container } = render(Typography, {
      children: textSnippet('Normal text'),
    });
    expect(container.querySelector('[data-cinder-nowrap]')).toBeNull();
  });
});

describe('Typography class merging and native attribute forwarding', () => {
  test('custom class is merged with cinder-typography', () => {
    const { container } = render(Typography, {
      class: 'page-title',
      children: textSnippet('Title'),
    });
    const element = container.querySelector('.cinder-typography');
    expect(element).not.toBeNull();
    expect(element?.classList.contains('page-title')).toBe(true);
  });

  test('native id attribute is forwarded to the root element', () => {
    const { container } = render(Typography, {
      id: 'section-heading',
      children: textSnippet('Heading'),
    });
    expect(container.querySelector('#section-heading')).not.toBeNull();
  });

  test('native data-* attributes are forwarded to the root element', () => {
    const { container } = render(Typography, {
      'data-testid': 'typography-root',
      children: textSnippet('Content'),
    });
    expect(container.querySelector('[data-testid="typography-root"]')).not.toBeNull();
  });
});

describe('Typography robustness', () => {
  test('an unknown variant (untyped consumer) falls back to a styled body1 <p>', () => {
    // TypeScript prevents this, but a JS consumer could pass an unknown variant.
    // The unknown variant normalizes to body1 for BOTH the element and the
    // data-cinder-variant hook, so the fallback is a *styled* <p>, not an unstyled one.
    const { container } = render(Typography, {
      variant: 'nonsense' as never,
      children: textSnippet('Still renders'),
    });
    const element = container.querySelector('.cinder-typography');
    expect(element).not.toBeNull();
    expect(element?.tagName.toLowerCase()).toBe('p');
    expect(element?.getAttribute('data-cinder-variant')).toBe('body1');
    expect(element?.textContent).toContain('Still renders');
  });
});
