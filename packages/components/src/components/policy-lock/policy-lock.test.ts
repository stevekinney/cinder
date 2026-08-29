import { expect, test } from 'bun:test';
import { setupHappyDom } from '../../test/happy-dom.ts';
setupHappyDom();
const { render } = await import('@testing-library/svelte');
const { default: PolicyLock } = await import('./policy-lock.svelte');
test('renders reason, source, scope badge, and tooltip association', () => {
  const { container } = render(PolicyLock, {
    props: {
      id: 'lock-reason',
      reason: 'Managed by policy',
      source: 'Workspace administrator',
      scope: 'workspace',
    },
  });
  expect(container.querySelector('#lock-reason')?.textContent).toContain('Managed by policy');
  expect(container.querySelector('#lock-reason-description')?.textContent).toContain(
    'Workspace administrator',
  );
  expect(container.textContent).toContain('workspace');
  expect(container.querySelector('[aria-describedby]')).not.toBeNull();
  expect(container.querySelector<HTMLButtonElement>('.cinder-policy-lock__explanation')?.type).toBe(
    'button',
  );
  expect(
    container.querySelector('.cinder-policy-lock__explanation')?.getAttribute('aria-label'),
  ).toBe('Policy details');
});

test('policy details button has a 44px hit-area pseudo-element', async () => {
  const css = await Bun.file(new URL('./policy-lock.css', import.meta.url)).text();
  expect(css).toMatch(
    /\.cinder-policy-lock__explanation::after\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s,
  );
});
