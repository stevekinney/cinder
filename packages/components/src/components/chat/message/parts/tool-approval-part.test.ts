/**
 * Tests for tool-approval-part.svelte (C3).
 *
 * Covers:
 *   1. Pending state — renders a labelled role="group" with tool name, action
 *      message, Approve and Reject buttons (inline item, not a modal alertdialog).
 *   2. Approved state — renders approved chip with no buttons.
 *   3. Denied state — renders denied chip with no buttons.
 *   4. Approve button fires the onapprove callback.
 *   5. Reject button fires the ondeny callback.
 *   6. Escape key fires the ondeny callback when pending.
 *   7. Double-resolution guard — once approved, subsequent Escape/Reject is
 *      NOT re-fired (guarded by the parent, but the Escape handler in the
 *      component also guards isPending).
 *   8. Buttons are disabled when no callbacks are provided.
 *   9. Accessibility — role="group", tabindex="-1", no autofocus,
 *      aria-labelledby, aria-describedby.
 *  10. Collapsible args are rendered when action.schema is present.
 */

/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { flushSync } from 'svelte';

import { setupHappyDom } from '../../../../test/happy-dom.ts';
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
    },
    approved: undefined,
    ...overrides,
  };
}

describe('ToolApprovalPart — pending state', () => {
  test('renders as role="group" (inline item, not a focus-stealing alertdialog)', () => {
    const { container } = render(ToolApprovalPart, { props: { part: pendingPart() } });
    const dialog = container.querySelector('[data-cinder-tool-approval]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('role')).toBe('group');
    // Must NOT claim alertdialog — that role implies modal/interruption semantics
    // and would let historical/virtualized pending rows steal focus on render.
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
  });

  test('container is programmatically focusable (tabindex=-1) for reliable Escape', () => {
    const { container } = render(ToolApprovalPart, { props: { part: pendingPart() } });
    const dialog = container.querySelector('[data-cinder-tool-approval]');
    expect(dialog?.getAttribute('tabindex')).toBe('-1');
  });

  test('Approve button is not autofocused (no focus theft on render)', () => {
    const { container } = render(ToolApprovalPart, {
      props: { part: pendingPart(), onapprove: mock(() => {}) },
    });
    const approve = container.querySelector('.chat-tool-approval-btn-approve');
    expect(approve?.hasAttribute('autofocus')).toBe(false);
  });

  test('renders aria-labelledby pointing to the title element', () => {
    const { container } = render(ToolApprovalPart, { props: { part: pendingPart() } });
    const dialog = container.querySelector('[data-cinder-tool-approval]');
    const labelId = dialog?.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    const labelElement = labelId ? container.querySelector(`#${labelId}`) : null;
    expect(labelElement).not.toBeNull();
    expect(labelElement?.textContent).toContain('deploy_to_production');
  });

  test('renders aria-describedby pointing to the message element', () => {
    const { container } = render(ToolApprovalPart, { props: { part: pendingPart() } });
    const dialog = container.querySelector('[data-cinder-tool-approval]');
    const descId = dialog?.getAttribute('aria-describedby');
    expect(descId).toBeTruthy();
    const descElement = descId ? container.querySelector(`#${descId}`) : null;
    expect(descElement).not.toBeNull();
    expect(descElement?.textContent).toContain('Deploy to production?');
  });

  test('renders the tool name in a code element', () => {
    const { container } = render(ToolApprovalPart, { props: { part: pendingPart() } });
    const code = container.querySelector('code');
    expect(code?.textContent).toContain('deploy_to_production');
  });

  test('renders Approve and Reject buttons when callbacks are provided', () => {
    const { container } = render(ToolApprovalPart, {
      props: { part: pendingPart(), onapprove: mock(() => {}), ondeny: mock(() => {}) },
    });
    const buttons = container.querySelectorAll('button');
    const labels = Array.from(buttons).map((button) => button.textContent?.trim());
    expect(labels).toContain('Approve');
    expect(labels).toContain('Reject');
  });

  test('buttons are disabled when no callbacks provided', () => {
    const { container } = render(ToolApprovalPart, { props: { part: pendingPart() } });
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    for (const button of buttons) {
      expect(button.disabled).toBe(true);
    }
  });

  test('has data-cinder-status="pending"', () => {
    const { container } = render(ToolApprovalPart, { props: { part: pendingPart() } });
    const dialog = container.querySelector('[data-cinder-tool-approval]');
    expect(dialog?.getAttribute('data-cinder-status')).toBe('pending');
  });

  test('shows action message with fallback when none provided', () => {
    const part = pendingPart();
    // No message set in action — use default fallback
    part.action = { type: 'approval' };
    const { container } = render(ToolApprovalPart, { props: { part } });
    expect(container.textContent).toContain('requires your approval');
  });
});

describe('ToolApprovalPart — Approve button', () => {
  test('clicking Approve fires the onapprove callback with the toolCallId', () => {
    const onapprove = mock((id: string) => id);
    const { container } = render(ToolApprovalPart, {
      props: { part: pendingPart(), onapprove, ondeny: mock(() => {}) },
    });
    const approveButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Approve',
    );
    expect(approveButton).not.toBeNull();
    approveButton && fireEvent.click(approveButton);
    flushSync();
    expect(onapprove).toHaveBeenCalledTimes(1);
    expect(onapprove).toHaveBeenCalledWith('call-1');
  });

  test('clicking Approve does NOT fire ondeny', () => {
    const onapprove = mock(() => {});
    const ondeny = mock(() => {});
    const { container } = render(ToolApprovalPart, {
      props: { part: pendingPart(), onapprove, ondeny },
    });
    const approveButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Approve',
    );
    approveButton && fireEvent.click(approveButton);
    flushSync();
    expect(ondeny).toHaveBeenCalledTimes(0);
  });
});

