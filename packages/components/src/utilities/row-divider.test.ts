/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { rowDividerAttachment } from './row-divider.ts';

setupHappyDom();

afterEach(() => {
  document.body.replaceChildren();
});

function row(className = 'cinder-_row-item'): HTMLDivElement {
  const element = document.createElement('div');
  element.className = className;
  return element;
}

async function flushMutations(): Promise<void> {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
}

describe('rowDividerAttachment', () => {
  test('marks only rows with a visible later sibling before the nearest separator', async () => {
    const parent = document.createElement('div');
    const first = row();
    const second = row();
    const hidden = row();
    hidden.hidden = true;
    const separator = document.createElement('div');
    separator.className = 'cinder-dropdown-separator';
    const afterSeparator = row();
    parent.append(first, second, hidden, separator, afterSeparator);
    document.body.append(parent);

    const cleanupFirst = rowDividerAttachment(first);
    const cleanupSecond = rowDividerAttachment(second);
    const cleanupHidden = rowDividerAttachment(hidden);
    const cleanupAfterSeparator = rowDividerAttachment(afterSeparator);

    expect(first.hasAttribute('data-cinder-row-divider')).toBe(true);
    expect(second.hasAttribute('data-cinder-row-divider')).toBe(false);
    expect(hidden.hasAttribute('data-cinder-row-divider')).toBe(false);
    expect(afterSeparator.hasAttribute('data-cinder-row-divider')).toBe(false);

    second.setAttribute('hidden', '');
    await flushMutations();
    expect(first.hasAttribute('data-cinder-row-divider')).toBe(false);

    second.removeAttribute('hidden');
    await flushMutations();
    expect(first.hasAttribute('data-cinder-row-divider')).toBe(true);

    second.remove();
    await flushMutations();
    expect(first.hasAttribute('data-cinder-row-divider')).toBe(false);

    cleanupFirst?.();
    cleanupSecond?.();
    cleanupHidden?.();
    cleanupAfterSeparator?.();
  });

  test('keeps nested parent boundaries independent and cleans up on detach', () => {
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    const outerFirst = row();
    const innerFirst = row();
    const innerLast = row();
    outer.append(outerFirst, inner);
    inner.append(innerFirst, innerLast);
    document.body.append(outer);

    const cleanupOuter = rowDividerAttachment(outerFirst);
    const cleanupInnerFirst = rowDividerAttachment(innerFirst);
    const cleanupInnerLast = rowDividerAttachment(innerLast);

    expect(outerFirst.hasAttribute('data-cinder-row-divider')).toBe(false);
    expect(innerFirst.hasAttribute('data-cinder-row-divider')).toBe(true);
    expect(innerLast.hasAttribute('data-cinder-row-divider')).toBe(false);

    cleanupOuter?.();
    cleanupInnerFirst?.();
    cleanupInnerLast?.();
    expect(innerFirst.hasAttribute('data-cinder-row-divider')).toBe(false);
  });
});
