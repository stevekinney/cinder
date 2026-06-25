/// <reference lib="dom" />
import { afterEach, describe, expect, jest, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { expectNoLeakedTimers, trackTimers } from '../../test/lifecycle.ts';
import type { ApprovalCardProps } from './approval-card.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: DiffViewerTestDouble } = await import('../../test/diff-viewer-test-double.svelte');

mock.module('../diff-viewer/diff-viewer.svelte', () => ({
  default: DiffViewerTestDouble,
}));

const { default: ApprovalCard } = await import('./approval-card.svelte');

afterEach(() => {
  cleanup();
  if (jest.isFakeTimers()) {
    jest.useRealTimers();
  }
  jest.restoreAllMocks();
  document.body.replaceChildren();
});

function approvalCardProps(overrides: Partial<ApprovalCardProps> = {}): ApprovalCardProps {
  return {
    tool: { name: 'deploy-cloud', risk: 'medium' },
    sandbox: {
      provider: 'codex',
      name: 'workspace-write',
      workingDir: '/Users/stevekinney/Developer/cinder',
    },
    operation: {
      kind: 'command',
      command: 'bun run --filter=@lostgradient/cinder test',
      filesTouched: ['packages/components/src/components/approval-card/approval-card.svelte'],
      argsPreview: { dryRun: false, retries: 1 },
    },
    env: ['DATABASE_URL=postgres://fake-secret-value', 'OPENAI_API_KEY'],
    snapshotId: 'snapshot-123',
    policyVersion: 'policy-2026-06',
    idempotencyKey: 'approval-card-test-key',
    state: 'pending',
    ...overrides,
  };
}

describe('ApprovalCard', () => {
  test('renders pending approval details and invokes action callbacks', async () => {
    const onApprove = mock();
    const onDeny = mock();
    const onRemember = mock();
    const onCancel = mock();

    const { container, getByRole, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: false,
        onApprove,
        onDeny,
        onRemember,
        onCancel,
      }),
    });

    expect(getByRole('region', { name: 'Approval required for deploy-cloud' })).toBeTruthy();
    expect(container.textContent).toContain('deploy-cloud');
    expect(container.textContent).toContain('Medium risk');
    expect(container.textContent).toContain('workspace-write');
    expect(container.textContent).toContain('policy-2026-06');
    expect(queryByRole('button', { name: 'Approve with edits' })).toBeNull();

    await fireEvent.click(getByRole('button', { name: 'Approve' }));
    await fireEvent.click(getByRole('button', { name: 'Deny' }));
    await fireEvent.click(getByRole('button', { name: 'Remember' }));
    await fireEvent.click(getByRole('button', { name: 'Cancel' }));

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onDeny).toHaveBeenCalledTimes(1);
    expect(onRemember).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('renders five pending actions when editable arguments are enabled', () => {
    const { getByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onApprove: mock(),
        onApproveWithEdits: mock(),
        onDeny: mock(),
        onRemember: mock(),
        onCancel: mock(),
      }),
    });

    const actionGroup = getByRole('group', { name: 'Approval actions' });
    const buttons = Array.from(actionGroup.querySelectorAll('button')).map((button) =>
      button.textContent?.trim(),
    );

    expect(buttons).toEqual(['Approve', 'Approve with edits', 'Deny', 'Remember', 'Cancel']);
  });

  test('truncates large argument previews and long file lists', () => {
    const filesTouched = Array.from({ length: 8 }, (_, index) => `src/file-${index + 1}.ts`);
    const { container } = render(ApprovalCard, {
      ...approvalCardProps({
        operation: {
          kind: 'file-write',
          filesTouched,
          argsPreview: { payload: 'x'.repeat(10_000) },
        },
      }),
    });

    expect(container.textContent).toContain('Truncated');
    expect(container.textContent).toContain('Showing 5 of 8 files');
    expect(container.textContent).toContain('src/file-5.ts');
    expect(container.textContent).toContain('3 more files');
    expect(container.textContent).not.toContain('src/file-8.ts');
  });

  test('renders environment names through masked fields without leaking supplied values', () => {
    const { container } = render(ApprovalCard, {
      ...approvalCardProps({
        env: ['DATABASE_URL=postgres://fake-secret-value', 'ANTHROPIC_API_KEY'],
      }),
    });

    expect(container.textContent).toContain('DATABASE_URL');
    expect(container.textContent).toContain('ANTHROPIC_API_KEY');
    expect(container.querySelectorAll('.cinder-secret-value-field')).toHaveLength(2);
    expect(container.innerHTML).not.toContain('postgres://fake-secret-value');
  });

  test('renders commands with CodeBlock', () => {
    const { container } = render(ApprovalCard, {
      ...approvalCardProps({
        operation: {
          kind: 'command',
          command: 'bun run components:check',
          argsPreview: { package: '@lostgradient/cinder' },
        },
      }),
    });

    expect(container.querySelector('.cinder-code-block')).not.toBeNull();
    expect(container.querySelector('.cinder-code-block__code')?.textContent).toContain(
      'bun run components:check',
    );
  });

  test('renders patch operations through DiffViewer', () => {
    const { container } = render(ApprovalCard, {
      ...approvalCardProps({
        operation: {
          kind: 'patch',
          filesTouched: ['src/approval.ts'],
          diff: 'diff --git a/src/approval.ts b/src/approval.ts\n+export const approved = true;',
          argsPreview: { mode: 'patch' },
        },
      }),
    });

    const diffViewer = container.querySelector<HTMLElement>('.cinder-diff-viewer-test-double');
    expect(diffViewer).not.toBeNull();
    expect(diffViewer?.getAttribute('data-original')).toBe('');
    expect(diffViewer?.getAttribute('data-current')).toBe(
      'diff --git a/src/approval.ts b/src/approval.ts\n+export const approved = true;',
    );
    expect(diffViewer?.getAttribute('data-normalize-inputs')).toBe('false');
    expect(diffViewer?.getAttribute('data-readonly')).toBe('true');
    expect(container.textContent).toContain('diff --git a/src/approval.ts b/src/approval.ts');
    expect(container.textContent).toContain('export const approved = true;');
  });

  test('transitions pending approvals to an expired read-only state without firing callbacks', async () => {
    const now = new Date('2026-06-24T12:00:00.000Z');
    jest.useFakeTimers({ now });

    const onApprove = mock();
    const { getByRole, getByText, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        expiresAt: new Date(now.getTime() + 1_000).toISOString(),
        onApprove,
      }),
    });

    expect(getByText('Expires in 1s')).toBeTruthy();

    jest.advanceTimersByTime(1_000);
    await tick();

    expect(
      getByText('No approval actions are available because this request is expired.'),
    ).toBeTruthy();
    expect(getByRole('img', { name: 'Expired' })).toBeTruthy();
    expect(queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(onApprove).not.toHaveBeenCalled();
  });

  test('cleans up countdown timers on destroy', async () => {
    const now = new Date('2026-06-24T12:00:00.000Z');
    jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    const timers = trackTimers();

    try {
      const { unmount } = render(ApprovalCard, {
        ...approvalCardProps({
          expiresAt: new Date(now.getTime() + 60_000).toISOString(),
        }),
      });
      await tick();

      expect(timers.active().size).toBeGreaterThan(0);
      unmount();
      expectNoLeakedTimers(timers.active());
    } finally {
      timers.release();
    }
  });

  test('edits arguments as JSON before approving with edits', async () => {
    const onApproveWithEdits = mock();
    const { getByLabelText, getByRole, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onApproveWithEdits,
        operation: {
          kind: 'other',
          argsPreview: { force: false },
        },
      }),
    });

    await fireEvent.click(getByRole('button', { name: 'Approve with edits' }));

    const textarea = getByLabelText('Edited arguments JSON') as HTMLTextAreaElement;
    expect(textarea.value).toContain('"force": false');

    await fireEvent.input(textarea, { target: { value: '{ broken' } });
    const invalidConfirmButton = getByRole('button', {
      name: 'Confirm edited approval',
    }) as HTMLButtonElement;
    expect(invalidConfirmButton.disabled).toBe(true);
    expect(getByRole('alert').textContent).toContain('valid JSON');

    await fireEvent.input(textarea, { target: { value: '{ "force": true }' } });
    expect(queryByRole('alert')).toBeNull();
    await fireEvent.click(getByRole('button', { name: 'Confirm edited approval' }));

    expect(onApproveWithEdits).toHaveBeenCalledWith({ force: true });
  });

  test('reseeds editable arguments when the approval request changes', async () => {
    const onApproveWithEdits = mock();
    const view = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onApproveWithEdits,
        idempotencyKey: 'approval-one',
        operation: {
          kind: 'other',
          argsPreview: { force: false },
        },
      }),
    });

    await fireEvent.click(view.getByRole('button', { name: 'Approve with edits' }));
    const staleTextarea = view.getByLabelText('Edited arguments JSON') as HTMLTextAreaElement;
    await fireEvent.input(staleTextarea, { target: { value: '{ "force": true }' } });

    await view.rerender({
      ...approvalCardProps({
        editableArgs: true,
        onApproveWithEdits,
        idempotencyKey: 'approval-two',
        operation: {
          kind: 'other',
          argsPreview: { force: false, region: 'iad' },
        },
      }),
    });

    expect(view.queryByLabelText('Edited arguments JSON')).toBeNull();

    await fireEvent.click(view.getByRole('button', { name: 'Approve with edits' }));
    const nextTextarea = view.getByLabelText('Edited arguments JSON') as HTMLTextAreaElement;
    expect(nextTextarea.value).toContain('"region": "iad"');
    expect(nextTextarea.value).not.toContain('"force": true');

    await fireEvent.click(view.getByRole('button', { name: 'Confirm edited approval' }));
    expect(onApproveWithEdits).toHaveBeenCalledWith({ force: false, region: 'iad' });
  });

  test('renders read-only summaries without action buttons for terminal states', () => {
    for (const state of [
      'approved',
      'approved_with_edits',
      'denied',
      'expired',
      'cancelled',
    ] as const) {
      const { container, getByText, queryByRole, unmount } = render(ApprovalCard, {
        ...approvalCardProps({ state }),
      });

      expect(
        getByText(
          `No approval actions are available because this request is ${state.replaceAll('_', ' ')}.`,
        ),
      ).toBeTruthy();
      expect(
        container.querySelector('.cinder-approval-card__readonly-summary')?.textContent,
      ).toContain('No approval actions are available for this request.');
      expect(queryByRole('group', { name: 'Approval actions' })).toBeNull();
      unmount();
    }
  });

  test('uses accessible names, descriptions, and native buttons', () => {
    const { container, getByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        onDeny: mock(),
      }),
    });

    const region = getByRole('region', { name: 'Approval required for deploy-cloud' });
    const description = container.querySelector('.cinder-approval-card__description');
    expect(description).toBeInstanceOf(HTMLElement);
    expect(region.getAttribute('aria-describedby')).toBe((description as HTMLElement).id);

    const actionGroup = getByRole('group', { name: 'Approval actions' });
    expect(actionGroup).toBeTruthy();
    expect(getByRole('button', { name: 'Deny' }).getAttribute('type')).toBe('button');
  });
});
