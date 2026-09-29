import { requireElement } from '../../../../tests/dom-test-support.ts';

import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import WorkflowListPagination from './workflow-list-pagination.svelte';

describe('WorkflowListPagination', () => {
  test('shows the current page state via the total count', async () => {
    const { getByText } = render(WorkflowListPagination, {
      props: {
        offset: 0,
        limit: 50,
        total: 1307,
        onOffsetChange: () => {},
        onLimitChange: () => {},
      },
    });

    expect(getByText(/1,307/)).not.toBeNull();
  });

  test('clicking "Next" advances the offset by one page', async () => {
    let nextOffset: number | undefined;
    const { getByRole } = render(WorkflowListPagination, {
      props: {
        offset: 0,
        limit: 50,
        total: 200,
        onOffsetChange: (offset: number) => {
          nextOffset = offset;
        },
        onLimitChange: () => {},
      },
    });

    await fireEvent.click(getByRole('button', { name: /next page/i }));
    expect(nextOffset).toBe(50);
  });

  test('changing the page-size select resets the offset to 0', async () => {
    let nextLimit: number | undefined;
    let nextOffset: number | undefined;
    const { getByLabelText } = render(WorkflowListPagination, {
      props: {
        offset: 100,
        limit: 50,
        total: 200,
        onOffsetChange: (offset: number) => {
          nextOffset = offset;
        },
        onLimitChange: (limit: number) => {
          nextLimit = limit;
        },
      },
    });

    const select = requireElement(getByLabelText('Rows per page'), HTMLSelectElement);
    await fireEvent.change(select, { target: { value: '100' } });

    expect(nextLimit).toBe(100);
    expect(nextOffset).toBe(0);
  });
});
