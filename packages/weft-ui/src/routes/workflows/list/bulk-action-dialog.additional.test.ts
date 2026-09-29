import { requireElement } from '../../../../tests/dom-test-support.ts';

import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { BulkOperationDryRunResult } from '@lostgradient/weft';
import { HttpClientError } from '@lostgradient/weft';

import BulkActionDialog from './bulk-action-dialog.svelte';
import type { BulkCommitSummary } from './bulk-result-summary.ts';

function preview(overrides: Partial<BulkOperationDryRunResult> = {}): BulkOperationDryRunResult {
  return {
    dryRun: true,
    action: 'cancel',
    matched: 47,
    requestId: 'bulk:req-1',
    scope: {
      matched: 47,
      filter: { status: 'failed', type: 'payment-capture' },
      statuses: ['failed'],
      workflowTypes: ['payment-capture'],
      sampleWorkflowIds: ['wf-1', 'wf-2'],
      sampleLimit: 20,
    },
    sampleWorkflowIds: ['wf-1', 'wf-2'],
    confirmationToken: 'bulk:token-abc',
    confirmationTokenVersion: 1,
    ...overrides,
  };
}

describe('BulkActionDialog — type-to-confirm', () => {
  test('the confirm button stays disabled until the exact phrase is typed', async () => {
    const { getByRole, getByLabelText } = render(BulkActionDialog, {
      props: {
        title: 'Bulk cancel',
        verb: 'cancel',
        runDryRun: async () => preview(),
        runCommit: async () => ({ headline: 'Cancelled 47 of 47 workflows', errors: [] }),
        onClose: () => {},
      },
    });

    await waitFor(() => {
      expect(getByLabelText('Type "cancel 47 workflows" to confirm')).not.toBeNull();
    });

    const confirmButton = getByRole('button', { name: 'Cancel 47 workflows' });
    expect(requireElement(confirmButton, HTMLButtonElement).disabled).toBe(true);

    const input = getByLabelText('Type "cancel 47 workflows" to confirm');
    await fireEvent.input(input, { target: { value: 'cancel 4' } });
    expect(requireElement(confirmButton, HTMLButtonElement).disabled).toBe(true);

    await fireEvent.input(input, { target: { value: 'CANCEL 47 WORKFLOWS' } });
    expect(requireElement(confirmButton, HTMLButtonElement).disabled).toBe(false);
  });

  test('confirming calls runCommit with the dry run token and matched count, then shows the result', async () => {
    const received: { call: { token: string; matched: number } | null } = { call: null };

    const { getByRole, getByLabelText, getByText } = render(BulkActionDialog, {
      props: {
        title: 'Bulk cancel',
        verb: 'cancel',
        runDryRun: async () => preview(),
        runCommit: async (token: string, matched: number): Promise<BulkCommitSummary> => {
          received.call = { token, matched };
          return { headline: 'Cancelled 47 of 47 workflows', errors: [] };
        },
        onClose: () => {},
      },
    });

    await waitFor(() => {
      expect(getByLabelText('Type "cancel 47 workflows" to confirm')).not.toBeNull();
    });
    await fireEvent.input(getByLabelText('Type "cancel 47 workflows" to confirm'), {
      target: { value: 'cancel 47 workflows' },
    });
    await fireEvent.click(getByRole('button', { name: 'Cancel 47 workflows' }));

    await waitFor(() => {
      expect(getByText('Cancelled 47 of 47 workflows')).not.toBeNull();
    });
    expect(received.call).toEqual({ token: 'bulk:token-abc', matched: 47 });
  });
});

describe('BulkActionDialog — commit fault treatment', () => {
  test('a stale confirmation token (InvalidParams) offers "Refresh preview", not a generic retry', async () => {
    let dryRunCalls = 0;

    const { getByRole, getByLabelText, getByText } = render(BulkActionDialog, {
      props: {
        title: 'Bulk cancel',
        verb: 'cancel',
        runDryRun: async () => {
          dryRunCalls += 1;
          return preview();
        },
        runCommit: async () => {
          throw new HttpClientError(
            400,
            'Bulk confirmation token does not match the current dry-run scope',
            { faultCode: 'InvalidParams' },
          );
        },
        onClose: () => {},
      },
    });

    await waitFor(() => {
      expect(getByLabelText('Type "cancel 47 workflows" to confirm')).not.toBeNull();
    });
    await fireEvent.input(getByLabelText('Type "cancel 47 workflows" to confirm'), {
      target: { value: 'cancel 47 workflows' },
    });
    await fireEvent.click(getByRole('button', { name: 'Cancel 47 workflows' }));

    await waitFor(() => {
      expect(
        getByText('Bulk confirmation token does not match the current dry-run scope'),
      ).not.toBeNull();
      expect(getByText(/changed since the preview/)).not.toBeNull();
    });
    expect(dryRunCalls).toBe(1);

    await fireEvent.click(getByRole('button', { name: 'Refresh preview' }));

    await waitFor(() => {
      expect(dryRunCalls).toBe(2);
    });
  });

  test('a transient commit fault (not InvalidParams) offers a same-token Retry', async () => {
    let commitCalls = 0;

    const { getByRole, getByLabelText, getByText } = render(BulkActionDialog, {
      props: {
        title: 'Bulk cancel',
        verb: 'cancel',
        runDryRun: async () => preview(),
        runCommit: async () => {
          commitCalls += 1;
          if (commitCalls === 1) {
            throw new HttpClientError(500, 'Internal server error');
          }
          return { headline: 'Cancelled 47 of 47 workflows', errors: [] };
        },
        onClose: () => {},
      },
    });

    await waitFor(() => {
      expect(getByLabelText('Type "cancel 47 workflows" to confirm')).not.toBeNull();
    });
    await fireEvent.input(getByLabelText('Type "cancel 47 workflows" to confirm'), {
      target: { value: 'cancel 47 workflows' },
    });
    await fireEvent.click(getByRole('button', { name: 'Cancel 47 workflows' }));

    await waitFor(() => {
      expect(getByRole('button', { name: 'Retry' })).not.toBeNull();
    });

    await fireEvent.click(getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(getByText('Cancelled 47 of 47 workflows')).not.toBeNull();
    });
    expect(commitCalls).toBe(2);
  });
});

