/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { RunStep } from './run-step-timeline.types.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: RunStepTimeline } = await import('./run-step-timeline.svelte');

beforeEach(() => document.body.replaceChildren());
afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const pendingStep: RunStep = {
  id: 'step-pending',
  label: 'Deploy to staging',
  status: 'pending',
};

const runningStep: RunStep = {
  id: 'step-running',
  label: 'Run integration tests',
  status: 'running',
  startTime: '2026-06-01T12:00:00Z',
  progress: 40,
  progressMax: 100,
};

const succeededStep: RunStep = {
  id: 'step-succeeded',
  label: 'Validate configuration',
  status: 'succeeded',
  startTime: '2026-06-01T11:00:00Z',
  endTime: '2026-06-01T11:01:30Z',
  duration: '1m 30s',
  attemptCount: 1,
};

const failedStep: RunStep = {
  id: 'step-failed',
  label: 'Run unit tests',
  status: 'failed',
  startTime: '2026-06-01T10:00:00Z',
  endTime: '2026-06-01T10:05:00Z',
  duration: '5m 0s',
  attemptCount: 2,
  details: [
    {
      id: 'error-log',
      label: 'Error output',
      content: 'AssertionError: expected 1 to equal 2',
    },
  ],
};

const cancelledStep: RunStep = {
  id: 'step-cancelled',
  label: 'Deploy to production',
  status: 'cancelled',
};

const skippedStep: RunStep = {
  id: 'step-skipped',
  label: 'Smoke tests',
  status: 'skipped',
};

const retryingStep: RunStep = {
  id: 'step-retrying',
  label: 'Build Docker image',
  status: 'retrying',
  startTime: '2026-06-01T11:30:00Z',
  attemptCount: 2,
  progress: 15,
};

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe('structure', () => {
  test('renders an ordered list with one item per step', () => {
    const { container } = render(RunStepTimeline, {
      steps: [succeededStep, runningStep, pendingStep],
    });
    const list = container.querySelector('ol.cinder-run-step-timeline');
    expect(list).not.toBeNull();
    const items = container.querySelectorAll('li.cinder-run-step-timeline__item');
    expect(items.length).toBe(3);
  });

  test('each item carries the correct data-cinder-status attribute', () => {
    const allStatuses: RunStep[] = [
      succeededStep,
      failedStep,
      runningStep,
      cancelledStep,
      skippedStep,
      retryingStep,
      pendingStep,
    ];
    const { container } = render(RunStepTimeline, { steps: allStatuses });
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('li.cinder-run-step-timeline__item'),
    );
    const statuses = items.map((li) => li.getAttribute('data-cinder-status'));
    expect(statuses).toEqual([
      'succeeded',
      'failed',
      'running',
      'cancelled',
      'skipped',
      'retrying',
      'pending',
    ]);
  });

  test('renders the step label in each item', () => {
    const { container } = render(RunStepTimeline, {
      steps: [succeededStep, runningStep, pendingStep],
    });
    const labels = Array.from(container.querySelectorAll('.cinder-run-step-timeline__label')).map(
      (el) => el.textContent?.trim(),
    );
    expect(labels).toEqual([
      'Validate configuration',
      'Run integration tests',
      'Deploy to staging',
    ]);
  });

  test('last item has connector-after=hidden; others have visible', () => {
    const { container } = render(RunStepTimeline, {
      steps: [succeededStep, runningStep, pendingStep],
    });
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('li.cinder-run-step-timeline__item'),
    );
    expect(items[0]?.getAttribute('data-cinder-connector-after')).toBe('visible');
    expect(items[1]?.getAttribute('data-cinder-connector-after')).toBe('visible');
    expect(items[2]?.getAttribute('data-cinder-connector-after')).toBe('hidden');
  });

  test('merges a custom class onto the root ol', () => {
    const { container } = render(RunStepTimeline, {
      steps: [pendingStep],
      class: 'my-custom',
    });
    const list = container.querySelector('ol');
    expect(list?.classList.contains('cinder-run-step-timeline')).toBe(true);
    expect(list?.classList.contains('my-custom')).toBe(true);
  });

  test('each item contains a status dot marker', () => {
    const { container } = render(RunStepTimeline, {
      steps: [succeededStep, failedStep],
    });
    const markers = container.querySelectorAll('.cinder-run-step-timeline__marker');
    expect(markers.length).toBe(2);
    // Markers are decorative and hidden from AT
    for (const marker of Array.from(markers)) {
      expect(marker.getAttribute('aria-hidden')).toBe('true');
      expect(marker.hasAttribute('inert')).toBe(true);
    }
  });

  test('status badges render with the status label text', () => {
    // Use steps without attemptCount > 1 so each item has exactly one badge
    const { container } = render(RunStepTimeline, {
      steps: [succeededStep, runningStep, pendingStep, skippedStep],
    });
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('li.cinder-run-step-timeline__item'),
    );
    // Grab the first badge from each item independently so attempt badges don't shift indices
    const firstBadgesPerItem = items.map((item) =>
      item.querySelector('.cinder-badge')?.textContent?.trim(),
    );
    expect(firstBadgesPerItem[0]).toBe('Succeeded');
    expect(firstBadgesPerItem[1]).toBe('Running');
    expect(firstBadgesPerItem[2]).toBe('Pending');
    expect(firstBadgesPerItem[3]).toBe('Skipped');
  });
});