describe('ToolApprovalPart — Reject button', () => {
  test('clicking Reject fires the ondeny callback with the toolCallId', () => {
    const ondeny = mock((id: string) => id);
    const { container } = render(ToolApprovalPart, {
      props: { part: pendingPart(), onapprove: mock(() => {}), ondeny },
    });
    const denyButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Reject',
    );
    expect(denyButton).not.toBeNull();
    denyButton && fireEvent.click(denyButton);
    flushSync();
    expect(ondeny).toHaveBeenCalledTimes(1);
    expect(ondeny).toHaveBeenCalledWith('call-1');
  });

  test('clicking Reject does NOT fire onapprove', () => {
    const onapprove = mock(() => {});
    const ondeny = mock(() => {});
    const { container } = render(ToolApprovalPart, {
      props: { part: pendingPart(), onapprove, ondeny },
    });
    const denyButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Reject',
    );
    denyButton && fireEvent.click(denyButton);
    flushSync();
    expect(onapprove).toHaveBeenCalledTimes(0);
  });
});

describe('ToolApprovalPart — Escape key', () => {
  test('pressing Escape fires ondeny when pending', () => {
    const ondeny = mock((id: string) => id);
    const { container } = render(ToolApprovalPart, {
      props: { part: pendingPart(), onapprove: mock(() => {}), ondeny },
    });
    const dialog = container.querySelector('[data-cinder-tool-approval]');
    dialog && fireEvent.keyDown(dialog, { key: 'Escape' });
    flushSync();
    expect(ondeny).toHaveBeenCalledTimes(1);
    expect(ondeny).toHaveBeenCalledWith('call-1');
  });

  test('pressing Escape does NOT fire ondeny when already approved', () => {
    const ondeny = mock(() => {});
    const { container } = render(ToolApprovalPart, {
      props: {
        part: pendingPart({ approved: true }),
        onapprove: mock(() => {}),
        ondeny,
      },
    });
    const dialog = container.querySelector('[data-cinder-tool-approval]');
    dialog && fireEvent.keyDown(dialog, { key: 'Escape' });
    flushSync();
    expect(ondeny).toHaveBeenCalledTimes(0);
  });

  test('pressing Escape does NOT fire ondeny when already denied', () => {
    const ondeny = mock(() => {});
    const { container } = render(ToolApprovalPart, {
      props: {
        part: pendingPart({ approved: false }),
        onapprove: mock(() => {}),
        ondeny,
      },
    });
    const dialog = container.querySelector('[data-cinder-tool-approval]');
    dialog && fireEvent.keyDown(dialog, { key: 'Escape' });
    flushSync();
    expect(ondeny).toHaveBeenCalledTimes(0);
  });
});

describe('ToolApprovalPart — resolved states', () => {
  test('approved state: has data-cinder-status="approved" and no buttons', () => {
    const { container } = render(ToolApprovalPart, {
      props: { part: pendingPart({ approved: true }) },
    });
    const dialog = container.querySelector('[data-cinder-tool-approval]');
    expect(dialog?.getAttribute('data-cinder-status')).toBe('approved');
    // No action buttons when resolved
    expect(container.querySelector('.chat-tool-approval-actions')).toBeNull();
  });

  test('approved state: title contains "Approved"', () => {
    const { container } = render(ToolApprovalPart, {
      props: { part: pendingPart({ approved: true }) },
    });
    const title = container.querySelector('[id*="tool-approval-label"]');
    expect(title?.textContent).toContain('Approved');
  });

  test('approve button uses the defined success contrast token', async () => {
    const source = await Bun.file(new URL('./tool-approval-part.svelte', import.meta.url)).text();

    expect(source).toContain('color: var(--cinder-success-contrast, var(--cinder-text))');
    expect(source).not.toContain('--cinder-color-success-contrast');
  });

  test('denied state: has data-cinder-status="denied" and no buttons', () => {
    const { container } = render(ToolApprovalPart, {
      props: { part: pendingPart({ approved: false }) },
    });
    const dialog = container.querySelector('[data-cinder-tool-approval]');
    expect(dialog?.getAttribute('data-cinder-status')).toBe('denied');
    expect(container.querySelector('.chat-tool-approval-actions')).toBeNull();
  });

  test('denied state: title contains "Denied"', () => {
    const { container } = render(ToolApprovalPart, {
      props: { part: pendingPart({ approved: false }) },
    });
    const title = container.querySelector('[id*="tool-approval-label"]');
    expect(title?.textContent).toContain('Denied');
  });
});

describe('ToolApprovalPart — collapsible args', () => {
  test('renders a details/summary when action.schema is present', () => {
    const part = pendingPart({
      action: { type: 'approval', message: 'Proceed?', schema: { env: 'production' } },
    });
    const { container } = render(ToolApprovalPart, { props: { part } });
    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    const pre = container.querySelector('pre');
    expect(pre?.textContent).toContain('production');
  });

  test('does not render details/summary when action.schema is absent', () => {
    const { container } = render(ToolApprovalPart, { props: { part: pendingPart() } });
    expect(container.querySelector('details')).toBeNull();
  });
});