describe('BulkActionDialog — non-dismissible while committing', () => {
  test('onClose is not called while the commit is in flight', async () => {
    let closed = false;
    const pendingCommit: { resolve: (() => void) | null } = { resolve: null };

    const { getByRole, getByLabelText, getByText } = render(BulkActionDialog, {
      props: {
        title: 'Bulk cancel',
        verb: 'cancel',
        runDryRun: async () => preview(),
        runCommit: () =>
          new Promise<BulkCommitSummary>((resolve) => {
            pendingCommit.resolve = () =>
              resolve({ headline: 'Cancelled 47 of 47 workflows', errors: [] });
          }),
        onClose: () => {
          closed = true;
        },
      },
    });

    await waitFor(() => {
      expect(getByLabelText('Type "cancel 47 workflows" to confirm')).not.toBeNull();
    });
    await fireEvent.input(getByLabelText('Type "cancel 47 workflows" to confirm'), {
      target: { value: 'cancel 47 workflows' },
    });
    await fireEvent.click(getByRole('button', { name: 'Cancel 47 workflows' }));

    await waitFor(() => {
      expect(getByText(/keep this open/)).not.toBeNull();
    });
    expect(closed).toBe(false);

    pendingCommit.resolve?.();
    await waitFor(() => {
      expect(getByText('Cancelled 47 of 47 workflows')).not.toBeNull();
    });
  });
});

describe('BulkActionDialog — onSuccess vs onClose', () => {
  test('onSuccess fires exactly once, right when the commit succeeds — not on a plain dismiss', async () => {
    let successCount = 0;
    let closeCount = 0;

    const { getByRole, getByLabelText, getByText } = render(BulkActionDialog, {
      props: {
        title: 'Bulk cancel',
        verb: 'cancel',
        runDryRun: async () => preview(),
        runCommit: async () => ({ headline: 'Cancelled 47 of 47 workflows', errors: [] }),
        onClose: () => {
          closeCount += 1;
        },
        onSuccess: () => {
          successCount += 1;
        },
      },
    });

    await waitFor(() => {
      expect(getByLabelText('Type "cancel 47 workflows" to confirm')).not.toBeNull();
    });
    // Dismissing before confirming must not fire onSuccess — the caller
    // should not clear a selection nothing happened to.
    expect(successCount).toBe(0);

    await fireEvent.input(getByLabelText('Type "cancel 47 workflows" to confirm'), {
      target: { value: 'cancel 47 workflows' },
    });
    await fireEvent.click(getByRole('button', { name: 'Cancel 47 workflows' }));

    await waitFor(() => {
      expect(getByText('Cancelled 47 of 47 workflows')).not.toBeNull();
    });
    expect(successCount).toBe(1);
    // onSuccess fires independently of the dialog's own close — the result
    // phase's "Close" button hasn't been clicked yet.
    expect(closeCount).toBe(0);
  });

  test('a dismissed dialog (never committed) never fires onSuccess', async () => {
    let successCount = 0;
    let closeCount = 0;

    const { getByRole, getByLabelText } = render(BulkActionDialog, {
      props: {
        title: 'Bulk cancel',
        verb: 'cancel',
        runDryRun: async () => preview(),
        runCommit: async () => ({ headline: 'unused', errors: [] }),
        onClose: () => {
          closeCount += 1;
        },
        onSuccess: () => {
          successCount += 1;
        },
      },
    });

    await waitFor(() => {
      expect(getByLabelText('Type "cancel 47 workflows" to confirm')).not.toBeNull();
    });

    await fireEvent.click(getByRole('button', { name: 'Cancel' }));

    expect(closeCount).toBe(1);
    expect(successCount).toBe(0);
  });
});
