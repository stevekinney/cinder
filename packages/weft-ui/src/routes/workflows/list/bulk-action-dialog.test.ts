import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { BulkOperationDryRunResult } from '@lostgradient/weft';
import { HttpClientError } from '@lostgradient/weft';

import BulkActionDialog from './bulk-action-dialog.svelte';

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

describe('BulkActionDialog — dry-run preview', () => {
  test('shows the matched count and filter chip from the dry run, not a client estimate', async () => {
    const { getByText } = render(BulkActionDialog, {
      props: {
        title: 'Bulk cancel',
        verb: 'cancel',
        runDryRun: async () => preview(),
        runCommit: async () => ({ headline: 'Cancelled 47 of 47 workflows', errors: [] }),
        onClose: () => {},
      },
    });

    await waitFor(() => {
      expect(getByText(/Operates on all/)).not.toBeNull();
      expect(getByText('47 matching workflows')).not.toBeNull();
    });
    expect(getByText('status:failed · type:payment-capture')).not.toBeNull();
  });

  test('renders previewNote in the preview phase when supplied (WFT-117)', async () => {
    const { getByText } = render(BulkActionDialog, {
      props: {
        title: 'Bulk retry failed',
        verb: 'retry',
        runDryRun: async () => preview(),
        runCommit: async () => ({ headline: 'Retried 47 of 47 workflows', errors: [] }),
        onClose: () => {},
        previewNote: 'Each retried run keeps its own persisted revision.',
      },
    });

    await waitFor(() => {
      expect(getByText('Each retried run keeps its own persisted revision.')).not.toBeNull();
    });
  });

  test('renders no previewNote paragraph when omitted — no regression for cancel/signal/delete/tags callers', async () => {
    const { getByText, queryByText } = render(BulkActionDialog, {
      props: {
        title: 'Bulk cancel',
        verb: 'cancel',
        runDryRun: async () => preview(),
        runCommit: async () => ({ headline: 'Cancelled 47 of 47 workflows', errors: [] }),
        onClose: () => {},
      },
    });

    // Wait for the preview phase, where a supplied previewNote would render,
    // so the absence assertion is not satisfied by the loading phase alone.
    await waitFor(() => {
      expect(getByText('47 matching workflows')).not.toBeNull();
    });
    expect(queryByText(/persisted revision/)?.outerHTML ?? null).toBeNull();
  });

  test('0 matched disables the confirm affordance and offers no type-to-confirm field', async () => {
    const { getByText, queryByLabelText, queryByRole } = render(BulkActionDialog, {
      props: {
        title: 'Bulk cancel',
        verb: 'cancel',
        runDryRun: async () => preview({ matched: 0 }),
        runCommit: async () => ({ headline: 'Cancelled 0 of 0 workflows', errors: [] }),
        onClose: () => {},
      },
    });

    await waitFor(() => {
      expect(getByText(/nothing to do/i)).not.toBeNull();
    });
    expect(queryByLabelText(/Type "cancel/)).toBeNull();
    expect(queryByRole('button', { name: /^Cancel 0 workflows$/ })).toBeNull();
  });

  test('a failed dry run shows the fault treatment', async () => {
    const { getByText } = render(BulkActionDialog, {
      props: {
        title: 'Bulk cancel',
        verb: 'cancel',
        runDryRun: async () => {
          throw new HttpClientError(403, 'Requires workflows:admin', { faultCode: 'Forbidden' });
        },
        runCommit: async () => ({ headline: '', errors: [] }),
        onClose: () => {},
      },
    });

    await waitFor(() => {
      expect(getByText('Requires workflows:admin')).not.toBeNull();
    });
  });

  test('Retry after a FAILED dry run re-runs the dry run, not the (nonexistent) commit', async () => {
    // Regression test: `retryFromFault()` used to route every retry through
    // `commit()`, which no-ops when `preview` is still `null` (exactly the
    // case for a dry-run failure — there is nothing to commit yet). Caught
    // via manual dev-harness verification: clicking "Retry" after a failed
    // initial preview silently did nothing. See `faultOrigin` in the
    // component.
    let dryRunCalls = 0;
    let commitCalls = 0;

    const { getByRole, getByText, getByLabelText } = render(BulkActionDialog, {
      props: {
        title: 'Bulk cancel',
        verb: 'cancel',
        runDryRun: async () => {
          dryRunCalls += 1;
          if (dryRunCalls === 1) {
            throw new HttpClientError(401, 'authentication required', {
              faultCode: 'Unauthorized',
            });
          }
          return preview();
        },
        runCommit: async () => {
          commitCalls += 1;
          return { headline: 'Cancelled 47 of 47 workflows', errors: [] };
        },
        onClose: () => {},
      },
    });

    await waitFor(() => {
      expect(getByText('authentication required')).not.toBeNull();
    });
    expect(getByRole('button', { name: 'Retry' })).not.toBeNull();

    await fireEvent.click(getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(getByLabelText('Type "cancel 47 workflows" to confirm')).not.toBeNull();
    });
    expect(dryRunCalls).toBe(2);
    expect(commitCalls).toBe(0);
  });
});