// ---------------------------------------------------------------------------
// Behavior: metadata rendering
// ---------------------------------------------------------------------------

describe('behavior', () => {
  test('renders start time metadata when present', () => {
    const { container } = render(RunStepTimeline, { steps: [succeededStep] });
    const terms = Array.from(container.querySelectorAll('.cinder-run-step-timeline__meta-term'));
    expect(terms.map((t) => t.textContent?.replace(':', '').trim())).toContain('Started');
  });

  test('renders duration metadata when present', () => {
    const { container } = render(RunStepTimeline, { steps: [succeededStep] });
    const defs = Array.from(
      container.querySelectorAll('.cinder-run-step-timeline__meta-definition'),
    );
    expect(defs.map((d) => d.textContent?.trim())).toContain('1m 30s');
  });

  test('renders attempt count badge when attemptCount > 1', () => {
    // failedStep has attemptCount: 2 — badge should appear
    const { container } = render(RunStepTimeline, { steps: [failedStep] });
    const badges = Array.from(container.querySelectorAll('.cinder-badge')).map((b) =>
      b.textContent?.trim(),
    );
    expect(badges.some((text) => text?.includes('attempt'))).toBe(true);
  });

  test('does not render attempt count badge when attemptCount is 1', () => {
    const { container } = render(RunStepTimeline, {
      steps: [{ ...succeededStep, attemptCount: 1 }],
    });
    const badges = Array.from(container.querySelectorAll('.cinder-badge')).map((b) =>
      b.textContent?.trim(),
    );
    expect(badges.some((text) => text?.includes('attempt'))).toBe(false);
  });

  test('renders progress bar for running step with progress value', () => {
    const { container } = render(RunStepTimeline, { steps: [runningStep] });
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).not.toBeNull();
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('40');
  });

  test('does not render progress bar for pending step', () => {
    const { container } = render(RunStepTimeline, { steps: [pendingStep] });
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).toBeNull();
  });

  test('does not render progress bar for succeeded step', () => {
    const { container } = render(RunStepTimeline, {
      steps: [{ ...succeededStep, progress: 100 }],
    });
    // progress is defined but status is 'succeeded', not running/retrying
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).toBeNull();
  });

  test('renders expandable detail panels via Collapsible', () => {
    const { container } = render(RunStepTimeline, { steps: [failedStep] });
    const details = container.querySelector('.cinder-run-step-timeline__details');
    expect(details).not.toBeNull();
    // Collapsible trigger should render with the detail label
    const trigger = container.querySelector('.cinder-collapsible__trigger');
    expect(trigger).not.toBeNull();
    expect(trigger?.textContent?.trim()).toContain('Error output');
  });

  test('does not render details section when step has no details', () => {
    const { container } = render(RunStepTimeline, { steps: [runningStep] });
    expect(container.querySelector('.cinder-run-step-timeline__details')).toBeNull();
  });

  test('renders retrying step with progress bar', () => {
    const { container } = render(RunStepTimeline, { steps: [retryingStep] });
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).not.toBeNull();
  });

  test('terminal state data attribute is set for ended steps', () => {
    const { container } = render(RunStepTimeline, {
      steps: [succeededStep, failedStep, cancelledStep, skippedStep],
    });
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('li.cinder-run-step-timeline__item'),
    );
    for (const item of items) {
      expect(item.hasAttribute('data-cinder-terminal')).toBe(true);
    }
  });

  test('terminal state data attribute is absent for non-terminal steps', () => {
    const { container } = render(RunStepTimeline, {
      steps: [runningStep, pendingStep, retryingStep],
    });
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('li.cinder-run-step-timeline__item'),
    );
    for (const item of items) {
      expect(item.hasAttribute('data-cinder-terminal')).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe('accessibility', () => {
  test('applies aria-label from the label prop when aria-label/aria-labelledby are absent', () => {
    const { container } = render(RunStepTimeline, {
      steps: [pendingStep],
      label: 'Deployment workflow',
    });
    const list = container.querySelector('ol.cinder-run-step-timeline');
    expect(list?.getAttribute('aria-label')).toBe('Deployment workflow');
  });

  test('prefers aria-label prop over label prop', () => {
    const { container } = render(RunStepTimeline, {
      steps: [pendingStep],
      label: 'Workflow',
      'aria-label': 'Custom label',
    });
    const list = container.querySelector('ol.cinder-run-step-timeline');
    expect(list?.getAttribute('aria-label')).toBe('Custom label');
  });

  test('sets aria-current="step" on the running step', () => {
    const { container } = render(RunStepTimeline, {
      steps: [succeededStep, runningStep, pendingStep],
    });
    const items = Array.from(container.querySelectorAll<HTMLElement>('li'));
    const currentItems = items.filter((li) => li.getAttribute('aria-current') === 'step');
    expect(currentItems.length).toBe(1);
    expect(currentItems[0]?.getAttribute('data-cinder-status')).toBe('running');
  });

  test('sets aria-current="step" on retrying step', () => {
    const { container } = render(RunStepTimeline, {
      steps: [retryingStep, pendingStep],
    });
    const items = Array.from(container.querySelectorAll<HTMLElement>('li'));
    const currentItems = items.filter((li) => li.getAttribute('aria-current') === 'step');
    expect(currentItems.length).toBe(1);
    expect(currentItems[0]?.getAttribute('data-cinder-status')).toBe('retrying');
  });

  test('does not set aria-current on succeeded, failed, pending, or skipped steps', () => {
    const { container } = render(RunStepTimeline, {
      steps: [succeededStep, failedStep, pendingStep, skippedStep],
    });
    const items = Array.from(container.querySelectorAll<HTMLElement>('li'));
    const currentItems = items.filter((li) => li.hasAttribute('aria-current'));
    expect(currentItems.length).toBe(0);
  });

  test('progress bar has an accessible label from the step label', () => {
    const { container } = render(RunStepTimeline, { steps: [runningStep] });
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar?.getAttribute('aria-label')).toBe('Run integration tests progress');
  });

  test('status dot marker is aria-hidden and inert', () => {
    const { container } = render(RunStepTimeline, { steps: [succeededStep] });
    const marker = container.querySelector('.cinder-run-step-timeline__marker');
    expect(marker?.getAttribute('aria-hidden')).toBe('true');
    expect(marker?.hasAttribute('inert')).toBe(true);
  });

  test('metadata is rendered in a dl/dt/dd structure', () => {
    const { container } = render(RunStepTimeline, { steps: [succeededStep] });
    const dl = container.querySelector('.cinder-run-step-timeline__meta');
    expect(dl?.tagName).toBe('DL');
    const dts = dl?.querySelectorAll('dt');
    const dds = dl?.querySelectorAll('dd');
    expect(dts?.length).toBeGreaterThan(0);
    expect(dds?.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// CSS snapshot
// ---------------------------------------------------------------------------

describe('CSS snapshot', () => {
  test('CSS file exists and contains the root class and layer wrapper', () => {
    const { readFileSync } = require('node:fs');
    const css = readFileSync(
      new URL('./run-step-timeline.css', import.meta.url).pathname,
      'utf8',
    ) as string;
    expect(css).toContain('cinder-run-step-timeline');
    expect(css).toContain('@layer cinder.components');
    expect(css).toContain(
      '@layer cinder.tokens, cinder.foundation, cinder.components, cinder.utilities',
    );
  });

  test('CSS uses only --cinder-* custom properties, not hardcoded colors', () => {
    const { readFileSync } = require('node:fs');
    const css = readFileSync(
      new URL('./run-step-timeline.css', import.meta.url).pathname,
      'utf8',
    ) as string;
    // Should not contain color: #..., color: rgb(...), background: #... etc.
    expect(css).not.toMatch(/:\s*#[0-9a-fA-F]{3,6}/);
    expect(css).not.toMatch(/:\s*rgb\(/);
  });
});
