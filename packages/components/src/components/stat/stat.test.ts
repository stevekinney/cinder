/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: Stat } = await import('./stat.svelte');
const { createRawSnippet } = await import('svelte');

afterEach(() => cleanup());

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('Stat', () => {
  test('renders a .cinder-stat element with role="group"', () => {
    const { container } = render(Stat, { label: 'Revenue', value: '$1,000' });
    const el = container.querySelector('.cinder-stat');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('role')).toBe('group');
  });

  test('aria-labelledby references both label and value element ids', () => {
    const { container } = render(Stat, { label: 'Revenue', value: '$1,000' });
    const root = container.querySelector('.cinder-stat');
    const ariaLabelledby = root?.getAttribute('aria-labelledby') ?? '';
    const [labelId, valueId] = ariaLabelledby.split(' ');
    const labelEl = container.querySelector(`#${labelId}`);
    const valueEl = container.querySelector(`#${valueId}`);
    expect(labelEl?.textContent).toContain('Revenue');
    expect(valueEl?.textContent).toContain('$1,000');
  });

  test('renders the label and value text', () => {
    const { container } = render(Stat, { label: 'Monthly Revenue', value: '$42,000' });
    expect(container.querySelector('.cinder-stat__label')?.textContent).toBe('Monthly Revenue');
    expect(container.querySelector('.cinder-stat__value')?.textContent).toBe('$42,000');
  });

  test('numeric value is formatted via formatNumber', () => {
    const { container } = render(Stat, { label: 'Users', value: 1234567 });
    expect(container.querySelector('.cinder-stat__value')?.textContent).toBe('1,234,567');
  });

  test('string value is rendered verbatim', () => {
    const { container } = render(Stat, { label: 'ARR', value: '$1.2M' });
    expect(container.querySelector('.cinder-stat__value')?.textContent).toBe('$1.2M');
  });

  test('numeric value with valueFormatOptions renders correctly (percent style multiplies by 100)', () => {
    const { container } = render(Stat, {
      label: 'Conversion',
      value: 0.123,
      valueFormatOptions: { style: 'percent', maximumFractionDigits: 1 },
    });
    expect(container.querySelector('.cinder-stat__value')?.textContent).toBe('12.3%');
  });

  test('numeric value respects valueLocale', () => {
    const { container } = render(Stat, {
      label: 'Revenue',
      value: 1234.5,
      valueLocale: 'de-DE',
    });
    expect(container.querySelector('.cinder-stat__value')?.textContent).toBe('1.234,5');
  });

  test('change element is not rendered when change prop is omitted', () => {
    const { container } = render(Stat, { label: 'Revenue', value: '$1,000' });
    expect(container.querySelector('.cinder-stat__change')).toBeNull();
  });

  test('icon wrapper is not rendered when icon prop is omitted', () => {
    const { container } = render(Stat, { label: 'Revenue', value: '$1,000' });
    expect(container.querySelector('.cinder-stat__icon')).toBeNull();
  });

  test('change without ariaLabel or description synthesizes sr-only text for up direction', () => {
    const { container } = render(Stat, {
      label: 'Revenue',
      value: '$1,000',
      change: { direction: 'up', value: '4.75%' },
    });
    const srOnly = container.querySelector('.cinder-stat__change .cinder-sr-only');
    expect(srOnly?.textContent).toBe('increased by 4.75%');
  });

  test('change without ariaLabel or description synthesizes sr-only text for down direction', () => {
    const { container } = render(Stat, {
      label: 'Revenue',
      value: '$1,000',
      change: { direction: 'down', value: '12' },
    });
    const srOnly = container.querySelector('.cinder-stat__change .cinder-sr-only');
    expect(srOnly?.textContent).toBe('decreased by 12');
  });

  test('change without ariaLabel or description synthesizes sr-only text for neutral direction', () => {
    const { container } = render(Stat, {
      label: 'Revenue',
      value: '$1,000',
      change: { direction: 'neutral', value: '0' },
    });
    const srOnly = container.querySelector('.cinder-stat__change .cinder-sr-only');
    expect(srOnly?.textContent).toBe('no change, 0');
  });

  test.each([
    ['up', '↑'],
    ['down', '↓'],
    ['neutral', '→'],
  ] as const)('change direction %s renders the expected visible glyph', (direction, glyph) => {
    const { container } = render(Stat, {
      label: 'Revenue',
      value: '$1,000',
      change: { direction, value: '1%' },
    });
    expect(container.querySelector('.cinder-stat__change-icon')?.textContent).toBe(glyph);
  });

  test('change with description appends description to synthesized sr-only text', () => {
    const { container } = render(Stat, {
      label: 'Revenue',
      value: '$1,000',
      change: { direction: 'up', value: '4.75%', description: 'from last month' },
    });
    const srOnly = container.querySelector('.cinder-stat__change .cinder-sr-only');
    expect(srOnly?.textContent).toBe('increased by 4.75% from last month');
    const descEl = container.querySelector('.cinder-stat__change-description');
    expect(descEl?.textContent).toBe('from last month');
    expect(descEl?.getAttribute('aria-hidden')).toBe('true');
  });

  test('change.ariaLabel is used verbatim in the sr-only span', () => {
    const { container } = render(Stat, {
      label: 'Revenue',
      value: '$1,000',
      change: {
        direction: 'up',
        value: '4.75%',
        description: 'from last month',
        ariaLabel: 'Revenue increased significantly',
      },
    });
    const srOnly = container.querySelector('.cinder-stat__change .cinder-sr-only');
    expect(srOnly?.textContent).toBe('Revenue increased significantly');
    // Visible content still renders unchanged
    expect(container.querySelector('.cinder-stat__change-value')?.textContent).toBe('4.75%');
    expect(container.querySelector('.cinder-stat__change-description')?.textContent).toBe(
      'from last month',
    );
  });

  test('consumer role prop does not override component role="group"', () => {
    const { container } = render(Stat, {
      label: 'Revenue',
      value: '$1,000',
      role: 'presentation',
    });
    const root = container.querySelector('.cinder-stat');
    expect(root?.getAttribute('role')).toBe('group');
  });

  test('consumer aria-labelledby does not override component aria-labelledby', () => {
    const { container } = render(Stat, {
      label: 'Revenue',
      value: '$1,000',
      'aria-labelledby': 'custom-id',
    });
    const root = container.querySelector('.cinder-stat');
    const ariaLabelledby = root?.getAttribute('aria-labelledby') ?? '';
    expect(ariaLabelledby).not.toBe('custom-id');
    // Should still reference label and value spans
    const [labelId, valueId] = ariaLabelledby.split(' ');
    expect(container.querySelector(`#${labelId}`)).not.toBeNull();
    expect(container.querySelector(`#${valueId}`)).not.toBeNull();
  });

  test('data-cinder-direction on change element reflects change.direction', () => {
    const { container } = render(Stat, {
      label: 'Revenue',
      value: '$1,000',
      change: { direction: 'down', value: '5%' },
    });
    const changeEl = container.querySelector('.cinder-stat__change');
    expect(changeEl?.getAttribute('data-cinder-direction')).toBe('down');
  });

  test('glyph, visible value, and description spans inside change are aria-hidden', () => {
    const { container } = render(Stat, {
      label: 'Revenue',
      value: '$1,000',
      change: { direction: 'up', value: '10%', description: 'vs last quarter' },
    });
    expect(container.querySelector('.cinder-stat__change-icon')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(container.querySelector('.cinder-stat__change-value')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(
      container.querySelector('.cinder-stat__change-description')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  test('icon snippet renders inside .cinder-stat__icon with aria-hidden="true"', () => {
    const { container } = render(Stat, {
      label: 'Revenue',
      value: '$1,000',
      icon: textSnippet('$'),
    });
    const iconWrapper = container.querySelector('.cinder-stat__icon');
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper?.getAttribute('aria-hidden')).toBe('true');
    expect(iconWrapper?.textContent).toContain('$');
  });

  test('class prop is merged with cinder-stat on the root', () => {
    const { container } = render(Stat, {
      label: 'Revenue',
      value: '$1,000',
      class: 'my-custom-class',
    });
    const root = container.querySelector('.cinder-stat');
    expect(root?.getAttribute('class')).toContain('cinder-stat');
    expect(root?.getAttribute('class')).toContain('my-custom-class');
  });

  test('benign rest props are forwarded to the root element', () => {
    const { container } = render(Stat, {
      label: 'Revenue',
      value: '$1,000',
      'data-testid': 'revenue-stat',
    });
    const root = container.querySelector('.cinder-stat');
    expect(root?.getAttribute('data-testid')).toBe('revenue-stat');
  });

  test('explicit id prop sets the base for labelId and valueId', () => {
    const { container } = render(Stat, {
      id: 'my-revenue-stat',
      label: 'Revenue',
      value: '$1,000',
    });
    const root = container.querySelector('.cinder-stat');
    expect(root?.getAttribute('id')).toBe('my-revenue-stat');
    const ariaLabelledby = root?.getAttribute('aria-labelledby') ?? '';
    expect(ariaLabelledby).toBe('my-revenue-stat-label my-revenue-stat-value');
    expect(container.querySelector('#my-revenue-stat-label')?.textContent).toContain('Revenue');
    expect(container.querySelector('#my-revenue-stat-value')?.textContent).toContain('$1,000');
  });

  test('two Stat instances without an id prop get different auto-generated ids', () => {
    const { container: c1 } = render(Stat, { label: 'Revenue', value: '$1,000' });
    const { container: c2 } = render(Stat, { label: 'Revenue', value: '$2,000' });
    const id1 = c1.querySelector('.cinder-stat')?.getAttribute('aria-labelledby');
    const id2 = c2.querySelector('.cinder-stat')?.getAttribute('aria-labelledby');
    // useId() counter ensures each instance gets unique IDs even with the same label.
    expect(id1).not.toBe(id2);
  });
});
