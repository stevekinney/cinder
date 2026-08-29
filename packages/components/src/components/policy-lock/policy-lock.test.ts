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
  expect(container.querySelector('#lock-reason')?.textContent).toContain('Workspace administrator');
  expect(container.textContent).toContain('workspace');
  expect(container.querySelector('[aria-describedby]')).not.toBeNull();
});
