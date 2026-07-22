/// <reference lib="dom" />
import { afterEach, describe, expect, jest, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import Ajv2020 from 'ajv/dist/2020';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { expectNoLeakedTimers, trackTimers } from '../../test/lifecycle.ts';
import {
  formatEditableArguments,
  isApprovalActionable,
  prepareArgumentsPreview,
  resolveEffectiveApprovalState,
} from './approval-card-state.ts';
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
    onresolve: () => undefined,
    ...overrides,
  };
}

describe('ApprovalCard', () => {
  test('imports JsonEditor directly so its public barrel does not duplicate styles', () => {
    const actionsSource = readFileSync(
      new URL('./approval-card-actions.svelte', import.meta.url),
      'utf8',
    );

    expect(actionsSource).toContain("from '../json-editor/json-editor.svelte'");
    expect(actionsSource).not.toContain("from '@lostgradient/cinder/json-editor'");
  });

  test('schema represents the required operation prop', () => {
    expect(approvalCardSchema.required).toContain('operation');
    expect(approvalCardSchema.properties).toHaveProperty('operation');
    expect(approvalCardSchema.metadata?.unsupportedProps?.map((prop) => prop.name)).toEqual([
      'onresolve',
    ]);
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

  test('keeps unserializable argument previews visible without truncation metadata', () => {
    const circularPreview: Record<string, unknown> = { command: 'deploy' };
    circularPreview['self'] = circularPreview;

    const preview = prepareArgumentsPreview(circularPreview);
    expect(preview.value).toBe(circularPreview);
    expect(preview.truncated).toBe(false);
  });

  test('falls back to an empty editable JSON object for unserializable argument previews', () => {
    const circularPreview: Record<string, unknown> = { command: 'deploy' };
    circularPreview['self'] = circularPreview;

    expect(formatEditableArguments(circularPreview)).toBe('{}');
  });

  test('renders as an article without nested region landmarks', () => {
    const { getByRole, queryAllByRole } = render(ApprovalCard, { ...approvalCardProps() });

    expect(getByRole('article', { name: 'Approval required for deploy-cloud' })).toBeTruthy();
    expect(queryAllByRole('region')).toHaveLength(0);
  });

  test('renders pending approval details', () => {
    const { container, getByRole } = render(ApprovalCard, { ...approvalCardProps() });

    expect(container.textContent).toContain('deploy-cloud');
    expect(getByRole('img', { name: 'Medium risk' })).toBeTruthy();
    expect(getByRole('group', { name: 'Approval status' })).toBeTruthy();
    expect(getByRole('group', { name: 'Approval actions' })).toBeTruthy();
    expect(getByRole('button', { name: 'Approve' }).getAttribute('type')).toBe('button');
  });

  test('renders the risk level as a named, focusable signal icon per risk level', () => {
    for (const risk of ['low', 'medium', 'high'] as const) {
      const { getByRole, unmount } = render(ApprovalCard, {
        ...approvalCardProps({ tool: { name: 'deploy-cloud', risk } }),
      });

      const expectedName =
        risk === 'low' ? 'Low risk' : risk === 'medium' ? 'Medium risk' : 'High risk';
      const icon = getByRole('img', { name: expectedName });
      expect(icon.getAttribute('tabindex')).toBe('0');
      expect(icon.getAttribute('data-cinder-risk')).toBe(risk);
      unmount();
    }
  });

  test('renders headings at the configured level', () => {
    const { container, unmount } = render(ApprovalCard, { ...approvalCardProps() });
    expect(container.querySelector('h3.cinder-approval-card__title')).not.toBeNull();
    expect(container.querySelector('h4.cinder-approval-card__section-title')).not.toBeNull();
    unmount();

    const { container: leveled } = render(ApprovalCard, {
      ...approvalCardProps({ headingLevel: 2 }),
    });
    expect(leveled.querySelector('h2.cinder-approval-card__title')).not.toBeNull();
    expect(leveled.querySelector('h3.cinder-approval-card__section-title')).not.toBeNull();
  });

  test('renders no action buttons when onresolve is absent', () => {
    const { onresolve: _onresolve, ...withoutResolve } = approvalCardProps();
    const { queryByRole } = render(ApprovalCard, withoutResolve);

    expect(queryByRole('group', { name: 'Approval actions' })).toBeNull();
    expect(queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(queryByRole('checkbox')).toBeNull();
  });

  test('renders no action buttons and does not throw when onresolve is a truthy non-function', () => {
    const { queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({ onresolve: 'not-a-function' as unknown as () => void }),
    });

    expect(queryByRole('group', { name: 'Approval actions' })).toBeNull();
    expect(queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  test('orders actions with the primary decision last, matching the dialog convention', () => {
    const { getByRole } = render(ApprovalCard, {
      ...approvalCardProps({ editableArgs: true }),
    });

    const actionGroup = getByRole('group', { name: 'Approval actions' });
    const buttons = Array.from(actionGroup.querySelectorAll('button')).map((button) =>
      button.textContent?.trim(),
    );

    expect(buttons).toEqual(['Dismiss', 'Deny', 'Approve with edits', 'Approve']);
  });

  test('does not render a Remember action button', () => {
    const { queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({ editableArgs: true }),
    });

    expect(queryByRole('button', { name: 'Remember' })).toBeNull();
  });

  test('emits a complete approval resolution when approving as presented', async () => {
    const onresolve = mock();

    const { getByRole } = render(ApprovalCard, {
      ...approvalCardProps({ editableArgs: false, onresolve }),
    });

    const rememberCheckbox = getByRole('checkbox', {
      name: "Don't ask again for operations like this",
    }) as HTMLInputElement;

    await fireEvent.click(rememberCheckbox);
    await fireEvent.click(getByRole('button', { name: 'Approve' }));

    expect(onresolve).toHaveBeenCalledWith({
      decision: 'approve',
      remember: true,
    });
  });

  test('emits reason text and remember state when denying', async () => {
    const onresolve = mock();

    const { getByLabelText, getByRole } = render(ApprovalCard, {
      ...approvalCardProps({ editableArgs: false, onresolve }),
    });

    await fireEvent.input(getByLabelText('Reason'), {
      target: { value: 'Outside the deployment window.' },
    });
    await fireEvent.click(
      getByRole('checkbox', { name: "Don't ask again for operations like this" }),
    );
    await fireEvent.click(getByRole('button', { name: 'Deny' }));

    expect(onresolve).toHaveBeenCalledWith({
      decision: 'deny',
      reason: 'Outside the deployment window.',
      remember: true,
    });
  });

  test('emits a cancel decision when dismissing', async () => {
    const onresolve = mock();

    const { getByLabelText, getByRole } = render(ApprovalCard, {
      ...approvalCardProps({ editableArgs: false, onresolve }),
    });

    await fireEvent.input(getByLabelText('Reason'), {
      target: { value: 'Need more context before deciding.' },
    });
    await fireEvent.click(getByRole('button', { name: 'Dismiss' }));

    expect(onresolve).toHaveBeenCalledWith({
      decision: 'cancel',
      reason: 'Need more context before deciding.',
      remember: false,
    });
  });

  test('resets resolution reason and remember state when the approval request changes', async () => {
    const onresolve = mock();
    const view = render(ApprovalCard, {
      ...approvalCardProps({
        onresolve,
        idempotencyKey: 'approval-one',
      }),
    });

    await fireEvent.input(view.getByLabelText('Reason'), {
      target: { value: 'Applies only to the first approval.' },
    });
    await fireEvent.click(
      view.getByRole('checkbox', { name: "Don't ask again for operations like this" }),
    );

    await view.rerender({
      ...approvalCardProps({
        onresolve,
        idempotencyKey: 'approval-two',
      }),
    });

    expect((view.getByLabelText('Reason') as HTMLTextAreaElement).value).toBe('');
    expect(
      (
        view.getByRole('checkbox', {
          name: "Don't ask again for operations like this",
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);

    await fireEvent.click(view.getByRole('button', { name: 'Approve' }));
    expect(onresolve).toHaveBeenCalledWith({
      decision: 'approve',
      remember: false,
    });
  });

  test('preserves in-progress reason text and remember state across an unrelated host re-render', async () => {
    const onresolve = mock();
    const view = render(ApprovalCard, {
      ...approvalCardProps({ onresolve, idempotencyKey: 'approval-one' }),
    });

    await fireEvent.input(view.getByLabelText('Reason'), {
      target: { value: 'Still drafting this reason.' },
    });
    await fireEvent.click(
      view.getByRole('checkbox', { name: "Don't ask again for operations like this" }),
    );

    // Same idempotencyKey — the host re-rendered for some unrelated reason
    // (e.g. a countdown tick elsewhere on the page), not because a new
    // approval request arrived. The draft must survive this.
    await view.rerender({
      ...approvalCardProps({ onresolve, idempotencyKey: 'approval-one', snapshotId: 'snap-2' }),
    });

    expect((view.getByLabelText('Reason') as HTMLTextAreaElement).value).toBe(
      'Still drafting this reason.',
    );
    expect(
      (
        view.getByRole('checkbox', {
          name: "Don't ask again for operations like this",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  test('edits arguments as JSON before approving with edits', async () => {
    const onresolve = mock();
    const { getByLabelText, getByRole, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onresolve,
        operation: {
          kind: 'other',
          argsPreview: { force: false },
        },
      }),
    });

    const editToggle = getByRole('button', { name: 'Approve with edits' });
    expect(editToggle.getAttribute('aria-expanded')).toBe('false');

    await fireEvent.click(editToggle);
    expect(editToggle.getAttribute('aria-expanded')).toBe('true');

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

    expect(onresolve).toHaveBeenCalledWith({
      decision: 'approve_with_edits',
      editedArgs: { force: true },
      remember: false,
    });
  });

  test('moves focus into the JSON editor when it opens', async () => {
    const { getByLabelText, getByRole } = render(ApprovalCard, {
      ...approvalCardProps({ editableArgs: true }),
    });

    await fireEvent.click(getByRole('button', { name: 'Approve with edits' }));
    await tick();

    expect(document.activeElement).toBe(getByLabelText('Edited arguments JSON'));
  });

  test('seeds editable arguments from serialized JSON previews', async () => {
    const onresolve = mock();
    const { getByLabelText, getByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onresolve,
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
    expect(onresolve).toHaveBeenCalledWith({
      decision: 'approve_with_edits',
      editedArgs: { force: false, files: ['src/a.ts'] },
      remember: false,
    });
  });

  test('preserves null arguments when approving with edits without changes', async () => {
    const onresolve = mock();
    const { getByLabelText, getByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onresolve,
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

    expect(onresolve).toHaveBeenCalledWith({
      decision: 'approve_with_edits',
      editedArgs: null,
      remember: false,
    });
  });

  test('hides the edit panel and blocks the resolution when editableArgs is disabled after the editor was opened', async () => {
    const onresolve = mock();
    const view = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onresolve,
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
        onresolve,
        operation: {
          kind: 'other',
          argsPreview: { force: false },
        },
      }),
    });

    expect(view.queryByLabelText('Edited arguments JSON')).toBeNull();
    expect(view.queryByRole('button', { name: 'Confirm edited approval' })).toBeNull();
    expect(onresolve).not.toHaveBeenCalled();
  });

  test('does not offer edited approval when no preview is provided', () => {
    const { queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        operation: {
          kind: 'other',
        },
      }),
    });

    expect(queryByRole('button', { name: 'Approve with edits' })).toBeNull();
  });

  test('reseeds editable arguments when the approval request changes', async () => {
    const onresolve = mock();
    const view = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onresolve,
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
        onresolve,
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
  });

  test('closes the edit panel when argsPreview changes for the SAME approval request', async () => {
    const onresolve = mock();
    const view = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onresolve,
        idempotencyKey: 'approval-one',
        operation: {
          kind: 'other',
          argsPreview: { force: false },
        },
      }),
    });

    await fireEvent.click(view.getByRole('button', { name: 'Approve with edits' }));
    expect(view.getByLabelText('Edited arguments JSON')).toBeTruthy();

    // Same idempotencyKey — the host revised the live arguments (e.g. a
    // websocket update) while the editor was open, not a new request.
    await view.rerender({
      ...approvalCardProps({
        editableArgs: true,
        onresolve,
        idempotencyKey: 'approval-one',
        operation: {
          kind: 'other',
          argsPreview: { force: true },
        },
      }),
    });

    expect(view.queryByLabelText('Edited arguments JSON')).toBeNull();

    await fireEvent.click(view.getByRole('button', { name: 'Approve with edits' }));
    const reopenedTextarea = view.getByLabelText('Edited arguments JSON') as HTMLTextAreaElement;
    expect(reopenedTextarea.value).toContain('"force": true');
  });

  test('closes the edit panel when the request changes even if the new arguments serialize identically', async () => {
    const onresolve = mock();
    const view = render(ApprovalCard, {
      ...approvalCardProps({
        editableArgs: true,
        onresolve,
        idempotencyKey: 'approval-one',
        operation: {
          kind: 'other',
          argsPreview: { force: false },
        },
      }),
    });

    await fireEvent.click(view.getByRole('button', { name: 'Approve with edits' }));
    expect(view.getByLabelText('Edited arguments JSON')).toBeTruthy();

    // A genuinely NEW request (different idempotencyKey) whose arguments
    // happen to serialize to the exact same text as the previous request's.
    // The argumentsValue-snapshot comparison alone wouldn't see a change
    // here — the identity change itself must still close the editor.
    await view.rerender({
      ...approvalCardProps({
        editableArgs: true,
        onresolve,
        idempotencyKey: 'approval-two',
        operation: {
          kind: 'other',
          argsPreview: { force: false },
        },
      }),
    });

    expect(view.queryByLabelText('Edited arguments JSON')).toBeNull();
  });

  test('displays and copies a string argsPreview as the original, un-quoted value', async () => {
    const writeText = mock(async () => undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      const { container, getByRole } = render(ApprovalCard, {
        ...approvalCardProps({
          operation: {
            kind: 'other',
            argsPreview: '--force',
          },
        }),
      });

      const primitive = container.querySelector('.cinder-payload-inspector__primitive');
      expect(primitive?.textContent?.trim()).toBe('--force');
      expect(container.textContent).not.toContain('"--force"');

      const copyButton = getByRole('button', { name: 'Copy deploy-cloud arguments' });
      await fireEvent.click(copyButton);
      expect(writeText).toHaveBeenCalledWith('--force');
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  test('scopes the arguments copy button name to the tool, so multiple cards on one page stay unambiguous', () => {
    render(ApprovalCard, {
      ...approvalCardProps({ tool: { name: 'deploy-cloud', risk: 'medium' } }),
    });
    render(ApprovalCard, {
      ...approvalCardProps({ tool: { name: 'rotate-secret', risk: 'high' } }),
    });

    expect(
      document.body.querySelector('[aria-label="Copy deploy-cloud arguments"]'),
    ).not.toBeNull();
    expect(
      document.body.querySelector('[aria-label="Copy rotate-secret arguments"]'),
    ).not.toBeNull();
  });

  test('truncates large argument previews and renders every touched file', () => {
    const filesTouched = Array.from({ length: 8 }, (_, index) => `src/file-${index + 1}.ts`);
    const { container } = render(ApprovalCard, {
      ...approvalCardProps({
        operation: {
          kind: 'file-write',
          filesTouched,
          argsPreview: { payload: `start-${'x'.repeat(10_000)}` },
        },
      }),
    });

    expect(container.textContent).toContain('Truncated');
    expect(container.textContent).toContain('8 files');
    for (const file of filesTouched) {
      expect(container.textContent).toContain(file);
    }
  });

  test('collapses duplicate touched files into a single row', () => {
    const { container } = render(ApprovalCard, {
      ...approvalCardProps({
        operation: {
          kind: 'file-write',
          filesTouched: ['src/repeated.ts', 'src/repeated.ts'],
        },
      }),
    });

    expect(
      Array.from(container.querySelectorAll('.cinder-approval-card__file-path')).map((item) =>
        item.textContent?.trim(),
      ),
    ).toEqual(['src/repeated.ts']);
    expect(container.textContent).toContain('1 file');
    expect(container.textContent).not.toContain('1 files');
  });

  test('renders a copy button for each touched file path', async () => {
    const writeText = mock(async () => undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      const { getByRole } = render(ApprovalCard, {
        ...approvalCardProps({
          operation: {
            kind: 'file-write',
            filesTouched: ['src/new-file.ts'],
          },
        }),
      });

      await fireEvent.click(getByRole('button', { name: 'Copy path src/new-file.ts' }));
      expect(writeText).toHaveBeenCalledWith('src/new-file.ts');
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
  });

  test('renders environment names as plain text without leaking supplied values', async () => {
    const { container, getByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        env: ['DATABASE_URL=postgres://fake-secret-value', 'ANTHROPIC_API_KEY'],
      }),
    });

    await fireEvent.click(getByRole('button', { name: 'Details' }));

    expect(container.textContent).toContain('DATABASE_URL');
    expect(container.textContent).toContain('ANTHROPIC_API_KEY');
    expect(
      container
        .querySelector('.cinder-approval-card__environment-list')
        ?.getAttribute('aria-label'),
    ).toContain('values are never shown');
    expect(container.innerHTML).not.toContain('postgres://fake-secret-value');
    expect(container.querySelector('.cinder-secret-value-field')).toBeNull();
  });

  test('deduplicates sanitized environment names', async () => {
    const { container, getByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        env: [
          'DATABASE_URL=postgres://fake-secret-value',
          'DATABASE_URL',
          'DATABASE_URL=postgres://other-fake-secret-value',
        ],
      }),
    });

    await fireEvent.click(getByRole('button', { name: 'Details' }));

    const items = Array.from(
      container.querySelectorAll('.cinder-approval-card__environment-list li'),
    );
    expect(items).toHaveLength(1);
    expect(container.innerHTML).not.toContain('postgres://fake-secret-value');
    expect(container.innerHTML).not.toContain('postgres://other-fake-secret-value');
  });

  test('renders commands with a CodeBlock and no language header chip', () => {
    const { container } = render(ApprovalCard, {
      ...approvalCardProps({
        operation: {
          kind: 'command',
          command: 'bun run components:check',
          argsPreview: { package: '@lostgradient/cinder' },
        },
      }),
    });

    const codeBlock = container.querySelector<HTMLElement>('.cinder-code-block');
    expect(codeBlock).not.toBeNull();
    expect(codeBlock?.querySelector('.cinder-code-block__language')).toBeNull();
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
    expect(codeBlock?.querySelector('.cinder-code-block__language')).toBeNull();
    expect(container.textContent).toContain('diff --git a/src/approval.ts b/src/approval.ts');
    expect(container.textContent).toContain('export const approved = true;');
  });

  test('collapses sandbox, environment, and request metadata into one Details disclosure', async () => {
    const { container, getByRole } = render(ApprovalCard, { ...approvalCardProps() });

    const trigger = getByRole('button', { name: 'Details' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('/workspace/project');
    expect(container.textContent).not.toContain('DATABASE_URL');
    expect(container.textContent).not.toContain('policy-2026-06');

    await fireEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('/workspace/project');
    expect(container.textContent).toContain('workspace-write');
    expect(container.textContent).toContain('DATABASE_URL');
    expect(container.textContent).toContain('policy-2026-06');
    expect(container.textContent).toContain('approval-card-test-key');
    expect(container.textContent).toContain('snapshot-123');
  });

  test('transitions pending approvals to an expired read-only state without firing callbacks', async () => {
    const now = new Date('2026-06-24T12:00:00.000Z');
    jest.useFakeTimers({ now });

    const onresolve = mock();
    const { getByRole, getByText, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        expiresAt: new Date(now.getTime() + 1_000).toISOString(),
        onresolve,
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
    expect(onresolve).not.toHaveBeenCalled();
  });

  test('blocks resolutions at the exact expiration deadline', async () => {
    const now = new Date('2026-06-24T12:00:00.000Z');
    jest.useFakeTimers({ now });
    const onresolve = mock();

    const { getByRole, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        expiresAt: new Date(now.getTime() + 250).toISOString(),
        onresolve,
      }),
    });

    await tick();
    const approveButton = getByRole('button', { name: 'Approve' });

    jest.advanceTimersByTime(250);
    await fireEvent.click(approveButton);

    expect(onresolve).not.toHaveBeenCalled();

    await tick();
    expect(queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  test('syncs the visible expired state when an overdue action is attempted before the timer fires', async () => {
    const now = new Date('2026-06-24T12:00:00.000Z').getTime();
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(now);
    const onresolve = mock();

    const { getByRole, getByText, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        expiresAt: new Date(now + 60_000).toISOString(),
        onresolve,
      }),
    });

    await tick();
    const approveButton = getByRole('button', { name: 'Approve' });

    dateNow.mockReturnValue(now + 60_001);
    await fireEvent.click(approveButton);
    await tick();

    expect(onresolve).not.toHaveBeenCalled();
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
    const onresolve = mock();

    const { getByRole, queryByText } = render(ApprovalCard, {
      ...approvalCardProps({
        expiresAt: 'not-an-iso-date',
        onresolve,
      }),
    });

    await tick();

    expect(
      queryByText('No approval actions are available because this request is expired.'),
    ).toBeNull();
    expect(getByRole('img', { name: 'Pending' })).toBeTruthy();

    await fireEvent.click(getByRole('button', { name: 'Approve' }));

    expect(onresolve).toHaveBeenCalledWith({ decision: 'approve', remember: false });
  });

  test('renders already-expired approvals read-only on the initial render', () => {
    const now = new Date('2026-06-24T12:00:00.000Z');
    jest.useFakeTimers({ now });

    const { getByRole, getByText, queryByRole } = render(ApprovalCard, {
      ...approvalCardProps({
        expiresAt: new Date(now.getTime() - 1_000).toISOString(),
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
        container
          .querySelector('.cinder-approval-card__readonly-summary')
          ?.getAttribute('data-cinder-state'),
      ).toBe(state);
      expect(queryByRole('group', { name: 'Approval actions' })).toBeNull();
      unmount();
    }
  });
});
