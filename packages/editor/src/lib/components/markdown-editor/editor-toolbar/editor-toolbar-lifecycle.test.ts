/// <reference lib="dom" />
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { tick } from 'svelte';

import {
  RecordingResizeObserver,
  actionsSnippet,
  configureMeasurements,
  emitResize,
  installResizeObserver,
  latestObservedToolbar,
  observedToolbar,
  portaledTextGroup,
  requiredElement,
  restoreResizeObserver,
  setActionMeasurementWidth,
  setMeasuredWidth,
  toolbarElement,
  toolbarProps,
  unmount,
} from './editor-toolbar-lifecycle-fixtures.ts';
import EditorToolbar from './editor-toolbar.svelte';

beforeEach(() => {
  installResizeObserver();
});

afterEach(async () => {
  cleanup();
  document.body.replaceChildren();
  restoreResizeObserver();
  mock.restore();
});

describe('EditorToolbar lifecycle', () => {
  test('retains one observer when measurement moves formatting groups between locations', async () => {
    const view = render(EditorToolbar, { props: toolbarProps('toolbar-observer-lifetime') });
    await tick();
    expect(RecordingResizeObserver.records).toHaveLength(1);
    const toolbar = toolbarElement('toolbar-observer-lifetime');
    configureMeasurements(toolbar, 1000);
    const record = latestObservedToolbar();
    const observerCount = RecordingResizeObserver.records.length;

    emitResize(record, toolbar, 0);
    await tick();
    expect(toolbar.querySelectorAll('[data-toolbar-flex-group-id]').length).toBe(0);
    expect(record.disconnected).toBe(false);
    expect(RecordingResizeObserver.records).toHaveLength(observerCount);

    emitResize(record, toolbar, 10000);
    await tick();
    expect(toolbar.querySelectorAll('[data-toolbar-flex-group-id]').length).toBe(5);
    expect(record.disconnected).toBe(false);
    expect(RecordingResizeObserver.records).toHaveLength(observerCount);
    await unmount(view);
    expect(record.disconnected).toBe(true);
  });

  test('keeps groups inline before measurement, then applies an explicit zero-width measurement', async () => {
    const view = render(EditorToolbar, { props: toolbarProps('toolbar-zero') });
    await tick();

    const toolbar = toolbarElement('toolbar-zero');
    configureMeasurements(toolbar, 0);
    expect(toolbar.querySelectorAll('[data-toolbar-flex-group-id]').length).toBe(5);
    expect(toolbar.querySelector('button[aria-label="More formatting"]')).toBeNull();

    let record = observedToolbar();
    emitResize(record, toolbar, 0);
    await tick();

    expect(toolbar.querySelectorAll('[data-toolbar-flex-group-id]').length).toBe(0);
    expect(toolbar.querySelector('button[aria-label="More formatting"]')).not.toBeNull();
    await unmount(view);
  });
  test('keeps overflowed leading controls measured while the popover is closed', async () => {
    const view = render(EditorToolbar, { props: toolbarProps('toolbar-leading-measurement') });
    await tick();
    const toolbar = toolbarElement('toolbar-leading-measurement');
    configureMeasurements(toolbar, 1000);
    const leading = requiredElement(
      toolbar.querySelector<HTMLElement>('[data-toolbar-flex-group-id="leading"]'),
    );
    setMeasuredWidth(leading, 80);
    const record = observedToolbar();
    emitResize(record, toolbar, 1000);
    await tick();

    emitResize(record, toolbar, 30);
    await tick();

    expect(toolbar.querySelector('[data-toolbar-flex-group-id="leading"]')).toBeNull();
    expect(document.body.querySelector('[data-toolbar-flex-group-id="leading"]')).toBeNull();
    expect(toolbar.querySelector('button[aria-label="More formatting"]')).not.toBeNull();

    emitResize(record, toolbar, 30);
    await tick();

    expect(toolbar.querySelector('[data-toolbar-flex-group-id="leading"]')).toBeNull();
    expect(document.body.querySelector('[data-toolbar-flex-group-id="leading"]')).toBeNull();
    expect(toolbar.querySelector('button[aria-label="More formatting"]')).not.toBeNull();
    await unmount(view);
  });

  test('observes the replacement leading element when overflow opens the popover', async () => {
    const view = render(EditorToolbar, { props: toolbarProps('toolbar-leading-replacement') });
    await tick();
    const toolbar = toolbarElement('toolbar-leading-replacement');
    configureMeasurements(toolbar, 1000);
    const record = observedToolbar();
    const inlineLeading = requiredElement(
      toolbar.querySelector<HTMLElement>('[data-toolbar-flex-group-id="leading"]'),
    );
    setMeasuredWidth(inlineLeading, 80);
    expect(record.disconnected).toBe(false);
    emitResize(record, toolbar, 1000);
    await tick();

    emitResize(record, toolbar, 30);
    await tick();

    expect(toolbar.querySelector('[data-toolbar-flex-group-id="leading"]')).toBeNull();
    expect(record.unobserved.includes(inlineLeading)).toBe(true);

    const trigger = requiredElement(
      toolbar.querySelector<HTMLButtonElement>('button[aria-label="More formatting"]'),
    );
    trigger.click();
    await tick();

    const portaledLeading = requiredElement(
      [
        ...document.body.querySelectorAll<HTMLElement>('[data-toolbar-flex-group-id="leading"]'),
      ].find((group) => !toolbar.contains(group) && group.closest('.cinder-popover')),
    );
    expect(portaledLeading).not.toBe(inlineLeading);
    expect(record.observed.includes(portaledLeading)).toBe(true);
    expect(record.disconnected).toBe(false);

    await unmount(view);
  });

  test('observes toolbar measurements and disconnects observers and document focus listeners on unmount', async () => {
    const addFocus = spyOn(document, 'addEventListener');
    const removeFocus = spyOn(document, 'removeEventListener');
    const view = render(EditorToolbar, {
      props: { ...toolbarProps('toolbar-cleanup'), actions: actionsSnippet('Cleanup') },
    });
    await tick();

    const record = latestObservedToolbar();
    const toolbar = toolbarElement('toolbar-cleanup');
    const leading = toolbar.querySelector('.toolbar-leading');
    const actionsMeasure = toolbar.querySelector('.toolbar-actions-measure');
    expect(record.observed.includes(toolbar)).toBe(true);
    expect(leading).not.toBeNull();
    expect(actionsMeasure).not.toBeNull();
    if (leading && actionsMeasure) {
      expect(record.observed.includes(leading)).toBe(true);
      expect(record.observed.includes(actionsMeasure)).toBe(true);
    }
    const addedFocusin = addFocus.mock.calls.filter(([type]) => type === 'focusin');
    const addedFocusout = addFocus.mock.calls.filter(([type]) => type === 'focusout');
    expect(addedFocusin.length).toBeGreaterThan(0);
    expect(addedFocusout.length).toBeGreaterThan(0);

    await unmount(view);

    expect(record.disconnected).toBe(true);
    for (const [, listener] of addedFocusin)
      expect(removeFocus.mock.calls.some(([, removed]) => removed === listener)).toBe(true);
    for (const [, listener] of addedFocusout)
      expect(removeFocus.mock.calls.some(([, removed]) => removed === listener)).toBe(true);
  });

  test('observes the current actions measurer as it arrives, is removed, and is re-added', async () => {
    const view = render(EditorToolbar, { props: toolbarProps('toolbar-actions') });
    await tick();
    const toolbar = toolbarElement('toolbar-actions');
    configureMeasurements(toolbar, 240);
    const initialRecord = observedToolbar();
    emitResize(initialRecord, toolbar, 240);
    await tick();
    const initialVisibleGroups = toolbar.querySelectorAll('[data-toolbar-flex-group-id]').length;
    expect(initialVisibleGroups).toBeGreaterThan(0);
    let record = observedToolbar();
    const initialActions = toolbar.querySelector('[data-testid="toolbar-action"]');
    expect(initialActions).toBeNull();

    setActionMeasurementWidth(100);
    await view.rerender({ ...toolbarProps('toolbar-actions'), actions: actionsSnippet('First') });
    await tick();
    expect(toolbar.querySelector('[data-testid="toolbar-action"]')).not.toBeNull();
    record = latestObservedToolbar();
    const firstMeasure = requiredElement(toolbar.querySelector('.toolbar-actions-measure'));
    expect(record.observed.some((element) => element === firstMeasure)).toBe(true);
    await tick();
    expect(toolbar.querySelectorAll('[data-toolbar-flex-group-id]').length).toBeLessThan(
      initialVisibleGroups,
    );

    await view.rerender({ actions: undefined });
    await tick();
    expect(toolbar.querySelector('.toolbar-actions-measure')).toBeNull();
    expect(
      RecordingResizeObserver.records.some((candidate) =>
        candidate.unobserved.some((element) => element === firstMeasure),
      ),
    ).toBe(true);
    expect(toolbar.querySelectorAll('[data-toolbar-flex-group-id]').length).toBe(
      initialVisibleGroups,
    );

    await view.rerender({ ...toolbarProps('toolbar-actions'), actions: actionsSnippet('Second') });
    await tick();
    expect(toolbar.querySelector('[data-testid="toolbar-action"]')).not.toBeNull();
    await tick();
    record = latestObservedToolbar();
    const secondMeasure = requiredElement(toolbar.querySelector('.toolbar-actions-measure'));
    setMeasuredWidth(secondMeasure, 100);
    expect(secondMeasure).not.toBe(firstMeasure);
    expect(record.observed.some((element) => element === secondMeasure)).toBe(true);
    await tick();
    expect(toolbar.querySelectorAll('[data-toolbar-flex-group-id]').length).toBeLessThan(
      initialVisibleGroups,
    );
    await unmount(view);
  });

  test('keeps a focused inline group inline while shrinking, then releases it after focus leaves', async () => {
    const view = render(EditorToolbar, { props: toolbarProps('toolbar-inline-focus') });
    await tick();
    const toolbar = toolbarElement('toolbar-inline-focus');
    configureMeasurements(toolbar, 1000);
    const record = observedToolbar();
    const textGroup = toolbar.querySelector<HTMLElement>(
      '[data-toolbar-flex-group-id="text-formatting"]',
    );
    const bold = requiredElement(
      toolbar.querySelector<HTMLElement>('[data-testid="toolbar-bold"]'),
    );
    expect(textGroup).not.toBeNull();
    bold.focus();
    expect(document.activeElement).toBe(bold);
    emitResize(record, toolbar, 0);
    await tick();
    expect(toolbar.querySelector('[data-toolbar-flex-group-id="text-formatting"]')).not.toBeNull();

    bold.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    emitResize(record, toolbar, 0);
    await tick();
    expect(toolbar.querySelector('[data-toolbar-flex-group-id="text-formatting"]')).toBeNull();
    await unmount(view);
  });

  test('keeps the More formatting trigger and its overflow set while the trigger is focused', async () => {
    const view = render(EditorToolbar, { props: toolbarProps('toolbar-trigger-focus') });
    await tick();
    const toolbar = toolbarElement('toolbar-trigger-focus');
    configureMeasurements(toolbar, 1000);
    const record = observedToolbar();
    emitResize(record, toolbar, 0);
    await tick();
    const trigger = requiredElement(
      toolbar.querySelector<HTMLButtonElement>('button[aria-label="More formatting"]'),
    );
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    emitResize(record, toolbar, 10000);
    await tick();
    expect(toolbar.querySelector('button[aria-label="More formatting"]')).not.toBeNull();
    trigger.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }),
    );
    trigger.blur();
    emitResize(record, toolbar, 10000);
    await tick();
    expect(toolbar.querySelector('button[aria-label="More formatting"]')).toBeNull();
    await unmount(view);
  });

  test('closes the overflow panel when growth removes overflow and keeps it closed after shrink', async () => {
    const view = render(EditorToolbar, { props: toolbarProps('toolbar-stale-popover') });
    await tick();
    const toolbar = toolbarElement('toolbar-stale-popover');
    configureMeasurements(toolbar, 1000);
    const record = observedToolbar();
    emitResize(record, toolbar, 0);
    await tick();
    const trigger = requiredElement(
      toolbar.querySelector<HTMLButtonElement>('button[aria-label="More formatting"]'),
    );
    trigger.click();
    await tick();
    expect(document.body.querySelector('.cinder-popover')).not.toBeNull();
    trigger.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }),
    );
    trigger.blur();
    emitResize(record, toolbar, 10000);
    await tick();
    expect(toolbar.querySelector('button[aria-label="More formatting"]')).toBeNull();
    expect(document.body.querySelector('.cinder-popover')).toBeNull();
    emitResize(record, toolbar, 0);
    await tick();
    expect(toolbar.querySelector('button[aria-label="More formatting"]')).not.toBeNull();
    expect(document.body.querySelector('.cinder-popover')).toBeNull();
    await unmount(view);
  });

  test('pins a focused group in the real portaled overflow panel while the toolbar grows', async () => {
    const view = render(EditorToolbar, { props: toolbarProps('toolbar-portal-focus') });
    await tick();
    const toolbar = toolbarElement('toolbar-portal-focus');
    configureMeasurements(toolbar, 1000);
    const record = observedToolbar();
    emitResize(record, toolbar, 0);
    await tick();
    const trigger = requiredElement(
      toolbar.querySelector<HTMLButtonElement>('button[aria-label="More formatting"]'),
    );
    trigger.click();
    await tick();
    const panelGroup = portaledTextGroup(toolbar);
    const focusedPanelButton = requiredElement(
      panelGroup.querySelector<HTMLElement>('[data-testid="toolbar-bold"]'),
    );
    focusedPanelButton.focus();
    focusedPanelButton.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(document.activeElement).toBe(focusedPanelButton);
    emitResize(record, toolbar, 10000);
    await tick();
    const retainedPanelGroup = requiredElement(
      document.body.querySelector<HTMLElement>('[data-toolbar-flex-group-id="text-formatting"]'),
    );
    expect(toolbar.contains(retainedPanelGroup)).toBe(false);
    expect(requiredElement(retainedPanelGroup.closest('.cinder-popover'))).not.toBeNull();
    expect(document.activeElement).toBe(focusedPanelButton);
    focusedPanelButton.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }),
    );
    focusedPanelButton.blur();
    emitResize(record, toolbar, 10000);
    await tick();
    expect(toolbar.querySelector('[data-toolbar-flex-group-id="text-formatting"]')).not.toBeNull();
    await unmount(view);
  });

  test('keeps focus pinning isolated between two mounted toolbar instances', async () => {
    const first = render(EditorToolbar, { props: toolbarProps('toolbar-one') });
    const second = render(EditorToolbar, { props: toolbarProps('toolbar-two') });
    await tick();
    const toolbarOne = toolbarElement('toolbar-one');
    const toolbarTwo = toolbarElement('toolbar-two');
    configureMeasurements(toolbarOne, 1000);
    configureMeasurements(toolbarTwo, 1000);
    const firstRecord = RecordingResizeObserver.records[0]!;
    const secondRecord = RecordingResizeObserver.records[1]!;
    emitResize(firstRecord, toolbarOne, 0);
    emitResize(secondRecord, toolbarTwo, 0);
    await tick();
    const firstTrigger = requiredElement(
      toolbarOne.querySelector<HTMLButtonElement>('button[aria-label="More formatting"]'),
    );
    firstTrigger.click();
    await tick();
    const firstPanelGroup = portaledTextGroup(toolbarOne);
    const firstPanelButton = requiredElement(
      firstPanelGroup.querySelector<HTMLElement>('[data-testid="toolbar-bold"]'),
    );
    firstPanelButton.focus();
    firstPanelButton.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(document.activeElement).toBe(firstPanelButton);
    const foreignFocusTarget = document.createElement('button');
    foreignFocusTarget.dataset['toolbarFlexGroupId'] = 'text-formatting';
    foreignFocusTarget.dataset['toolbarInstanceId'] = firstPanelGroup.dataset['toolbarInstanceId'];
    toolbarTwo.append(foreignFocusTarget);
    foreignFocusTarget.focus();
    foreignFocusTarget.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(document.activeElement).toBe(foreignFocusTarget);
    emitResize(secondRecord, toolbarTwo, 10000);
    await tick();
    expect(toolbarTwo.querySelector('button[aria-label="More formatting"]')).toBeNull();
    const retainedFirstGroup = requiredElement(
      firstPanelButton.closest('[data-toolbar-flex-group-id]'),
    );
    expect(toolbarOne.contains(retainedFirstGroup)).toBe(false);
    expect(requiredElement(retainedFirstGroup.closest('.cinder-popover'))).not.toBeNull();
    await unmount(first);
    await unmount(second);
  });
});
