/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { getSequentialFocusTargets } = await import('./focus.ts');

afterEach(() => {
  // Blur any lingering focus so each test starts clean.
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  // Drop any test-added buttons.
  for (const button of document.body.querySelectorAll('button')) {
    button.remove();
  }
});

describe('getSequentialFocusTargets', () => {
  test('includes only the first summary in a details element', () => {
    const region = document.createElement('div');
    const details = document.createElement('details');
    const first = document.createElement('summary');
    first.setAttribute('tabindex', '0');
    const second = document.createElement('summary');
    const standalone = document.createElement('summary');
    details.append(first, second);
    region.append(details, standalone);
    document.body.append(region);

    expect(getSequentialFocusTargets(region)).toContain(first);
    expect(getSequentialFocusTargets(region)).not.toContain(second);
    expect(getSequentialFocusTargets(region)).not.toContain(standalone);
    region.remove();
  });

  test('includes a standalone summary when an explicit tabindex opts it in', () => {
    const region = document.createElement('div');
    const summary = document.createElement('summary');
    summary.tabIndex = 0;
    region.append(summary);
    document.body.append(region);

    expect(getSequentialFocusTargets(region)).toContain(summary);
    region.remove();
  });

  test('skips controls inside closed details but includes them when open', () => {
    const region = document.createElement('div');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.setAttribute('tabindex', '0');
    const button = document.createElement('button');
    button.setAttribute('tabindex', '0');
    details.append(summary, button);
    region.append(details);
    document.body.append(region);

    expect(getSequentialFocusTargets(region)).toContain(summary);
    expect(getSequentialFocusTargets(region)).not.toContain(button);
    details.open = true;
    expect(getSequentialFocusTargets(region)).toContain(button);
    region.remove();
  });

  test('skips nested controls when an outer details element is closed', () => {
    const region = document.createElement('div');
    const outer = document.createElement('details');
    const outerSummary = document.createElement('summary');
    outerSummary.setAttribute('tabindex', '0');
    const inner = document.createElement('details');
    const innerSummary = document.createElement('summary');
    innerSummary.setAttribute('tabindex', '0');
    const button = document.createElement('button');
    inner.append(innerSummary, button);
    outer.append(outerSummary, inner);
    region.append(outer);
    document.body.append(region);

    expect(getSequentialFocusTargets(region)).toContain(outerSummary);
    expect(getSequentialFocusTargets(region)).not.toContain(innerSummary);
    expect(getSequentialFocusTargets(region)).not.toContain(button);
    region.remove();
  });

  test('keeps controls nested inside the active summary of closed details', () => {
    const region = document.createElement('div');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const link = document.createElement('a');
    link.href = '#summary-link';
    summary.append(link);
    details.append(summary, document.createElement('button'));
    region.append(details);
    document.body.append(region);

    const targets = getSequentialFocusTargets(region);
    expect(targets).toContain(summary);
    expect(targets).toContain(link);
    region.remove();
  });

  test('keeps shadow descendants nested inside the active summary', () => {
    const region = document.createElement('div');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const host = document.createElement('span');
    const shadow = host.attachShadow({ mode: 'open' });
    const button = document.createElement('button');
    shadow.append(button);
    summary.append(host);
    details.append(summary, document.createElement('button'));
    region.append(details);
    document.body.append(region);

    expect(getSequentialFocusTargets(region)).toContain(button);
    region.remove();
  });

  test('skips controls in a closed details element without a summary', () => {
    const region = document.createElement('div');
    const details = document.createElement('details');
    const button = document.createElement('button');
    details.append(button);
    region.append(details);
    document.body.append(region);

    expect(getSequentialFocusTargets(region)).not.toContain(button);
    region.remove();
  });
});
