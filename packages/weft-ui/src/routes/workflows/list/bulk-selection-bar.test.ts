import { requireElement } from '../../../../tests/dom-test-support.ts';

import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { WorkflowListQuery } from '../../../lib/filters.ts';
import type { ScopeGate } from '../../../lib/scopes.svelte.ts';
import BulkSelectionBar from './bulk-selection-bar.svelte';
import { realClient, ScriptedFetch } from './workflow-test-support.test-support.ts';

const GRANTED: ScopeGate = { disabled: false, title: undefined };
const DENIED: ScopeGate = { disabled: true, title: 'Requires workflows:admin' };

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

describe('BulkSelectionBar', () => {
  test('renders nothing when nothing is selected', async () => {
    const { container } = render(BulkSelectionBar, {
      props: baseProps({ selectedCount: 0 }),
    });

    expect(container.querySelector('.weft-bulk-bar')).toBeNull();
  });

  test('shows the selection count and the select-all-matching banner', async () => {
    const { getByText, getByRole } = render(BulkSelectionBar, { props: baseProps() });

    expect(getByText('3 selected')).not.toBeNull();
    expect(getByRole('checkbox', { name: /Select all 47 matching the filter/ })).not.toBeNull();
  });

  test('Deselect calls onDeselect', async () => {
    let deselected = false;
    const { getByRole } = render(BulkSelectionBar, {
      props: baseProps({
        onDeselect: () => {
          deselected = true;
        },
      }),
    });

    await fireEvent.click(getByRole('button', { name: 'Deselect' }));
    expect(deselected).toBe(true);
  });

  test('missing workflows:admin disables every action with the scope reason', async () => {
    const { getAllByRole } = render(BulkSelectionBar, {
      props: baseProps({ adminGate: DENIED }),
    });

    const buttons = getAllByRole('button')
      .filter((button) =>
        ['Cancel', 'Signal', 'Retry failed', 'Mutate tags', 'Delete', 'Purge'].includes(
          button.textContent?.trim() ?? '',
        ),
      )
      .map((button) => requireElement(button, HTMLButtonElement));
    expect(buttons.length).toBe(6);
    for (const button of buttons) expect(button.disabled).toBe(true);
  });

  test('scope granted but "select all matching" unchecked still disables every action', async () => {
    const { getAllByRole } = render(BulkSelectionBar, { props: baseProps() });

    const cancelButton = requireElement(
      getAllByRole('button').find((button) => button.textContent?.trim() === 'Cancel'),
      HTMLButtonElement,
    );
    expect(cancelButton.disabled).toBe(true);
  });

  test('an unscoped filter disables every action even after selecting all matching', async () => {
    const { getByRole, getAllByRole } = render(BulkSelectionBar, {
      props: baseProps({ filter: {} }),
    });

    await fireEvent.click(getByRole('checkbox', { name: /Select all 47 matching the filter/ }));

    const cancelButton = requireElement(
      getAllByRole('button').find((button) => button.textContent?.trim() === 'Cancel'),
      HTMLButtonElement,
    );
    expect(cancelButton.disabled).toBe(true);
  });

  test('granted scope + select-all-matching + a scoped filter enables the actions', async () => {
    const { getByRole, getAllByRole } = render(BulkSelectionBar, { props: baseProps() });

    await fireEvent.click(getByRole('checkbox', { name: /Select all 47 matching the filter/ }));

    const cancelButton = requireElement(
      getAllByRole('button').find((button) => button.textContent?.trim() === 'Cancel'),
      HTMLButtonElement,
    );
    expect(cancelButton.disabled).toBe(false);
  });

  test('clicking Cancel (once enabled) opens the bulk cancel dialog and fires its dry run', async () => {
    const fetch = new ScriptedFetch();
    fetch.routeJsonRpcMethod('weft.workflows.bulk.cancel', {
      dryRun: true,
      action: 'cancel',
      matched: 5,
      requestId: 'bulk:req-1',
      scope: {
        matched: 5,
        filter: { status: 'failed' },
        statuses: ['failed'],
        workflowTypes: ['checkout'],
        sampleWorkflowIds: [],
        sampleLimit: 20,
      },
      sampleWorkflowIds: [],
      confirmationToken: 'bulk:token-abc',
      confirmationTokenVersion: 1,
    });

    try {
      const { getByRole, getAllByRole, getByText } = render(BulkSelectionBar, {
        props: baseProps({ client: realClient() }),
      });

      await fireEvent.click(getByRole('checkbox', { name: /Select all 47 matching the filter/ }));
      const cancelButton = requireElement(
        getAllByRole('button').find((button) => button.textContent?.trim() === 'Cancel'),
        HTMLButtonElement,
      );
      await fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(getByText('5 matching workflows')).not.toBeNull();
      });
    } finally {
      fetch.restore();
    }
  });
});
