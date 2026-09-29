/**
 * Shared fixtures for `<WorkflowRevisionsPanel>`'s component tests, split
 * across `workflow-revisions-panel.test.ts` (data mapping, permission
 * gating, and the loading/denied/malformed-response/empty/server-fault
 * states) and `workflow-revisions-panel-activation.test.ts` (the
 * Activate/Refresh mutation and its outcomes) once the combined file
 * crossed the repo's 500-line implementation-file cap.
 */
import { render } from '@testing-library/svelte';

import ToastHost from '../../app/toast-host.svelte';
import { createQueryClient } from '../../lib/query.ts';
import { AUTHORIZATION_SCOPES } from '../../lib/scopes.svelte.ts';
import SystemRouteTestHarness from './system-route-test-harness.test-harness.svelte';
import { realClient } from './system-test-support.test-support.ts';
import WorkflowRevisionsPanelFixture from './workflow-revisions-panel-fixture.test-harness.svelte';

export function revisionRecord(revision: string, overrides: Record<string, unknown> = {}) {
  return {
    manifest: {
      manifestVersion: 1,
      name: 'order-processing',
      workflowVersion: '0.0.0',
      revision,
      contractHash: `sha256:${revision}-hash`,
      contract: { name: 'order-processing', workflowVersion: '0.0.0' },
    },
    installedAt: 1_700_000_000_000,
    ...overrides,
  };
}

export function activePointer(revision: string, generation = 1) {
  return { revision, generation, activatedAt: 1_700_000_000_000 };
}

export async function renderPanel(
  principalScopes?: readonly (typeof AUTHORIZATION_SCOPES)[number][],
) {
  render(ToastHost);
  return render(SystemRouteTestHarness, {
    props: {
      client: realClient(),
      queryClient: createQueryClient(),
      component: WorkflowRevisionsPanelFixture,
      ...(principalScopes === undefined ? {} : { principalScopes }),
    },
  });
}
