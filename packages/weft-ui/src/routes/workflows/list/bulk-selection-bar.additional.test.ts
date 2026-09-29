import { requireElement } from '../../../../tests/dom-test-support.ts';

import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { WorkflowListQuery } from '../../../lib/filters.ts';
import type { ScopeGate } from '../../../lib/scopes.svelte.ts';
import BulkSelectionBar from './bulk-selection-bar.svelte';
import { realClient, ScriptedFetch } from './workflow-test-support.test-support.ts';

const GRANTED: ScopeGate = { disabled: false, title: undefined };

function baseProps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    client: realClient(),
    filter: { status: 'failed' } as WorkflowListQuery,
    selectedCount: 3,
    totalMatchingFilter: 47,
    onDeselect: () => {},
    adminGate: GRANTED,
    onActionComplete: () => {},
    ...overrides,
  };
}

describe('additional coverage', () => {
  test('clicking Purge (once enabled) opens the purge dialog using the already-known total, no dry run', async () => {
    const { getByRole, getAllByRole, getByText } = render(BulkSelectionBar, {
      props: baseProps(),
    });

    await fireEvent.click(getByRole('checkbox', { name: /Select all 47 matching the filter/ }));
    const purgeButton = requireElement(
      getAllByRole('button').find((button) => button.textContent?.trim() === 'Purge'),
      HTMLButtonElement,
    );
    await fireEvent.click(purgeButton);

    await waitFor(() => {
      expect(getByText('47 terminal workflows')).not.toBeNull();
    });
  });

  test('a completed purge calls onActionComplete — the wiring behind "selection clears after a real commit"', async () => {
    // Regression coverage for the onSuccess/onClose split
    // (`bulk-action-dialog.svelte`/`bulk-purge-dialog.svelte`'s module
    // docs): caught via manual dev-harness verification that the bar's
    // "N selected" banner stayed stale after a successful purge because
    // `onActionComplete` was only wired to dialog dismissal, not to the
    // commit actually succeeding.
    const fetch = new ScriptedFetch();
    fetch.routeJsonRpcMethod('weft.workflows.purge', { deleted: 47 });

    try {
      let completed = 0;
      const { getByRole, getAllByRole, getByText, getByLabelText } = render(BulkSelectionBar, {
        props: baseProps({
          client: realClient(),
          onActionComplete: () => {
            completed += 1;
          },
        }),
      });

      await fireEvent.click(getByRole('checkbox', { name: /Select all 47 matching the filter/ }));
      const purgeButton = requireElement(
        getAllByRole('button').find((button) => button.textContent?.trim() === 'Purge'),
        HTMLButtonElement,
      );
      await fireEvent.click(purgeButton);

      await waitFor(() => {
        expect(getByLabelText('Type "purge 47 workflows" to confirm')).not.toBeNull();
      });
      expect(completed).toBe(0);

      await fireEvent.input(getByLabelText('Type "purge 47 workflows" to confirm'), {
        target: { value: 'purge 47 workflows' },
      });
      await fireEvent.click(getByRole('button', { name: 'Purge 47 workflows' }));

      await waitFor(() => {
        expect(getByText('Purged 47 workflows')).not.toBeNull();
      });
      expect(completed).toBe(1);
    } finally {
      fetch.restore();
    }
  });

  test('clicking Signal opens the params form, and invalid JSON blocks continuing to the preview', async () => {
    const { getByRole, getAllByRole, getByLabelText, getByText } = render(BulkSelectionBar, {
      props: baseProps({ client: realClient() }),
    });

    await fireEvent.click(getByRole('checkbox', { name: /Select all 47 matching the filter/ }));
    const signalButton = requireElement(
      getAllByRole('button').find((button) => button.textContent?.trim() === 'Signal'),
      HTMLButtonElement,
    );
    await fireEvent.click(signalButton);

    expect(getByLabelText('Signal name')).not.toBeNull();

    await fireEvent.input(getByLabelText('Signal name'), { target: { value: 'restart' } });
    await fireEvent.input(getByLabelText('Payload'), { target: { value: '{not json' } });

    expect(getByText(/Payload must be valid JSON/)).not.toBeNull();
  });

  test('a valid Signal params form runs the dry run with the signal name and parsed payload', async () => {
    const fetch = new ScriptedFetch();
    fetch.routeJsonRpcMethod('weft.workflows.bulk.signal', {
      dryRun: true,
      action: 'signal',
      matched: 2,
      requestId: 'bulk:req-signal',
      scope: {
        matched: 2,
        filter: { status: 'failed' },
        statuses: ['failed'],
        workflowTypes: [],
        sampleWorkflowIds: [],
        sampleLimit: 20,
      },
      sampleWorkflowIds: [],
      confirmationToken: 'bulk:token-signal',
      confirmationTokenVersion: 1,
    });

    try {
      const { getByRole, getAllByRole, getByLabelText, getByText } = render(BulkSelectionBar, {
        props: baseProps({ client: realClient() }),
      });

      await fireEvent.click(getByRole('checkbox', { name: /Select all 47 matching the filter/ }));
      const signalButton = requireElement(
        getAllByRole('button').find((button) => button.textContent?.trim() === 'Signal'),
        HTMLButtonElement,
      );
      await fireEvent.click(signalButton);

      await fireEvent.input(getByLabelText('Signal name'), { target: { value: 'restart' } });
      await fireEvent.input(getByLabelText('Payload'), { target: { value: '{"force":true}' } });
      await fireEvent.click(getByRole('button', { name: 'Continue' }));

      await waitFor(() => {
        expect(getByText('2 matching workflows')).not.toBeNull();
      });
    } finally {
      fetch.restore();
    }
  });

  test('clicking Mutate tags opens the tags params form with an Add/Remove operation select', async () => {
    const { getByRole, getAllByRole, getByLabelText } = render(BulkSelectionBar, {
      props: baseProps({ client: realClient() }),
    });

    await fireEvent.click(getByRole('checkbox', { name: /Select all 47 matching the filter/ }));
    const tagsButton = requireElement(
      getAllByRole('button').find((button) => button.textContent?.trim() === 'Mutate tags'),
      HTMLButtonElement,
    );
    await fireEvent.click(tagsButton);

    expect(getByLabelText('Operation')).not.toBeNull();
    expect(getByLabelText('Tags (comma-separated)')).not.toBeNull();
  });

  test('clicking Retry failed (once enabled) opens the retry dialog and fires its dry run', async () => {
    const fetch = new ScriptedFetch();
    fetch.routeJsonRpcMethod('weft.workflows.bulk.retryfailed', {
      dryRun: true,
      action: 'retryfailed',
      matched: 4,
      requestId: 'bulk:req-retry',
      scope: {
        matched: 4,
        filter: { status: 'failed' },
        statuses: ['failed'],
        workflowTypes: [],
        sampleWorkflowIds: [],
        sampleLimit: 20,
      },
      sampleWorkflowIds: [],
      confirmationToken: 'bulk:token-retry',
      confirmationTokenVersion: 1,
    });

    try {
      const { getByRole, getAllByRole, getByText } = render(BulkSelectionBar, {
        props: baseProps({ client: realClient() }),
      });

      await fireEvent.click(getByRole('checkbox', { name: /Select all 47 matching the filter/ }));
      const retryButton = requireElement(
        getAllByRole('button').find((button) => button.textContent?.trim() === 'Retry failed'),
        HTMLButtonElement,
      );
      await fireEvent.click(retryButton);

      await waitFor(() => {
        expect(getByText('4 matching workflows')).not.toBeNull();
      });
      // The retry-failed dialog passes a previewNote that discloses BOTH retry
      // paths (WFT-117; Codex review, PR #978): checkpoint-backed retries keep
      // the persisted revision, checkpoint-less retries fall back to
      // start-new and resolve whichever revision is active right now — never
      // an unconditional "always retains" promise.
      expect(getByText(/resumes in place on its own persisted revision/)).not.toBeNull();
      expect(getByText(/restarts fresh and resolves whichever revision is active/)).not.toBeNull();
      // Same eager-registration/dynamic-source caveat as every other
      // fresh-start surface (Codex review, PR #978) — a checkpoint-less
      // retry enters the identical start path as a wizard start or a
      // start-new replacement.
      expect(
        getByText(/a fresh start can run without consulting the active pointer at all/),
      ).not.toBeNull();
      // A checkpoint-backed retry of a pre-revision-pinning run has no
      // persisted revision to resume against either (Codex review, PR
      // #978, round 6) — the first sentence is qualified, not unconditional.
      expect(getByText(/when one exists/)).not.toBeNull();
      expect(getByText(/falls back to the same active-revision resolution/)).not.toBeNull();
    } finally {
      fetch.restore();
    }
  });

  test('clicking Delete (once enabled) opens the delete dialog and fires its dry run', async () => {
    const fetch = new ScriptedFetch();
    fetch.routeJsonRpcMethod('weft.workflows.bulk.delete', {
      dryRun: true,
      action: 'delete',
      matched: 6,
      requestId: 'bulk:req-delete',
      scope: {
        matched: 6,
        filter: { status: 'failed' },
        statuses: ['failed'],
        workflowTypes: [],
        sampleWorkflowIds: [],
        sampleLimit: 20,
      },
      sampleWorkflowIds: [],
      confirmationToken: 'bulk:token-delete',
      confirmationTokenVersion: 1,
    });

    try {
      const { getByRole, getAllByRole, getByText } = render(BulkSelectionBar, {
        props: baseProps({ client: realClient() }),
      });

      await fireEvent.click(getByRole('checkbox', { name: /Select all 47 matching the filter/ }));
      const deleteButton = requireElement(
        getAllByRole('button').find((button) => button.textContent?.trim() === 'Delete'),
        HTMLButtonElement,
      );
      await fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(getByText('6 matching workflows')).not.toBeNull();
      });
    } finally {
      fetch.restore();
    }
  });
});
