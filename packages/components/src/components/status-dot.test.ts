/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: StatusDot } = await import('./status-dot.svelte');

const ALL_STATUSES = ['online', 'offline', 'warning', 'error', 'building', 'neutral'] as const;

describe('StatusDot rendering', () => {
  test('renders the root with cinder-status-dot class', () => {
    const { container } = render(StatusDot, { props: { status: 'online' } });
    expect(container.querySelector('.cinder-status-dot')).not.toBeNull();
  });

  test('renders an aria-hidden indicator dot', () => {
    const { container } = render(StatusDot, { props: { status: 'online' } });
    const indicator = container.querySelector('.cinder-status-dot__indicator');
    expect(indicator).not.toBeNull();
    expect(indicator?.getAttribute('aria-hidden')).toBe('true');
  });

  test('applies custom class alongside cinder-status-dot', () => {
    const { container } = render(StatusDot, {
      props: { status: 'online', class: 'my-custom-class' },
    });
    const root = container.querySelector('.cinder-status-dot');
    expect(root?.classList.contains('cinder-status-dot')).toBe(true);
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });

  test('rest props are spread onto the root element', () => {
    const { container } = render(StatusDot, {
      props: { status: 'online', id: 'my-status' },
    });
    expect(container.querySelector('#my-status')).not.toBeNull();
  });

  test('defaults data-cinder-size to "md" when size is omitted', () => {
    const { container } = render(StatusDot, { props: { status: 'online' } });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('data-cinder-size')).toBe(
      'md',
    );
  });

  test.each(['sm', 'md'] as const)('applies data-cinder-size="%s"', (size) => {
    const { container } = render(StatusDot, { props: { status: 'online', size } });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('data-cinder-size')).toBe(
      size,
    );
  });
});

describe('StatusDot status attribute (color via CSS)', () => {
  test.each(ALL_STATUSES.map((status) => [status]))('renders data-cinder-status="%s"', (status) => {
    const { container } = render(StatusDot, { props: { status } });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('data-cinder-status')).toBe(
      status,
    );
  });

  test('does not apply inline color styles — color is driven by CSS only', () => {
    const { container } = render(StatusDot, { props: { status: 'online' } });
    const root = container.querySelector<HTMLElement>('.cinder-status-dot');
    const indicator = container.querySelector<HTMLElement>('.cinder-status-dot__indicator');
    expect(root?.getAttribute('style')).toBeNull();
    expect(indicator?.getAttribute('style')).toBeNull();
  });
});

describe('StatusDot label rendering', () => {
  test('renders the visible label when label is provided and showLabel defaults to true', () => {
    const { container } = render(StatusDot, {
      props: { status: 'online', label: 'Online' },
    });
    const label = container.querySelector('.cinder-status-dot__label');
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe('Online');
  });

  test('omits the visible label when showLabel is false', () => {
    const { container } = render(StatusDot, {
      props: { status: 'online', label: 'Online', showLabel: false },
    });
    expect(container.querySelector('.cinder-status-dot__label')).toBeNull();
  });

  test('omits the visible label when no label is provided', () => {
    const { container } = render(StatusDot, { props: { status: 'online' } });
    expect(container.querySelector('.cinder-status-dot__label')).toBeNull();
  });

  test('omits the visible label when label is an empty string', () => {
    const { container } = render(StatusDot, { props: { status: 'online', label: '' } });
    expect(container.querySelector('.cinder-status-dot__label')).toBeNull();
  });
});

describe('StatusDot accessible name (WCAG 1.4.1)', () => {
  test('root has role="status" so assistive tech exposes the accessible name', () => {
    const { container } = render(StatusDot, { props: { status: 'online' } });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('role')).toBe('status');
  });

  test('falls back to aria-label={status} when no label is provided', () => {
    const { container } = render(StatusDot, { props: { status: 'error' } });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('aria-label')).toBe('error');
  });

  test('falls back to aria-label={status} when label is undefined and showLabel defaults true', () => {
    const { container } = render(StatusDot, { props: { status: 'offline' } });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('aria-label')).toBe(
      'offline',
    );
  });

  test('uses label text as aria-label when showLabel is false but label is provided', () => {
    const { container } = render(StatusDot, {
      props: { status: 'error', label: 'Database unavailable', showLabel: false },
    });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('aria-label')).toBe(
      'Database unavailable',
    );
  });

  test('falls back to aria-label={status} when showLabel is false and label is empty', () => {
    const { container } = render(StatusDot, {
      props: { status: 'warning', label: '', showLabel: false },
    });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('aria-label')).toBe(
      'warning',
    );
  });

  test('omits aria-label when a visible label is rendered (label text is the accessible name)', () => {
    const { container } = render(StatusDot, {
      props: { status: 'online', label: 'Online' },
    });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('aria-label')).toBeNull();
  });

  test('consumer-supplied aria-label overrides the automatic fallback', () => {
    const { container } = render(StatusDot, {
      props: { status: 'building', 'aria-label': 'Deployment in progress' },
    });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('aria-label')).toBe(
      'Deployment in progress',
    );
  });

  test('consumer-supplied aria-label is preserved even when a visible label is rendered', () => {
    const { container } = render(StatusDot, {
      props: {
        status: 'online',
        label: 'Online',
        'aria-label': 'Server is currently online and accepting connections',
      },
    });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('aria-label')).toBe(
      'Server is currently online and accepting connections',
    );
  });
});
