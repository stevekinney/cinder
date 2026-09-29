/**
 * Component tests for `<RealmsTab>` (COR-243): the empty "not in realm
 * mode" state and a populated realm-pool table.
 */
import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';

import { createQueryClient } from '../../lib/query.ts';
import RealmsTab from './realms-tab.svelte';
import SystemRouteTestHarness from './system-route-test-harness.test-harness.svelte';
import { realClient, ScriptedFetch } from './system-test-support.test-support.ts';

let scripted: ScriptedFetch | undefined;

afterEach(() => {
  scripted?.restore();
  scripted = undefined;
});

function renderRealmsTab() {
  return render(SystemRouteTestHarness, {
    props: { client: realClient(), queryClient: createQueryClient(), component: RealmsTab },
  });
}

describe('RealmsTab', () => {
  test('shows the not-in-realm-mode empty state for an empty pools array', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.realms.diagnostics', { pools: [] });

    const { findByText, unmount } = renderRealmsTab();
    expect(await findByText('No revision realms')).not.toBeNull();
    unmount();
  });

  test('renders a populated realm-pool table', async () => {
    scripted = new ScriptedFetch();
    scripted.routeJsonRpcMethod('weft.realms.diagnostics', {
      pools: [
        {
          name: 'checkout',
          revision: 'revision-a',
          revisionActive: true,
          realms: [
            {
              state: 'active',
              realmGeneration: 'gen-1',
              restartCount: 0,
              pendingTurnCount: 2,
            },
          ],
        },
        {
          name: 'checkout',
          revision: 'revision-b',
          revisionActive: false,
          realms: [],
        },
      ],
    });

    const { findAllByText, findByText, unmount } = renderRealmsTab();
    // Both pools share the workflow name "checkout" -- two rows, two matches.
    expect(await findAllByText('checkout')).toHaveLength(2);
    expect(await findByText('revision-a')).not.toBeNull();
    expect(await findByText('gen-1')).not.toBeNull();
    expect(await findByText('active')).not.toBeNull();
    expect(await findByText('No realm currently warmed')).not.toBeNull();
    // Numeric restart/pending-turn rendering is covered at the unit level by
    // `realms-view.test.ts`; the summary line's own "2 revision pool(s)" and
    // the table's "2" pending-turn-count cell are both literally "2", so
    // asserting on that digit here would be ambiguous rather than useful.
    unmount();
  });
});
