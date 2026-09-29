import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';
import { Window, type DetachedWindowAPI } from 'happy-dom';

import type { WorkflowSummary } from '@lostgradient/weft';

import { router } from '../../../lib/router.svelte.ts';
import WorkflowTable from './workflow-table.svelte';

function summary(overrides: Partial<WorkflowSummary> = {}): WorkflowSummary {
  return {
    id: 'wf_4a9f1234567890abcdef2c10',
    type: 'order-processing',
    status: 'running',
    version: '1',
    createdAt: Date.parse('2026-07-20T10:00:00.000Z'),
    updatedAt: Date.parse('2026-07-20T10:05:00.000Z'),
    ...overrides,
  };
}

function happyDomAPI(): DetachedWindowAPI {
  if (!(window instanceof Window)) {
    throw new Error('expected the test window to be backed by happy-dom');
  }
  return window.happyDOM;
}

describe('WorkflowTable', () => {
  test('renders a row per workflow with status label and truncated id', async () => {
    const { getByText } = render(WorkflowTable, {
      props: { rows: [summary({ status: 'failed', type: 'payment-failing' })] },
    });

    expect(getByText('Failed')).not.toBeNull();
    expect(getByText('payment-failing')).not.toBeNull();
    expect(getByText('wf_4a9f1…2c10')).not.toBeNull();
  });

  test('a row with revision defined renders a truncated monospace badge with the full id in its tooltip', async () => {
    const { getByText } = render(WorkflowTable, {
      props: { rows: [summary({ revision: 'order-processing-rev-abcdefghijk' })] },
    });

    expect(getByText('order-pr…hijk')).not.toBeNull();
    expect(
      getByText('Revision (exact executable artifact): order-processing-rev-abcdefghijk'),
    ).not.toBeNull();
  });

  test('a row with revision undefined renders an explicit "Unpinned" badge, never a blank cell', async () => {
    const { getByText } = render(WorkflowTable, {
      props: { rows: [summary()] },
    });

    expect(getByText('Unpinned')).not.toBeNull();
  });

  test('renders every tag as a badge', async () => {
    const { getByText } = render(WorkflowTable, {
      props: { rows: [summary({ tags: ['prod', 'nightly'] })] },
    });

    expect(getByText('prod')).not.toBeNull();
    expect(getByText('nightly')).not.toBeNull();
  });

  test('an id containing URL delimiters navigates to the exact workflow detail route', async () => {
    happyDomAPI().setURL('http://localhost/');
    router.navigate('/workflows', { replace: true });
    const workflowId = 'wf/orders?region=west#retry';
    const { getByRole } = render(WorkflowTable, {
      props: { rows: [summary({ id: workflowId })] },
    });

    const link = getByRole('link');
    expect(link.getAttribute('href')).toBe('/workflows/wf%2Forders%3Fregion%3Dwest%23retry');
    await fireEvent.click(link);
    expect(router.current.params['id']).toBe(workflowId);
  });

  test('a dot-only id is not normalized away by browser navigation', async () => {
    happyDomAPI().setURL('http://localhost/');
    router.navigate('/workflows', { replace: true });
    const { getByRole } = render(WorkflowTable, {
      props: { rows: [summary({ id: '..' })] },
    });

    const link = getByRole('link');
    expect(link.getAttribute('href')).toBe('/workflows/_?__weft_workflow_id=..');
    await fireEvent.click(link);
    expect(router.current.params['id']).toBe('..');
  });

  test('no selection column when selectedIds is omitted', async () => {
    const { queryAllByRole } = render(WorkflowTable, { props: { rows: [summary()] } });

    expect(queryAllByRole('checkbox')).toHaveLength(0);
  });

  test('selection checkboxes call onSelectionChange with the updated set', async () => {
    let latest: Set<string> | undefined;
    const { getAllByRole } = render(WorkflowTable, {
      props: {
        rows: [
          summary({ id: 'wf_row_one_aaaaaaaaaaaaaaaa' }),
          summary({ id: 'wf_row_two_bbbbbbbbbbbbbbbb' }),
        ],
        selectedIds: new Set<string>(),
        onSelectionChange: (next: Set<string>) => {
          latest = next;
        },
      },
    });

    const checkboxes = getAllByRole('checkbox');
    // First checkbox is "select all"; row checkboxes follow.
    await fireEvent.click(checkboxes[1]!);

    expect(latest).toEqual(new Set(['wf_row_one_aaaaaaaaaaaaaaaa']));
  });

  test('select-all toggles every row', async () => {
    let latest: Set<string> | undefined;
    const rows = [
      summary({ id: 'wf_row_one_aaaaaaaaaaaaaaaa' }),
      summary({ id: 'wf_row_two_bbbbbbbbbbbbbbbb' }),
    ];
    const { getAllByRole } = render(WorkflowTable, {
      props: {
        rows,
        selectedIds: new Set<string>(),
        onSelectionChange: (next: Set<string>) => {
          latest = next;
        },
      },
    });

    const checkboxes = getAllByRole('checkbox');
    await fireEvent.click(checkboxes[0]!);

    expect(latest).toEqual(new Set(rows.map((r) => r.id)));
  });

  test('applies a "recently changed" class for ids in recentlyChangedIds', async () => {
    const { container } = render(WorkflowTable, {
      props: { rows: [summary()], recentlyChangedIds: new Set([summary().id]) },
    });

    expect(container.querySelector('.weft-workflows-table__row--recent')).not.toBeNull();
  });
});
