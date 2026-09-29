/**
 * Component tests for `<ScopePanel>` (plan §9.7 T7.4). Covers the
 * granted/not-granted split driven by the principal store.
 */
import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { createQueryClient } from '../../lib/query.ts';
import type { AuthorizationScope } from '../../lib/scopes.svelte.ts';
import ScopePanel from './scope-panel.svelte';
import SystemRouteTestHarness from './system-route-test-harness.test-harness.svelte';
import { realClient } from './system-test-support.test-support.ts';

async function renderScopePanel(principalScopes: readonly AuthorizationScope[]) {
  return render(SystemRouteTestHarness, {
    props: {
      client: realClient(),
      queryClient: createQueryClient(),
      component: ScopePanel,
      principalScopes,
    },
  });
}

describe('ScopePanel', () => {
  test('lists a scope as granted with its description and unlocks copy', async () => {
    const { findByText } = await renderScopePanel(['system:read']);
    expect(await findByText('system:read')).not.toBeNull();
    expect(await findByText(/registry, metrics/)).not.toBeNull();
  });

  test('lists every other scope under Not granted', async () => {
    const { findAllByText } = await renderScopePanel(['system:read']);
    const workflowsRead = await findAllByText('workflows:read');
    expect(workflowsRead.length).toBe(1);
  });

  test('a scope granted to the principal never appears in the denied styling', async () => {
    const { container } = await renderScopePanel(['system:read']);
    const deniedList = container.querySelector('.weft-scope-panel__list--denied');
    const deniedScopes = Array.from(
      deniedList?.querySelectorAll('.weft-scope-panel__badge') ?? [],
    ).map((el) => el.textContent?.trim());
    expect(deniedScopes).not.toContain('system:read');
    expect(deniedScopes).toContain('workflows:read');
  });
});
