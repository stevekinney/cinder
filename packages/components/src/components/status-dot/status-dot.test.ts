/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { within } = await import('@testing-library/dom');
const { default: StatusDot } = await import('./status-dot.svelte');

const ALL_STATUSES = [
  'online',
  'offline',
  'warning',
  'danger',
  'pending',
  'neutral',
  'success',
  'accent',
] as const;

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

  test('renders data-cinder-status="success" without throwing', () => {
    const { container } = render(StatusDot, { props: { status: 'success' } });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('data-cinder-status')).toBe(
      'success',
    );
  });

  test('renders data-cinder-status="accent" without throwing', () => {
    const { container } = render(StatusDot, { props: { status: 'accent' } });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('data-cinder-status')).toBe(
      'accent',
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

  test('omits the visible label when label is whitespace-only', () => {
    const { container } = render(StatusDot, { props: { status: 'online', label: '   ' } });
    expect(container.querySelector('.cinder-status-dot__label')).toBeNull();
  });
});

describe('StatusDot accessible name (WCAG 1.4.1)', () => {
  test('root has role="img" so the static indicator has a graphic semantic with a name', () => {
    const { container } = render(StatusDot, { props: { status: 'online' } });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('role')).toBe('img');
  });

  test('falls back to aria-label={status} when no label is provided', () => {
    const { container } = render(StatusDot, { props: { status: 'danger' } });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('aria-label')).toBe(
      'danger',
    );
  });

  test('uses label text as aria-label when showLabel is false but label is provided', () => {
    const { container } = render(StatusDot, {
      props: { status: 'danger', label: 'Database unavailable', showLabel: false },
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

  test('uses label text as aria-label when a visible label is rendered', () => {
    const { container } = render(StatusDot, {
      props: { status: 'online', label: 'Online' },
    });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('aria-label')).toBe(
      'Online',
    );
    expect(within(container).getByRole('img', { name: 'Online' })).not.toBeNull();
  });

  test('consumer-supplied aria-label overrides the automatic fallback', () => {
    const { container } = render(StatusDot, {
      props: { status: 'pending', 'aria-label': 'Deployment in progress' },
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

  test('empty-string aria-label from consumer does not blank the accessible name', () => {
    const { container } = render(StatusDot, {
      props: { status: 'danger', 'aria-label': '' },
    });
    // An empty override would hide the element from AT — treat it as "no
    // override" and fall through to the automatic status fallback instead.
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('aria-label')).toBe(
      'danger',
    );
  });

  test('whitespace-only aria-label from consumer does not blank the accessible name', () => {
    const { container } = render(StatusDot, {
      props: { status: 'danger', 'aria-label': '   ' },
    });
    expect(container.querySelector('.cinder-status-dot')?.getAttribute('aria-label')).toBe(
      'danger',
    );
  });

  test('live=true exposes status text through a hidden live label without connection preset text', () => {
    const { container } = render(StatusDot, {
      props: { status: 'pending', live: true },
    });
    const root = container.querySelector('.cinder-status-dot');

    expect(root?.getAttribute('role')).toBe('status');
    expect(root?.getAttribute('aria-label')).toBeNull();
    expect(root?.getAttribute('data-cinder-status')).toBe('pending');
    expect(root?.hasAttribute('data-cinder-state')).toBe(false);
    expect(container.querySelector('.cinder-status-dot__label')).toBeNull();
    expect(container.querySelector('.cinder-sr-only')?.textContent).toBe('pending');
  });
});

describe('StatusDot connection preset', () => {
  const states = [
    ['connected', 'online', 'Connected'],
    ['connecting', 'warning', 'Connecting'],
    ['disconnected', 'offline', 'Disconnected'],
    ['error', 'danger', 'Error'],
  ] as const;

  test.each(states)(
    'connectionState="%s" derives status, live role, and label',
    (state, status, label) => {
      const { container } = render(StatusDot, { props: { connectionState: state } });
      const root = container.querySelector('.cinder-status-dot');

      expect(root?.getAttribute('data-cinder-state')).toBe(state);
      expect(root?.getAttribute('data-cinder-status')).toBe(status);
      expect(root?.getAttribute('role')).toBe('status');
      expect(root?.getAttribute('aria-live')).toBe('polite');
      expect(root?.getAttribute('aria-atomic')).toBe('true');
      expect(root?.textContent).toContain(label);
    },
  );

  test('live=false keeps the static image semantics for a connection preset', () => {
    const { container } = render(StatusDot, {
      props: { connectionState: 'connected', live: false },
    });
    const root = container.querySelector('.cinder-status-dot');

    expect(root?.getAttribute('role')).toBe('img');
    expect(root?.getAttribute('aria-label')).toBe('Connected');
    expect(root?.hasAttribute('aria-live')).toBe(false);
  });

  test('showLabel=false keeps hidden text for the live-region connection preset', () => {
    const { container } = render(StatusDot, {
      props: { connectionState: 'connected', showLabel: false },
    });
    const root = container.querySelector('.cinder-status-dot');

    expect(root?.getAttribute('role')).toBe('status');
    expect(root?.getAttribute('aria-label')).toBeNull();
    expect(root?.textContent).toContain('Connected');
    expect(container.querySelector('.cinder-sr-only')?.textContent).toBe('Connected');
  });

  test('consumer aria-label is preserved as live-region text', () => {
    const { container } = render(StatusDot, {
      props: { connectionState: 'connected', 'aria-label': 'WebSocket connected' },
    });
    const root = container.querySelector('.cinder-status-dot');
    const visibleLabel = container.querySelector('.cinder-status-dot__label');

    expect(root?.getAttribute('role')).toBe('status');
    expect(root?.getAttribute('aria-label')).toBeNull();
    expect(visibleLabel?.textContent).toBe('Connected');
    expect(visibleLabel?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.cinder-sr-only')?.textContent).toBe('WebSocket connected');
  });
});

describe('StatusDot CSS contract', () => {
  test('connection presets tint the root text with their semantic state colors', async () => {
    const css = await Bun.file(new URL('./status-dot.css', import.meta.url)).text();
    expect(css).toContain("data-cinder-state='connected']");
    expect(css).toContain('color: var(--cinder-success)');
    expect(css).toContain("data-cinder-state='connecting']");
    expect(css).toContain('color: var(--cinder-warning)');
    expect(css).toContain("data-cinder-state='disconnected']");
    expect(css).toContain('color: var(--cinder-text-muted)');
    expect(css).toContain("data-cinder-state='error']");
    expect(css).toContain('color: var(--cinder-danger)');
  });

  test('neutral status uses --cinder-border-strong not --cinder-text-muted', async () => {
    const css = await Bun.file(new URL('./status-dot.css', import.meta.url)).text();
    expect(css).toContain("data-cinder-status='neutral']");
    expect(css).toContain('--cinder-status-dot-color: var(--cinder-border-strong)');
    // Ensure the neutral rule no longer points to text-muted (which offline also uses)
    const neutralBlock = css.match(/\[data-cinder-status='neutral'\]\s*\{[^}]*\}/)?.[0] ?? '';
    expect(neutralBlock).not.toContain('--cinder-text-muted');
  });
});
