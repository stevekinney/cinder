import { expect, test } from 'bun:test';
import { setupHappyDom } from '../../test/happy-dom.ts';
import HostProvider from './host-provider.svelte';

setupHappyDom();

const { render } = await import('@testing-library/svelte');

test('defaults to inert web host values and publishes host-fed safe-header insets', () => {
  const { container } = render(HostProvider);
  const provider = container.querySelector<HTMLElement>('.cinder-host-provider');
  expect(provider?.dataset['cinderHostPlatform']).toBe('web');
  expect(provider?.style.getPropertyValue('--_cinder-safe-header-left')).toBe('0px');
  expect(provider?.style.getPropertyValue('--_cinder-safe-header-right')).toBe('0px');
});

test('accepts platform and titlebar insets from a desktop host', () => {
  const { container } = render(HostProvider, {
    platform: 'macos',
    safeHeaderLeft: '5rem',
    safeHeaderRight: '1rem',
  });
  const provider = container.querySelector<HTMLElement>('.cinder-host-provider');
  expect(provider?.dataset['cinderHostPlatform']).toBe('macos');
  expect(provider?.style.getPropertyValue('--_cinder-safe-header-left')).toBe('5rem');
  expect(provider?.style.getPropertyValue('--_cinder-safe-header-right')).toBe('1rem');
});
