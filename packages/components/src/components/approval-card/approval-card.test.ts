/// <reference lib="dom" />
import { afterEach, describe, expect, jest, mock, test } from 'bun:test';

import Ajv2020 from 'ajv/dist/2020';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { expectNoLeakedTimers, trackTimers } from '../../test/lifecycle.ts';
import { isApprovalActionable, resolveEffectiveApprovalState } from './approval-card-state.ts';
import type { ApprovalCardProps } from './approval-card.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: ApprovalCard } = await import('./approval-card.svelte');
const { default: approvalCardSchema } = await import('./approval-card.schema.ts');

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
      workingDir: '/workspace/project',
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
  test('schema represents the required operation prop', () => {
    expect(approvalCardSchema.required).toContain('operation');
    expect(approvalCardSchema.properties).toHaveProperty('operation');
    expect(approvalCardSchema.metadata?.unsupportedProps?.map((prop) => prop.name)).not.toContain(
      'operation',
    );
  });

  test('schema accepts nested JSON argument previews', () => {
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(approvalCardSchema);

    expect(
      validate({
        tool: { name: 'deploy-cloud', risk: 'medium' },
        operation: {
          kind: 'other',
          argsPreview: {
            filters: {
              include: {
                branch: 'main',
              },
            },
          },
        },
        policyVersion: 'policy-2026-06',
        idempotencyKey: 'approval-card-test-key',
        state: 'pending',
      }),
    ).toBe(true);
    expect(validate.errors).toBeNull();
  });

  test('schema accepts nested array argument previews', () => {
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(approvalCardSchema);

    expect(
      validate({
        tool: { name: 'deploy-cloud', risk: 'medium' },
        operation: {
          kind: 'other',
          argsPreview: [['cmd', 'arg'], { nested: [['branch', 'main']] }],
        },
        policyVersion: 'policy-2026-06',
        idempotencyKey: 'approval-card-test-key',
        state: 'pending',
      }),
    ).toBe(true);
    expect(validate.errors).toBeNull();
  });

  test('schema accepts deeply nested argument previews without a depth boundary', () => {
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(approvalCardSchema);

    expect(
      validate({
        tool: { name: 'deploy-cloud', risk: 'medium' },
        operation: {
          kind: 'other',
          argsPreview: [[[[[['branch', 'main']]]]]],
        },
        policyVersion: 'policy-2026-06',
        idempotencyKey: 'approval-card-test-key',
        state: 'pending',
      }),
    ).toBe(true);
    expect(validate.errors).toBeNull();
  });

  test('schema rejects command approvals without command payloads', () => {
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(approvalCardSchema);

    expect(
      validate({
        tool: { name: 'deploy-cloud', risk: 'medium' },
        operation: {
          kind: 'command',
        },
        policyVersion: 'policy-2026-06',
        idempotencyKey: 'approval-card-test-key',
        state: 'pending',
      }),
    ).toBe(false);
  });

  test('schema rejects patch approvals without diff payloads', () => {
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(approvalCardSchema);

    expect(
      validate({
        tool: { name: 'deploy-cloud', risk: 'medium' },
        operation: {
          kind: 'patch',
        },
        policyVersion: 'policy-2026-06',
        idempotencyKey: 'approval-card-test-key',
        state: 'pending',
      }),
    ).toBe(false);
  });

  test('schema rejects file-write approvals without touched files', () => {
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(approvalCardSchema);
    const basePayload = {
      tool: { name: 'write-file', risk: 'high' },
      policyVersion: 'policy-2026-06',
      idempotencyKey: 'approval-card-test-key',
      state: 'pending',
    };

    expect(
      validate({
        ...basePayload,
        operation: {
          kind: 'file-write',
        },
      }),
    ).toBe(false);

    expect(
      validate({
        ...basePayload,
        operation: {
          kind: 'file-write',
          filesTouched: [],
        },
      }),
    ).toBe(false);

    expect(
      validate({
        ...basePayload,
        operation: {
          kind: 'file-write',
          filesTouched: ['src/new-file.ts'],
        },
      }),
    ).toBe(true);
    expect(validate.errors).toBeNull();
  });

  test('resolves already-expired approvals before timer state initializes', () => {
    const expirationTimestamp = Date.parse('2026-06-24T12:00:00.000Z');
    jest.spyOn(Date, 'now').mockReturnValue(expirationTimestamp);

    expect(resolveEffectiveApprovalState('pending', expirationTimestamp, undefined)).toBe(
      'expired',
    );
    expect(isApprovalActionable('pending', expirationTimestamp, undefined)).toBe(false);
    expect(isApprovalActionable('pending', expirationTimestamp, expirationTimestamp - 1)).toBe(
      true,
    );
    expect(resolveEffectiveApprovalState('pending', expirationTimestamp, expirationTimestamp)).toBe(
      'expired',
    );
    expect(isApprovalActionable('pending', expirationTimestamp, expirationTimestamp)).toBe(false);
  });

  test('renders pending approval details and invokes action callbacks', async () => {
    const onapprove = mock();
    const ondeny = mock();
    const onremember = mock();
    const oncancel = mock();

    const { container, getByRole, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: false,
        onapprove,
        ondeny,
        onremember,
        oncancel,
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

    expect(onapprove).toHaveBeenCalledTimes(1);
    expect(ondeny).toHaveBeenCalledTimes(1);
    expect(onremember).toHaveBeenCalledTimes(1);
    expect(oncancel).toHaveBeenCalledTimes(1);
  });

  test('invokes lowercase approval callbacks', async () => {
    const onapprove = mock();
    const ondeny = mock();

    const { getByRole } = render(ApprovalCard, {
      ...approvalCardProps({ editableArgs: false }),
      onapprove,
      ondeny,
    });

    const approveButton = getByRole('button', { name: 'Approve' }) as HTMLButtonElement;
    const denyButton = getByRole('button', { name: 'Deny' }) as HTMLButtonElement;

    expect(approveButton.disabled).toBe(false);
    expect(denyButton.disabled).toBe(false);

    await fireEvent.click(approveButton);
    await fireEvent.click(denyButton);

    expect(onapprove).toHaveBeenCalledTimes(1);
    expect(ondeny).toHaveBeenCalledTimes(1);
  });

  test('renders five pending actions when editable arguments are enabled', () => {
    const { getByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onapprove: mock(),
        onapprovewithedits: mock(),
        ondeny: mock(),
        onremember: mock(),
        oncancel: mock(),
      }),
    });

    const actionGroup = getByRole('group', { name: 'Approval actions' });
    const buttons = Array.from(actionGroup.querySelectorAll('button')).map((button) =>
      button.textContent?.trim(),
    );

    expect(buttons).toEqual(['Approve', 'Approve with edits', 'Deny', 'Remember', 'Cancel']);
  });

  test('truncates large argument previews with an excerpt and renders every touched file', async () => {
    const filesTouched = Array.from({ length: 8 }, (_, index) => `src/file-${index + 1}.ts`);
    const { container, getByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        operation: {
          kind: 'file-write',
          filesTouched,
          argsPreview: { payload: `start-${'x'.repeat(10_000)}` },
        },
      }),
    });

    expect(container.textContent).toContain('Truncated');
    await fireEvent.click(getByRole('tab', { name: 'Tree' }));
    expect(container.textContent).toContain('start-');
    expect(container.textContent).toContain(
      'Review the touched files and arguments before approving this file write.',
    );
    expect(container.textContent).toContain('8 files');
    for (const file of filesTouched) {
      expect(container.textContent).toContain(file);
    }
    expect(container.textContent).not.toContain('more files');
    expect(container.textContent).not.toContain('No command or patch body was provided.');
  });

  test('renders repeated touched files without duplicate keyed rows', () => {
    const { container } = render(ApprovalCard, {
      ...approvalCardProps({
        operation: {
          kind: 'file-write',
          filesTouched: ['src/repeated.ts', 'src/repeated.ts'],
        },
      }),
    });

    expect(
      Array.from(container.querySelectorAll('.cinder-approval-card__file-list li')).map((item) =>
        item.textContent?.trim(),
      ),
    ).toEqual(['src/repeated.ts', 'src/repeated.ts']);
  });

  test('renders a singular touched-file badge for one file', () => {
    const { container } = render(ApprovalCard, {
      ...approvalCardProps({
        operation: {
          kind: 'file-write',
          filesTouched: ['src/one-file.ts'],
        },
      }),
    });

    expect(container.textContent).toContain('1 file');
    expect(container.textContent).not.toContain('1 files');
  });

  test('renders string argument previews as primitive values', async () => {
    const { container, getByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        operation: {
          kind: 'other',
          argsPreview: '--force',
        },
      }),
    });

    const badge = container.querySelector('.cinder-payload-inspector__summary .cinder-badge');
    expect(badge?.textContent?.trim()).toBe('string');

    await fireEvent.click(getByRole('tab', { name: 'Raw' }));

    expect(container.textContent).toContain('--force');
    expect(container.textContent).not.toContain('Parse error');
  });

  test('renders serialized JSON strings as parsed argument previews', async () => {
    const { container, getByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        operation: {
          kind: 'other',
          argsPreview: '{"filters":{"include":{"branch":"main"}}}',
        },
      }),
    });

    const badge = container.querySelector('.cinder-payload-inspector__summary .cinder-badge');
    expect(badge?.textContent?.trim()).toBe('object');

    await fireEvent.click(getByRole('tab', { name: 'Tree' }));

    expect(container.textContent).toContain('filters');
    expect(container.textContent).not.toContain('Parse error');
  });

  test('does not fabricate editable arguments when no preview is provided', () => {
    const onapprovewithedits = mock();
    const { container, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onapprovewithedits,
        operation: {
          kind: 'other',
        },
      }),
    });

    expect(queryByRole('button', { name: 'Approve with edits' })).toBeNull();
    expect(container.textContent).toContain('No arguments were provided.');
    expect(container.textContent).not.toContain('{}');
    expect(onapprovewithedits).not.toHaveBeenCalled();
  });

  test('renders environment names through masked fields without leaking supplied values', async () => {
    const writeText = mock(async () => undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { container } = render(ApprovalCard, {
      ...approvalCardProps({
        env: ['DATABASE_URL=postgres://fake-secret-value', 'ANTHROPIC_API_KEY'],
      }),
    });

    try {
      expect(container.textContent).toContain('DATABASE_URL');
      expect(container.textContent).toContain('ANTHROPIC_API_KEY');
      expect(container.querySelectorAll('.cinder-secret-value-field')).toHaveLength(2);
      expect(container.innerHTML).not.toContain('postgres://fake-secret-value');

      const copyButton = container.querySelector<HTMLButtonElement>(
        '.cinder-secret-value-field__copy',
      );
      expect(copyButton).not.toBeNull();
      await fireEvent.click(copyButton as HTMLButtonElement);
      expect(writeText).toHaveBeenCalledWith('DATABASE_URL');
      expect(writeText).not.toHaveBeenCalledWith('');
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  test('deduplicates sanitized environment names before rendering masked fields', () => {
    const { container } = render(ApprovalCard, {
      ...approvalCardProps({
        env: [
          'DATABASE_URL=postgres://fake-secret-value',
          'DATABASE_URL',
          'DATABASE_URL=postgres://other-fake-secret-value',
        ],
      }),
    });

    expect(container.querySelectorAll('.cinder-secret-value-field')).toHaveLength(1);
    expect(container.textContent).toContain('DATABASE_URL');
    expect(container.innerHTML).not.toContain('postgres://fake-secret-value');
    expect(container.innerHTML).not.toContain('postgres://other-fake-secret-value');
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

  test('renders patch operations as unified diff code', () => {
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

    const codeBlock = container.querySelector<HTMLElement>('.cinder-code-block');
    expect(codeBlock).not.toBeNull();
    expect(codeBlock?.querySelector('.cinder-code-block__language')?.textContent?.trim()).toBe(
      'diff',
    );
    expect(container.textContent).toContain('diff --git a/src/approval.ts b/src/approval.ts');
    expect(container.textContent).toContain('export const approved = true;');
  });

  test('transitions pending approvals to an expired read-only state without firing callbacks', async () => {
    const now = new Date('2026-06-24T12:00:00.000Z');
    jest.useFakeTimers({ now });

    const onapprove = mock();
    const { getByRole, getByText, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        expiresAt: new Date(now.getTime() + 1_000).toISOString(),
        onapprove,
      }),
    });

    await tick();
    expect(getByText('Expires in 1s')).toBeTruthy();

    jest.advanceTimersByTime(1_000);
    await tick();

    expect(
      getByText('No approval actions are available because this request is expired.'),
    ).toBeTruthy();
    expect(getByRole('img', { name: 'Expired' })).toBeTruthy();
    expect(queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(onapprove).not.toHaveBeenCalled();
  });

  test('blocks action callbacks at the exact expiration deadline', async () => {
    const now = new Date('2026-06-24T12:00:00.000Z');
    jest.useFakeTimers({ now });
    const onapprove = mock();

    const { getByRole, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        expiresAt: new Date(now.getTime() + 250).toISOString(),
        onapprove,
      }),
    });

    await tick();
    const approveButton = getByRole('button', { name: 'Approve' });

    jest.advanceTimersByTime(250);
    await fireEvent.click(approveButton);

    expect(onapprove).not.toHaveBeenCalled();

    await tick();
    expect(queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  test('syncs the visible expired state when an overdue action is attempted before the timer fires', async () => {
    const now = new Date('2026-06-24T12:00:00.000Z').getTime();
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(now);
    const onapprove = mock();

    const { getByRole, getByText, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        expiresAt: new Date(now + 60_000).toISOString(),
        onapprove,
      }),
    });

    await tick();
    const approveButton = getByRole('button', { name: 'Approve' });

    dateNow.mockReturnValue(now + 60_001);
    await fireEvent.click(approveButton);
    await tick();

    expect(onapprove).not.toHaveBeenCalled();
    expect(
      getByText('No approval actions are available because this request is expired.'),
    ).toBeTruthy();
    expect(queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  test('renders past expiration as expired after mount without action buttons', async () => {
    const now = new Date('2026-06-24T12:00:00.000Z');
    jest.useFakeTimers({ now });

    const { getByRole, getByText, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        expiresAt: new Date(now.getTime() - 1_000).toISOString(),
        onapprove: mock(),
      }),
    });

    await tick();

    expect(
      getByText('No approval actions are available because this request is expired.'),
    ).toBeTruthy();
    expect(getByRole('img', { name: 'Expired' })).toBeTruthy();
    expect(queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  test('treats invalid expiration timestamps as no expiration', async () => {
    const onapprove = mock();

    const { getByRole, queryByText } = render(ApprovalCard, {
      ...approvalCardProps({
        expiresAt: 'not-an-iso-date',
        onapprove,
      }),
    });

    await tick();

    expect(
      queryByText('No approval actions are available because this request is expired.'),
    ).toBeNull();
    expect(getByRole('img', { name: 'Pending' })).toBeTruthy();

    await fireEvent.click(getByRole('button', { name: 'Approve' }));

    expect(onapprove).toHaveBeenCalledTimes(1);
  });

  test('renders already-expired approvals read-only on the initial render', () => {
    const now = new Date('2026-06-24T12:00:00.000Z');
    jest.useFakeTimers({ now });

    const { getByRole, getByText, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        expiresAt: new Date(now.getTime() - 1_000).toISOString(),
        onapprove: mock(),
      }),
    });

    expect(
      getByText('No approval actions are available because this request is expired.'),
    ).toBeTruthy();
    expect(getByRole('img', { name: 'Expired' })).toBeTruthy();
    expect(queryByRole('button', { name: 'Approve' })).toBeNull();
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
    const onapprovewithedits = mock();
    const { getByLabelText, getByRole, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onapprovewithedits,
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

    expect(onapprovewithedits).toHaveBeenCalledWith({ force: true });
  });

  test('seeds editable arguments from serialized JSON previews', async () => {
    const onapprovewithedits = mock();
    const { getByLabelText, getByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onapprovewithedits,
        operation: {
          kind: 'other',
          argsPreview: '{"force":false,"files":["src/a.ts"]}',
        },
      }),
    });

    await fireEvent.click(getByRole('button', { name: 'Approve with edits' }));

    const textarea = getByLabelText('Edited arguments JSON') as HTMLTextAreaElement;
    expect(textarea.value).toContain('"force": false');
    expect(textarea.value).toContain('"files"');

    await fireEvent.click(getByRole('button', { name: 'Confirm edited approval' }));
    expect(onapprovewithedits).toHaveBeenCalledWith({ force: false, files: ['src/a.ts'] });
  });

  test('hides the edit panel when editable arguments are disabled after opening it', async () => {
    const onapprovewithedits = mock();
    const view = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onapprovewithedits,
        operation: {
          kind: 'other',
          argsPreview: { force: false },
        },
      }),
    });

    await fireEvent.click(view.getByRole('button', { name: 'Approve with edits' }));
    expect(view.getByLabelText('Edited arguments JSON')).toBeTruthy();

    await view.rerender({
      ...approvalCardProps({
        editableArgs: false,
        onapprovewithedits,
        operation: {
          kind: 'other',
          argsPreview: { force: false },
        },
      }),
    });

    expect(view.queryByLabelText('Edited arguments JSON')).toBeNull();
    expect(view.queryByRole('button', { name: 'Confirm edited approval' })).toBeNull();
    expect(onapprovewithedits).not.toHaveBeenCalled();
  });

  test('preserves null arguments when approving with edits without changes', async () => {
    const onapprovewithedits = mock();
    const { getByLabelText, getByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onapprovewithedits,
        operation: {
          kind: 'other',
          argsPreview: null,
        },
      }),
    });

    await fireEvent.click(getByRole('button', { name: 'Approve with edits' }));

    const textarea = getByLabelText('Edited arguments JSON') as HTMLTextAreaElement;
    expect(textarea.value).toBe('null');

    await fireEvent.click(getByRole('button', { name: 'Confirm edited approval' }));

    expect(onapprovewithedits).toHaveBeenCalledWith(null);
  });

  test('reseeds editable arguments when the approval request changes', async () => {
    const onapprovewithedits = mock();
    const view = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onapprovewithedits,
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
        onapprovewithedits,
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
    expect(onapprovewithedits).toHaveBeenCalledWith({ force: false, region: 'iad' });
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
        ondeny: mock(),
      }),
    });

    const region = getByRole('region', { name: 'Approval required for deploy-cloud' });
    const description = container.querySelector('.cinder-approval-card__description');
    expect(description).toBeInstanceOf(HTMLElement);
    expect(region.getAttribute('aria-describedby')).toBe((description as HTMLElement).id);

    expect(getByRole('group', { name: 'Approval status' })).toBeTruthy();
    const actionGroup = getByRole('group', { name: 'Approval actions' });
    expect(actionGroup).toBeTruthy();
    expect(getByRole('button', { name: 'Deny' }).getAttribute('type')).toBe('button');
  });
});
