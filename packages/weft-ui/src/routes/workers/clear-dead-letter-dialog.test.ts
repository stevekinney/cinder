import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import ClearDeadLetterDialog from './clear-dead-letter-dialog.svelte';

describe('ClearDeadLetterDialog', () => {
  test('the confirm button is disabled until the operationId is typed exactly', async () => {
    const { getByRole, getByLabelText } = render(ClearDeadLetterDialog, {
      props: {
        open: true,
        operationId: 'op-123',
        submitting: false,
        onConfirm: () => {},
        onCancel: () => {},
      },
    });

    const confirmButton = getByRole('button', { name: 'Clear dead letter' });
    expect(confirmButton.hasAttribute('disabled')).toBe(true);

    const input = getByLabelText(/Type "op-123" to confirm/i);
    await fireEvent.input(input, { target: { value: 'op-123' } });

    expect(confirmButton.hasAttribute('disabled')).toBe(false);
  });

  test('confirming calls onConfirm once the value matches', async () => {
    let confirmed = 0;
    const { getByRole, getByLabelText } = render(ClearDeadLetterDialog, {
      props: {
        open: true,
        operationId: 'op-123',
        submitting: false,
        onConfirm: () => (confirmed += 1),
        onCancel: () => {},
      },
    });

    await fireEvent.input(getByLabelText(/Type "op-123" to confirm/i), {
      target: { value: 'op-123' },
    });
    await fireEvent.click(getByRole('button', { name: 'Clear dead letter' }));

    expect(confirmed).toBe(1);
  });

  test('cancelling calls onCancel', async () => {
    let cancelled = 0;
    const { getByRole } = render(ClearDeadLetterDialog, {
      props: {
        open: true,
        operationId: 'op-123',
        submitting: false,
        onConfirm: () => {},
        onCancel: () => (cancelled += 1),
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(cancelled).toBe(1);
  });
});
