/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: AspectRatio } = await import('./aspect-ratio.svelte');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('AspectRatio', () => {
  test('renders a <div> by default with the aspect-ratio class', () => {
    const { container } = render(AspectRatio, { children: textSnippet('body') });
    const root = container.querySelector('div.cinder-aspect-ratio');

    expect(root).not.toBeNull();
    expect(root?.textContent).toContain('body');
  });

  test('honors the `as` prop for the rendered element', () => {
    const { container } = render(AspectRatio, {
      as: 'section',
      children: textSnippet('body'),
    });

    expect(container.querySelector('section.cinder-aspect-ratio')).not.toBeNull();
    expect(container.querySelector('div.cinder-aspect-ratio')).toBeNull();
  });

  test('defaults to a 16/9 aspect ratio', () => {
    const { container } = render(AspectRatio, { children: textSnippet('body') });
    const root = container.querySelector<HTMLElement>('.cinder-aspect-ratio');

    expect(root?.style.getPropertyValue('aspect-ratio')).toBe('16 / 9');
  });

  test('passes string ratio values through to the native CSS property', () => {
    const { container } = render(AspectRatio, {
      ratio: '1 / 1',
      children: textSnippet('body'),
    });
    const root = container.querySelector<HTMLElement>('.cinder-aspect-ratio');

    expect(root?.style.getPropertyValue('aspect-ratio')).toBe('1 / 1');
  });

  test('serializes positive finite numeric ratios', () => {
    const value = 4 / 3;
    const { container } = render(AspectRatio, {
      ratio: value,
      children: textSnippet('body'),
    });
    const root = container.querySelector<HTMLElement>('.cinder-aspect-ratio');

    expect(root?.style.getPropertyValue('aspect-ratio')).toBe(`${String(value)} / 1`);
  });

  test('falls back to the CSS default for non-finite numeric ratios', () => {
    const { container } = render(AspectRatio, {
      ratio: Number.NaN,
      children: textSnippet('body'),
    });
    const root = container.querySelector<HTMLElement>('.cinder-aspect-ratio');

    expect(root?.style.getPropertyValue('aspect-ratio')).toBe('');
  });

  test('falls back to the CSS default for non-positive numeric ratios', () => {
    const { container } = render(AspectRatio, {
      ratio: 0,
      children: textSnippet('body'),
    });
    const root = container.querySelector<HTMLElement>('.cinder-aspect-ratio');

    expect(root?.style.getPropertyValue('aspect-ratio')).toBe('');
  });

  test('defaults overflow to hidden via the component-owned data attribute', () => {
    const { container } = render(AspectRatio, { children: textSnippet('body') });
    const root = container.querySelector('.cinder-aspect-ratio');

    expect(root?.getAttribute('data-cinder-overflow')).toBe('hidden');
  });

  test('reflects visible overflow on the data attribute', () => {
    const { container } = render(AspectRatio, {
      overflow: 'visible',
      children: textSnippet('body'),
    });
    const root = container.querySelector('.cinder-aspect-ratio');

    expect(root?.getAttribute('data-cinder-overflow')).toBe('visible');
  });

  test('merges a consumer-provided class with cinder-aspect-ratio', () => {
    const { container } = render(AspectRatio, {
      class: 'extra-class',
      children: textSnippet('body'),
    });
    const root = container.querySelector('.cinder-aspect-ratio');

    expect(root?.classList.contains('cinder-aspect-ratio')).toBe(true);
    expect(root?.classList.contains('extra-class')).toBe(true);
  });

  test('forwards rest props onto the root element', () => {
    const { container } = render(AspectRatio, {
      'data-testid': 'aspect-ratio',
      children: textSnippet('body'),
    });
    const root = container.querySelector('.cinder-aspect-ratio');

    expect(root?.getAttribute('data-testid')).toBe('aspect-ratio');
  });
});

describe('AspectRatio attribute precedence', () => {
  test('consumer-supplied overflow data cannot override the component prop', () => {
    const { container } = render(AspectRatio, {
      overflow: 'visible',
      'data-cinder-overflow': 'hidden',
      children: textSnippet('body'),
    });

    expect(
      container.querySelector('.cinder-aspect-ratio')?.getAttribute('data-cinder-overflow'),
    ).toBe('visible');
  });
});

describe('AspectRatio source contracts', () => {
  test('type definition excludes the full HTML void-element set', async () => {
    const source = await Bun.file(new URL('./aspect-ratio.types.ts', import.meta.url)).text();

    for (const voidElement of [
      'area',
      'base',
      'br',
      'col',
      'embed',
      'hr',
      'img',
      'input',
      'link',
      'meta',
      'param',
      'source',
      'track',
      'wbr',
    ]) {
      expect(source).toContain(`'${voidElement}'`);
    }
  });

  test('implementation uses the native CSS property without legacy ratio hacks', async () => {
    const componentSource = await Bun.file(
      new URL('./aspect-ratio.svelte', import.meta.url),
    ).text();
    const cssSource = await Bun.file(new URL('./aspect-ratio.css', import.meta.url)).text();

    expect(componentSource).toContain('style:aspect-ratio={ratioValue}');
    expect(cssSource).toContain('aspect-ratio: 16/9;');

    for (const forbidden of [
      ['padding', '-bottom'].join(''),
      ['padding', '-block-end'].join(''),
      ['Resize', 'Observer'].join(''),
      ['getBounding', 'ClientRect'].join(''),
      ['client', 'Width'].join(''),
      ['client', 'Height'].join(''),
      ['offset', 'Width'].join(''),
      ['offset', 'Height'].join(''),
    ]) {
      expect(componentSource).not.toContain(forbidden);
      expect(cssSource).not.toContain(forbidden);
    }
  });
});
