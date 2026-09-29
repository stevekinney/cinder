/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { flushSync } from 'svelte';

import type { ApprovalCardProps, ApprovalResolution } from '@lostgradient/cinder';
import { setupHappyDom } from '@lostgradient/testing';
import type { ToolApprovalMessagePart } from '../../utilities/types.ts';

setupHappyDom();

const { render, cleanup, fireEvent } = await import('@testing-library/svelte');
const { default: ToolApprovalPart } = await import('./tool-approval-part.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function pendingPart(overrides?: Partial<ToolApprovalMessagePart>): ToolApprovalMessagePart {
  return {
    type: 'tool-approval',
    key: 'm:tool-approval:call-1',
    toolCallId: 'call-1',
    toolName: 'deploy_to_production',
    action: {
      type: 'approval',
      message: 'Deploy to production?',
      risk: 'high',
      operation: {
        kind: 'command',
        command: 'deploy_to_production --environment production',
        filesTouched: ['applications/chat-room/deployments/production.json'],
        argsPreview: { environment: 'production', replicas: 3 },
      },
      sandbox: {
        provider: 'Corvidae',
        name: 'production-release',
        workingDir: '/workspace/corvidae',
      },
      env: ['DEPLOY_TOKEN'],
      snapshotId: 'snapshot-1',
      expiresAt: '2999-01-01T00:00:00.000Z',
      editableArgs: true,
      policyVersion: 'test-policy',
      idempotencyKey: 'test-approval',
    },
    state: 'pending',
    resolutionInFlight: false,
    ...overrides,
  };
}

describe('ToolApprovalPart', () => {
  test('maps approval operation directly to the shared Cinder card operation contract', () => {
    const part = pendingPart();
    const operation: ApprovalCardProps['operation'] = part.action.operation;

    expect(operation).toBe(part.action.operation);
  });
  test('renders the shared Cinder approval card with mapped approval metadata', async () => {
    const { container, getByRole } = render(ToolApprovalPart, { props: { part: pendingPart() } });
    const card = container.querySelector('.cinder-approval-card');

    expect(card).not.toBeNull();
    expect(card?.getAttribute('data-cinder-tool-approval')).toBe('true');
    expect(card?.getAttribute('data-cinder-state')).toBe('pending');
    expect(card?.getAttribute('data-cinder-risk')).toBe('high');
    expect(container.textContent).toContain('deploy_to_production');
    expect(container.textContent).toContain('deploy_to_production --environment production');

    await fireEvent.click(getByRole('button', { name: 'Details' }));
    flushSync();

    expect(container.textContent).toContain('DEPLOY_TOKEN');
    expect(container.textContent).toContain('test-policy');
    expect(container.textContent).toContain('test-approval');
  });

  test('approve forwards the exact approval resolution payload', async () => {
    const resolutions: { toolCallId: string; resolution: ApprovalResolution }[] = [];
    const { getByRole } = render(ToolApprovalPart, {
      props: {
        part: pendingPart(),
        onApprovalResolve: (toolCallId, resolution) => {
          resolutions.push({ toolCallId, resolution });
        },
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Approve' }));
    flushSync();

    expect(resolutions).toEqual([
      { toolCallId: 'call-1', resolution: { decision: 'approve', remember: false } },
    ]);
  });

  test('deny preserves reason and remember in the resolution payload', async () => {
    const resolutions: { toolCallId: string; resolution: ApprovalResolution }[] = [];
    const { getByRole, getByLabelText } = render(ToolApprovalPart, {
      props: {
        part: pendingPart(),
        onApprovalResolve: (toolCallId, resolution) => {
          resolutions.push({ toolCallId, resolution });
        },
      },
    });

    await fireEvent.input(getByLabelText('Reason'), { target: { value: 'Too risky.' } });
    await fireEvent.click(getByLabelText("Don't ask again for operations like this"));
    await fireEvent.click(getByRole('button', { name: 'Deny' }));
    flushSync();

    expect(resolutions).toEqual([
      {
        toolCallId: 'call-1',
        resolution: { decision: 'deny', reason: 'Too risky.', remember: true },
      },
    ]);
  });

  test('omits approval actions when no resolution callback is available', () => {
    const { queryByRole } = render(ToolApprovalPart, { props: { part: pendingPart() } });

    expect(queryByRole('group', { name: 'Approval actions' })).toBeNull();
    expect(queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(queryByRole('button', { name: 'Deny' })).toBeNull();
  });

  test('does not steal focus and keeps the card programmatically focusable with an accessible heading', () => {
    const before = document.createElement('button');
    before.type = 'button';
    before.textContent = 'Before approval';
    document.body.append(before);
    before.focus();

    const { container, getByRole } = render(ToolApprovalPart, {
      props: { part: pendingPart(), onApprovalResolve: () => undefined },
    });

    expect(document.activeElement).toBe(before);
    const heading = container.querySelector('h4.cinder-approval-card__title');
    if (!(heading instanceof HTMLElement)) throw new Error('Missing approval card heading');
    expect(heading.textContent).toContain('deploy_to_production');
    const card = getByRole('article', { name: 'Approval required for deploy_to_production' });
    expect(card.getAttribute('aria-labelledby')).toBe(heading.id);

    card.focus();
    expect(document.activeElement).toBe(card);
  });

  test('Escape forwards cancel with remember false while pending', async () => {
    const onApprovalResolve = mock(() => undefined);
    const { container } = render(ToolApprovalPart, {
      props: { part: pendingPart(), onApprovalResolve },
    });

    const card = container.querySelector('[data-cinder-tool-approval]');
    card && (await fireEvent.keyDown(card, { key: 'Escape' }));
    flushSync();

    expect(onApprovalResolve).toHaveBeenCalledWith('call-1', {
      decision: 'cancel',
      remember: false,
    });
  });

  test('does not forward resolutions for in-flight or terminal cards', async () => {
    const onApprovalResolve = mock(() => undefined);
    const inFlight = render(ToolApprovalPart, {
      props: { part: pendingPart({ resolutionInFlight: true }), onApprovalResolve },
    });
    expect(inFlight.queryByRole('button', { name: 'Approve' })).toBeNull();
    inFlight.unmount();

    const terminal = render(ToolApprovalPart, {
      props: { part: pendingPart({ state: 'approved' }), onApprovalResolve },
    });
    expect(terminal.queryByRole('button', { name: 'Approve' })).toBeNull();
    const card = terminal.container.querySelector('[data-cinder-tool-approval]');
    card && (await fireEvent.keyDown(card, { key: 'Escape' }));
    flushSync();

    expect(onApprovalResolve).toHaveBeenCalledTimes(0);
  });

  test('keeps presentation in Cinder instead of local approval styles', async () => {
    const source = await Bun.file(new URL('./tool-approval-part.svelte', import.meta.url)).text();

    expect(source).toContain('ApprovalCard');
    expect(source).not.toContain('<style>');
    expect(source).not.toContain('.chat-tool-approval');
  });
});
