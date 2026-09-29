/**
 * Component tests for `<AuthModeBanner>` (plan §6, §10, §13 T1.6).
 */
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import AuthModeBanner from './auth-mode-banner.svelte';

describe('AuthModeBanner', () => {
  test('renders nothing for "auth-required"', async () => {
    const { container } = render(AuthModeBanner, { props: { mode: 'auth-required' } });
    expect(container.querySelector('.weft-shell-auth-banner')).toBeNull();
  });

  test('renders nothing for "none" (a normally authenticated principal)', async () => {
    const { container } = render(AuthModeBanner, { props: { mode: 'none' } });
    expect(container.querySelector('.weft-shell-auth-banner')).toBeNull();
  });

  test('renders the warn copy and variant for "unauthenticated-warn"', async () => {
    const { container, getByText } = render(AuthModeBanner, {
      props: { mode: 'unauthenticated-warn' },
    });

    expect(getByText(/Running without authentication/)).not.toBeNull();
    expect(getByText(/scopes this session doesn't have/)).not.toBeNull();
    expect(container.querySelector('[data-variant="warn"]')).not.toBeNull();
  });

  test('renders the allow copy and variant for "unauthenticated-allow"', async () => {
    const { container, getByText } = render(AuthModeBanner, {
      props: { mode: 'unauthenticated-allow' },
    });

    expect(getByText(/by deployment choice/)).not.toBeNull();
    expect(container.querySelector('[data-variant="allow"]')).not.toBeNull();
  });

  test('dismiss button hides the banner', async () => {
    const { container, getByRole } = render(AuthModeBanner, {
      props: { mode: 'unauthenticated-warn' },
    });

    await fireEvent.click(getByRole('button', { name: 'Dismiss' }));

    expect(container.querySelector('.weft-shell-auth-banner')).toBeNull();
  });

  test('changing mode re-shows a previously dismissed banner', async () => {
    const { container, getByRole, rerender } = render(AuthModeBanner, {
      props: { mode: 'unauthenticated-warn' },
    });

    await fireEvent.click(getByRole('button', { name: 'Dismiss' }));
    expect(container.querySelector('.weft-shell-auth-banner')).toBeNull();

    await rerender({ mode: 'unauthenticated-allow' });

    expect(container.querySelector('.weft-shell-auth-banner')).not.toBeNull();
  });
});
