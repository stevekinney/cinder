import { describe, expect, test } from 'bun:test';

import {
  clearTimelineSelection,
  selectTimelineStep,
  timelineSelectionFor,
} from './timeline-selection-store.svelte.ts';

describe('timelineSelectionFor', () => {
  test('starts with no selection', () => {
    const selection = timelineSelectionFor('wf-selection-1');
    expect(selection.selectedStepId).toBeNull();
  });

  test('selecting a step sets it, and both callers (Timeline + Events) see the same object', () => {
    const fromTimeline = timelineSelectionFor('wf-selection-2');
    const fromEvents = timelineSelectionFor('wf-selection-2');

    selectTimelineStep('step-3');

    expect(fromTimeline.selectedStepId).toBe('step-3');
    expect(fromEvents.selectedStepId).toBe('step-3');
  });

  test('selecting the same step again clears it (toggle)', () => {
    timelineSelectionFor('wf-selection-3');
    selectTimelineStep('step-1');
    selectTimelineStep('step-1');
    expect(timelineSelectionFor('wf-selection-3').selectedStepId).toBeNull();
  });

  test('clearTimelineSelection always clears regardless of current selection', () => {
    timelineSelectionFor('wf-selection-4');
    selectTimelineStep('step-9');
    clearTimelineSelection();
    expect(timelineSelectionFor('wf-selection-4').selectedStepId).toBeNull();
  });

  test('navigating to a different workflow id resets the selection', () => {
    timelineSelectionFor('wf-selection-5a');
    selectTimelineStep('step-7');
    expect(timelineSelectionFor('wf-selection-5a').selectedStepId).toBe('step-7');

    const forNewWorkflow = timelineSelectionFor('wf-selection-5b');
    expect(forNewWorkflow.selectedStepId).toBeNull();
  });

  test('re-requesting the SAME workflow id (a tab switch, not a navigation) does not clear the selection', () => {
    timelineSelectionFor('wf-selection-6');
    selectTimelineStep('step-2');

    // Simulate the Events tab unmounting and the Timeline tab re-mounting
    // for the same workflow — this must not reset the selection.
    const again = timelineSelectionFor('wf-selection-6');
    expect(again.selectedStepId).toBe('step-2');
  });
});
