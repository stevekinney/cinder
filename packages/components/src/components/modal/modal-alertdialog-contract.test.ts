/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { resetScrollLock } from '../../_internal/overlay.ts';
import { emptySnippet, installModalDialogStubs } from './modal-test-helpers.ts';

setupHappyDom();
installModalDialogStubs();
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: Modal } = await import('./modal.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
});
describe('Modal', () => {
  test('DEV warning fires when role="alertdialog" is used without companion dismiss flags', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      render(Modal, {
        props: {
          open: true,
          title: 'Session expired',
          role: 'alertdialog',
          describedById: 'session-description',
          // dismissOnBackdropClick and dismissOnEscape intentionally left at their defaults (true)
          // to trigger the dev warning about the broken alertdialog contract
          children: emptySnippet,
        },
      });
      expect(warnings.some((warning) => warning.includes('[cinder/Modal]'))).toBe(true);
      expect(warnings.some((warning) => warning.includes('role="alertdialog"'))).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });
  test('DEV warning does NOT fire when role="alertdialog" has all companion flags set correctly', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      render(Modal, {
        props: {
          open: true,
          title: 'Session expired',
          role: 'alertdialog',
          dismissOnBackdropClick: false,
          dismissOnEscape: false,
          closeButtonVisible: false,
          describedById: 'session-description',
          children: emptySnippet,
        },
      });
      expect(warnings.some((warning) => warning.includes('[cinder/Modal]'))).toBe(false);
    } finally {
      console.warn = originalWarn;
    }
  });
  test('role="alertdialog" with both dismiss flags off is the sticky alertdialog contract', async () => {
    // Documents the manual composition required when using Modal's role="alertdialog"
    // escape hatch: both dismiss flags must be false to satisfy the alertdialog contract.
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Session expired',
        role: 'alertdialog',
        describedById: 'manual-desc',
        dismissOnBackdropClick: false,
        dismissOnEscape: false,
        closeButtonVisible: false,
        children: emptySnippet,
      },
    });

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    expect(dialog?.getAttribute('role')).toBe('alertdialog');

    // Neither Escape (native cancel event) nor backdrop click should dismiss.
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(openValue).toBe(true);

    await fireEvent.click(dialog);
    expect(openValue).toBe(true);

    // No close button rendered when closeButtonVisible=false.
    expect(container.querySelector('.cinder-modal__close')).toBeNull();
  });
});
