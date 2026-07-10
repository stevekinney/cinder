/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import Ajv2020 from 'ajv/dist/2020';
import { setupHappyDom } from '../../test/happy-dom.ts';
import type {
  RunStep,
  RunStepBranchGroup,
  RunStepTimelineEntry,
} from './run-step-timeline.types.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: RunStepTimeline } = await import('./run-step-timeline.svelte');
const { default: runStepTimelineSchema } = await import('./run-step-timeline.schema.ts');

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

const waitingApprovalStep: RunStep = {
  id: 'step-waiting-approval',
  label: 'Approve deployment',
  status: 'waiting_approval',
  startTime: '2026-06-01T11:45:00Z',
};

function makeDeepHiddenChildren(count: number, leafStatus: RunStep['status']): RunStep[] {
  let currentStep: RunStep = {
    id: `hidden-${count}`,
    label: `Hidden ${count}`,
    status: leafStatus,
  };

  for (let index = count - 1; index >= 1; index -= 1) {
    currentStep = {
      id: `hidden-${index}`,
      label: `Hidden ${index}`,
      status: 'succeeded',
      children: [currentStep],
    };
  }

  return [currentStep];
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe('structure', () => {
  test('schema requires step fields through the rendered depth cap', () => {
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(runStepTimelineSchema);

    expect(
      validate({
        steps: [
          {
            id: 'workflow',
            label: 'Workflow',
            status: 'running',
            children: [
              {
                id: 'activity',
                label: 'Activity',
                status: 'succeeded',
                children: [
                  {
                    children: [
                      {
                        id: 'hidden-child',
                        label: 'Hidden child',
                        status: 'pending',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(false);

    expect(
      validate({
        steps: [
          {
            id: 'workflow',
            label: 'Workflow',
            status: 'running',
            children: [
              {
                id: 'activity',
                label: 'Activity',
                status: 'succeeded',
                children: [
                  {
                    id: 'tool-call',
                    label: 'Tool call',
                    status: 'waiting_approval',
                    children: [
                      {
                        id: 'nested-subagent',
                        label: 'Nested subagent',
                        status: 'running',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(true);

    expect(
      validate({
        steps: [
          {
            id: 'workflow',
            label: 'Workflow',
            status: 'running',
            children: [
              {
                id: 'activity',
                label: 'Activity',
                status: 'succeeded',
                children: [
                  {
                    id: 'tool-call',
                    label: 'Tool call',
                    status: 'waiting_approval',
                    children: [
                      {
                        id: 'nested-subagent',
                        label: 'Nested subagent',
                        status: 'running',
                        children: [
                          {
                            reason: 'summarized past the rendered depth cap',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  test('schema allows nested child details and stops at the rendered depth cap', () => {
    const stepsProperty = runStepTimelineSchema.properties['steps'] as
      | {
          items: {
            anyOf: { properties: Record<string, unknown> }[];
          };
        }
      | undefined;
    expect(stepsProperty).toBeDefined();
    // `steps.items` is an anyOf of a step entry and a branch-group entry; the
    // nested-children depth cap lives on the step variant (the one with `status`).
    const stepVariant = stepsProperty?.items.anyOf.find((variant) =>
      Object.hasOwn(variant.properties, 'status'),
    );
    expect(stepVariant).toBeDefined();

    const childSchemaAt = (properties: Record<string, unknown>) => {
      const children = properties['children'] as
        | {
            items: {
              additionalProperties?: boolean;
              required?: string[];
              type?: string;
              properties: Record<string, unknown>;
            };
          }
        | undefined;
      return children?.items;
    };

    const depthOneSchema = childSchemaAt(stepVariant?.properties ?? {});
    const depthOneProperties = depthOneSchema?.properties ?? {};
    const depthTwoSchema = childSchemaAt(depthOneProperties);
    const depthTwoProperties = depthTwoSchema?.properties ?? {};
    const depthThreeSchema = childSchemaAt(depthTwoProperties);
    const depthThreeProperties = depthThreeSchema?.properties ?? {};

    expect(depthOneProperties).toHaveProperty('details');
    expect(depthOneProperties).toHaveProperty('link');
    expect(depthOneProperties).toHaveProperty('children');
    expect(depthTwoSchema?.required).toEqual(['id', 'label', 'status']);
    expect(depthThreeSchema?.required).toEqual(['id', 'label', 'status']);
    expect(depthThreeProperties).toHaveProperty('details');
    expect(depthThreeProperties).toHaveProperty('link');
    expect(depthThreeProperties).toHaveProperty('children');
    const cappedChildren = depthThreeProperties['children'] as
      | { items?: { additionalProperties?: boolean } }
      | undefined;
    expect(cappedChildren?.items?.additionalProperties).toBe(true);
  });

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
      waitingApprovalStep,
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
      'waiting_approval',
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
      steps: [succeededStep, runningStep, waitingApprovalStep, pendingStep, skippedStep],
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
    expect(firstBadgesPerItem[2]).toBe('Waiting approval');
    expect(firstBadgesPerItem[3]).toBe('Pending');
    expect(firstBadgesPerItem[4]).toBe('Skipped');
  });

  test('waiting approval uses its own badge and status dot tone', () => {
    const { container } = render(RunStepTimeline, {
      steps: [waitingApprovalStep],
    });
    const item = container.querySelector<HTMLElement>('.cinder-run-step-timeline__item');
    const statusBadge = item?.querySelector<HTMLElement>('.cinder-run-step-timeline__status');
    const statusDot = item?.querySelector<HTMLElement>('.cinder-status-dot');

    expect(item?.getAttribute('data-cinder-status')).toBe('waiting_approval');
    expect(statusBadge?.textContent?.trim()).toBe('Waiting approval');
    expect(statusBadge?.getAttribute('data-cinder-variant')).toBe('accent');
    expect(statusBadge?.getAttribute('aria-label')).toBe('Status: Waiting approval');
    expect(statusDot?.getAttribute('data-cinder-status')).toBe('accent');
  });

  test('renders legacy step fixtures without requiring new props', () => {
    const legacySteps: RunStep[] = [
      {
        id: 'validate',
        label: 'Validate configuration',
        status: 'succeeded',
        startTime: '2026-06-01T11:00:00Z',
        endTime: '2026-06-01T11:01:30Z',
        duration: '1m 30s',
      },
      {
        id: 'build',
        label: 'Build Docker image',
        status: 'running',
        startTime: '2026-06-01T11:02:00Z',
        progress: 40,
      },
      {
        id: 'deploy',
        label: 'Deploy to staging',
        status: 'pending',
      },
    ];

    const { container } = render(RunStepTimeline, {
      steps: legacySteps,
      label: 'Deployment run',
    });

    expect(container.querySelectorAll('.cinder-run-step-timeline__item').length).toBe(3);
    expect(container.querySelector('.cinder-run-step-timeline')?.getAttribute('aria-label')).toBe(
      'Deployment run',
    );
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

  test('waiting approval is current and non-terminal without implicit progress', () => {
    const { container } = render(RunStepTimeline, { steps: [waitingApprovalStep] });
    const item = container.querySelector<HTMLElement>('.cinder-run-step-timeline__item');
    expect(item?.getAttribute('aria-current')).toBe('step');
    expect(item?.hasAttribute('data-cinder-terminal')).toBe(false);
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  test('waiting approval renders progress when progress is explicitly present', () => {
    const { container } = render(RunStepTimeline, {
      steps: [{ ...waitingApprovalStep, progress: 25 }],
    });
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).not.toBeNull();
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('25');
  });

  test('renders nested child workflow lanes with depth and connector continuity', () => {
    const parentWithChildren: RunStep = {
      id: 'workflow',
      label: 'Workflow',
      status: 'running',
      children: [
        {
          id: 'activity',
          label: 'Activity',
          status: 'succeeded',
        },
        {
          id: 'subagent',
          label: 'Subagent lane',
          status: 'retrying',
          children: [
            {
              id: 'tool-call',
              label: 'Tool call',
              status: 'waiting_approval',
            },
          ],
        },
      ],
    };

    const { container } = render(RunStepTimeline, { steps: [parentWithChildren] });
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('.cinder-run-step-timeline__item'),
    );

    expect(items.map((item) => item.getAttribute('data-cinder-depth'))).toEqual([
      '0',
      '1',
      '1',
      '2',
    ]);
    expect(items.map((item) => item.getAttribute('data-cinder-path'))).toEqual([
      'workflow',
      'workflow/activity',
      'workflow/subagent',
      'workflow/subagent/tool-call',
    ]);
    expect(items[0]?.getAttribute('data-cinder-connector-after')).toBe('visible');
    expect(items[2]?.getAttribute('data-cinder-connector-after')).toBe('visible');
    expect(items[3]?.getAttribute('data-cinder-connector-after')).toBe('hidden');
  });

  test('escapes step ids before composing nested path keys', () => {
    const { container } = render(RunStepTimeline, {
      steps: [
        {
          id: 'workflow/activity',
          label: 'Top-level workflow activity',
          status: 'succeeded',
        },
        {
          id: 'workflow',
          label: 'Workflow',
          status: 'running',
          children: [
            {
              id: 'activity',
              label: 'Nested activity',
              status: 'running',
            },
          ],
        },
      ],
    });
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('.cinder-run-step-timeline__item'),
    );

    expect(items.map((item) => item.getAttribute('data-cinder-path'))).toEqual([
      'workflow%2Factivity',
      'workflow',
      'workflow/activity',
    ]);
  });

  test('does not throw when step ids contain lone surrogates', () => {
    const { container } = render(RunStepTimeline, {
      steps: [
        {
          id: '\uD800',
          label: 'Malformed identifier',
          status: 'running',
        },
      ],
    });

    const item = container.querySelector<HTMLElement>('.cinder-run-step-timeline__item');
    expect(item?.getAttribute('data-cinder-path')).toBe('\uD800');
    expect(item?.textContent).toContain('Malformed identifier');
  });

  test('hides a nested lane connector before returning to a shallower row', () => {
    const { container } = render(RunStepTimeline, {
      steps: [
        {
          id: 'workflow',
          label: 'Workflow',
          status: 'succeeded',
          children: [
            {
              id: 'activity',
              label: 'Activity',
              status: 'succeeded',
            },
          ],
        },
        {
          id: 'next-workflow',
          label: 'Next workflow',
          status: 'pending',
        },
      ],
    });
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('.cinder-run-step-timeline__item'),
    );

    expect(items.map((item) => item.getAttribute('data-cinder-depth'))).toEqual(['0', '1', '0']);
    expect(items[0]?.getAttribute('data-cinder-connector-after')).toBe('visible');
    expect(items[1]?.getAttribute('data-cinder-connector-after')).toBe('hidden');
    expect(items[2]?.getAttribute('data-cinder-connector-after')).toBe('hidden');
  });

  test('caps rendered child workflow depth', () => {
    const deeplyNested: RunStep = {
      id: 'root',
      label: 'Root',
      status: 'running',
      children: [
        {
          id: 'child',
          label: 'Child',
          status: 'running',
          children: [
            {
              id: 'grandchild',
              label: 'Grandchild',
              status: 'running',
              children: [
                {
                  id: 'great-grandchild',
                  label: 'Great grandchild',
                  status: 'running',
                  children: [
                    {
                      id: 'capped',
                      label: 'Capped child',
                      status: 'pending',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const { container } = render(RunStepTimeline, { steps: [deeplyNested] });
    const labels = Array.from(container.querySelectorAll('.cinder-run-step-timeline__label')).map(
      (element) => element.textContent?.trim(),
    );

    expect(labels).toEqual([
      'Root',
      'Child',
      'Grandchild',
      'Great grandchild',
      '1 nested step hidden',
    ]);
    expect(container.querySelector('[data-cinder-depth-limit]')).not.toBeNull();
  });

  test('summarizes deeply nested hidden lanes without recursive traversal overflow', () => {
    const hiddenChildren = makeDeepHiddenChildren(20_000, 'waiting_approval');
    const deeplyNested: RunStep = {
      id: 'root',
      label: 'Root',
      status: 'succeeded',
      children: [
        {
          id: 'child',
          label: 'Child',
          status: 'succeeded',
          children: [
            {
              id: 'grandchild',
              label: 'Grandchild',
              status: 'succeeded',
              children: [
                {
                  id: 'great-grandchild',
                  label: 'Great grandchild',
                  status: 'succeeded',
                  children: hiddenChildren,
                },
              ],
            },
          ],
        },
      ],
    };

    const { container } = render(RunStepTimeline, { steps: [deeplyNested] });
    const depthLimitRow = container.querySelector<HTMLElement>('[data-cinder-depth-limit]');

    expect(depthLimitRow).not.toBeNull();
    expect(depthLimitRow?.textContent).toContain('20000 nested steps hidden');
    expect(depthLimitRow?.getAttribute('aria-current')).toBe('step');
  });

  test('renders step links with the Link component', () => {
    const { container } = render(RunStepTimeline, {
      steps: [
        {
          ...succeededStep,
          link: {
            href: '/runs/run-123/steps/validate',
            label: 'Open logs',
          },
        },
      ],
    });

    const link = container.querySelector<HTMLAnchorElement>('.cinder-link');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/runs/run-123/steps/validate');
    expect(link?.textContent?.trim()).toBe('Open logs');
  });

  test('renders unsafe step link URLs as non-interactive text', () => {
    const { container } = render(RunStepTimeline, {
      steps: [
        {
          ...succeededStep,
          link: {
            href: 'javascript:alert(1)',
            label: 'Open logs',
          },
        },
      ],
    });

    expect(container.querySelector('a.cinder-run-step-timeline__link')).toBeNull();
    const label = container.querySelector('.cinder-run-step-timeline__link--unsafe');
    expect(label?.textContent?.trim()).toBe('Open logs');
  });

  test('renders step link URLs with embedded control characters as non-interactive text', () => {
    const { container } = render(RunStepTimeline, {
      steps: [
        {
          ...succeededStep,
          link: {
            href: 'java\nscript:alert(1)',
            label: 'Open logs',
          },
        },
      ],
    });

    expect(container.querySelector('a.cinder-run-step-timeline__link')).toBeNull();
    const label = container.querySelector('.cinder-run-step-timeline__link--unsafe');
    expect(label?.textContent?.trim()).toBe('Open logs');
  });

  test('renders backslash step links as non-interactive text', () => {
    const unsafeHrefs = ['\\evil.example/path', '\\\\evil.example/path', '/\\evil.example/path'];

    for (const href of unsafeHrefs) {
      cleanup();
      const { container } = render(RunStepTimeline, {
        steps: [
          {
            ...succeededStep,
            link: {
              href,
              label: 'Open logs',
            },
          },
        ],
      });

      expect(container.querySelector('a.cinder-run-step-timeline__link')).toBeNull();
      const label = container.querySelector('.cinder-run-step-timeline__link--unsafe');
      expect(label?.textContent?.trim()).toBe('Open logs');
    }
  });

  test('keeps app-relative step links interactive', () => {
    const { container } = render(RunStepTimeline, {
      steps: [
        {
          ...succeededStep,
          link: {
            href: './runs/123#history',
            label: 'Open run',
          },
        },
      ],
    });

    const link = container.querySelector<HTMLAnchorElement>('a.cinder-run-step-timeline__link');
    expect(link?.getAttribute('href')).toBe('./runs/123#history');
    expect(link?.textContent?.trim()).toBe('Open run');
  });

  test('renders actions count only when greater than zero', () => {
    const { container } = render(RunStepTimeline, {
      steps: [
        { ...succeededStep, id: 'zero-actions', actionsCount: 0 },
        { ...retryingStep, id: 'two-actions', actionsCount: 2 },
      ],
    });
    const badges = Array.from(container.querySelectorAll('.cinder-badge')).map((badge) =>
      badge.textContent?.trim(),
    );

    expect(badges).toContain('2 actions');
    expect(badges).not.toContain('0 actions');
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
      steps: [runningStep, waitingApprovalStep, pendingStep, retryingStep],
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

  test('sets aria-current="step" on waiting approval step', () => {
    const { container } = render(RunStepTimeline, {
      steps: [waitingApprovalStep, pendingStep],
    });
    const items = Array.from(container.querySelectorAll<HTMLElement>('li'));
    const currentItems = items.filter((li) => li.getAttribute('aria-current') === 'step');
    expect(currentItems.length).toBe(1);
    expect(currentItems[0]?.getAttribute('data-cinder-status')).toBe('waiting_approval');
  });

  test('sets aria-current on only one active row in nested workflows', () => {
    const { container } = render(RunStepTimeline, {
      steps: [
        {
          id: 'workflow',
          label: 'Workflow',
          status: 'running',
          children: [
            {
              id: 'approval',
              label: 'Approve tool call',
              status: 'waiting_approval',
            },
          ],
        },
      ],
    });
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('.cinder-run-step-timeline__item'),
    );
    const currentItems = items.filter((li) => li.getAttribute('aria-current') === 'step');

    expect(currentItems).toHaveLength(1);
    expect(currentItems[0]?.getAttribute('data-cinder-path')).toBe('workflow/approval');
    expect(items[0]?.hasAttribute('aria-current')).toBe(false);
  });

  test('sets aria-current on the depth cap row when it hides the active descendant', () => {
    const deeplyNested: RunStep = {
      id: 'root',
      label: 'Root',
      status: 'succeeded',
      children: [
        {
          id: 'child',
          label: 'Child',
          status: 'succeeded',
          children: [
            {
              id: 'grandchild',
              label: 'Grandchild',
              status: 'succeeded',
              children: [
                {
                  id: 'great-grandchild',
                  label: 'Great grandchild',
                  status: 'succeeded',
                  children: [
                    {
                      id: 'capped-active-child',
                      label: 'Capped active child',
                      status: 'waiting_approval',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const { container } = render(RunStepTimeline, { steps: [deeplyNested] });
    const currentItems = Array.from(
      container.querySelectorAll<HTMLElement>('[aria-current="step"]'),
    );

    expect(currentItems).toHaveLength(1);
    expect(currentItems[0]?.hasAttribute('data-cinder-depth-limit')).toBe(true);
    expect(currentItems[0]?.getAttribute('data-cinder-status')).toBe('depth-limit');
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
// Branch groups, rewound speculation, and saga compensation
// ---------------------------------------------------------------------------

const branchGroup: RunStepBranchGroup = {
  kind: 'branch',
  id: 'race-candidates',
  label: 'Race deploy candidates',
  lanes: [
    {
      id: 'blue',
      label: 'Blue',
      outcome: 'won',
      steps: [{ id: 'blue-deploy', label: 'Deploy blue', status: 'succeeded' }],
    },
    {
      id: 'green',
      label: 'Green',
      outcome: 'lost',
      steps: [{ id: 'green-deploy', label: 'Deploy green', status: 'cancelled' }],
    },
  ],
};

describe('branch groups', () => {
  test('renders a branch-group entry with its lanes and outcome summary', () => {
    const { container } = render(RunStepTimeline, {
      steps: [branchGroup] as RunStepTimelineEntry[],
      label: 'Speculative run',
    });

    const branchItem = container.querySelector(
      '.cinder-run-step-timeline__item--branch[data-cinder-status="branch"]',
    );
    expect(branchItem).not.toBeNull();
    // Outcome summary conveyed as visible text, not color alone.
    expect(container.textContent).toContain('1 won, 1 lost');
    expect(container.textContent).toContain('Race deploy candidates');

    const lanes = container.querySelectorAll('.cinder-run-step-timeline__lane');
    expect(lanes.length).toBe(2);
  });

  test('marks winning and losing lanes via data-cinder-outcome', () => {
    const { container } = render(RunStepTimeline, {
      steps: [branchGroup] as RunStepTimelineEntry[],
    });
    expect(
      container.querySelector('.cinder-run-step-timeline__lane[data-cinder-outcome="won"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('.cinder-run-step-timeline__lane[data-cinder-outcome="lost"]'),
    ).not.toBeNull();
  });

  test('renders lanes with no outcome as racing', () => {
    const racing: RunStepBranchGroup = {
      kind: 'branch',
      id: 'racing',
      label: 'In-flight race',
      lanes: [
        { id: 'a', label: 'A', steps: [{ id: 'a1', label: 'A step', status: 'running' }] },
        { id: 'b', label: 'B', steps: [{ id: 'b1', label: 'B step', status: 'running' }] },
      ],
    };
    const { container } = render(RunStepTimeline, { steps: [racing] as RunStepTimelineEntry[] });
    expect(
      container.querySelectorAll('.cinder-run-step-timeline__lane[data-cinder-outcome="racing"]')
        .length,
    ).toBe(2);
    expect(container.textContent).toContain('2 lanes racing');
  });

  test('collapses by default once the lane count reaches the threshold', () => {
    const threeLaneGroup: RunStepBranchGroup = {
      kind: 'branch',
      id: 'wide',
      label: 'Wide race',
      lanes: ['a', 'b', 'c'].map((id) => ({
        id,
        label: id.toUpperCase(),
        outcome: 'settled' as const,
        steps: [{ id: `${id}-1`, label: `${id} step`, status: 'succeeded' as const }],
      })),
    };
    const { container } = render(RunStepTimeline, {
      steps: [threeLaneGroup] as RunStepTimelineEntry[],
    });
    const trigger = container.querySelector(
      '.cinder-run-step-timeline__item--branch [aria-expanded]',
    );
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
  });

  test('stays expanded below the threshold', () => {
    const { container } = render(RunStepTimeline, {
      steps: [branchGroup] as RunStepTimelineEntry[],
    });
    const trigger = container.querySelector(
      '.cinder-run-step-timeline__item--branch [aria-expanded]',
    );
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
  });

  test('stays expanded past the threshold when a lane has an active step', () => {
    // 3 lanes would auto-collapse, but one lane is running: keep it open so the
    // active step, its progress, and lane aria-current stay mounted for AT.
    const activeWideGroup: RunStepBranchGroup = {
      kind: 'branch',
      id: 'wide-active',
      label: 'Wide active race',
      lanes: ['a', 'b', 'c'].map((id) => ({
        id,
        label: id.toUpperCase(),
        steps: [
          { id: `${id}-1`, label: `${id} step`, status: id === 'b' ? 'running' : 'succeeded' },
        ],
      })),
    };
    const { container } = render(RunStepTimeline, {
      steps: [activeWideGroup] as RunStepTimelineEntry[],
    });
    const trigger = container.querySelector(
      '.cinder-run-step-timeline__item--branch [aria-expanded]',
    );
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
  });

  test('respects an explicit collapsed=true even with an active lane step', () => {
    const collapsedActive: RunStepBranchGroup = {
      kind: 'branch',
      id: 'collapsed-active',
      label: 'Collapsed active',
      collapsed: true,
      lanes: [
        { id: 'a', label: 'A', steps: [{ id: 'a1', label: 'A', status: 'running' }] },
        { id: 'b', label: 'B', steps: [{ id: 'b1', label: 'B', status: 'succeeded' }] },
      ],
    };
    const { container } = render(RunStepTimeline, {
      steps: [collapsedActive] as RunStepTimelineEntry[],
    });
    const trigger = container.querySelector(
      '.cinder-run-step-timeline__item--branch [aria-expanded]',
    );
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
  });

  test('respects an explicit collapsed override regardless of threshold', () => {
    const collapsed: RunStepBranchGroup = { ...branchGroup, collapsed: true };
    const { container } = render(RunStepTimeline, {
      steps: [collapsed] as RunStepTimelineEntry[],
    });
    const trigger = container.querySelector(
      '.cinder-run-step-timeline__item--branch [aria-expanded]',
    );
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
  });

  test('renders steps and branch groups together, preserving order', () => {
    const steps: RunStepTimelineEntry[] = [
      { id: 'first', label: 'First', status: 'succeeded' },
      branchGroup,
      { id: 'last', label: 'Last', status: 'pending' },
    ];
    const { container } = render(RunStepTimeline, { steps });
    // Scope to the root ol's direct children — lane sub-lists reuse the root class.
    const rootList = container.querySelector('ol.cinder-run-step-timeline');
    const items = [...(rootList?.children ?? [])].filter((el) =>
      el.classList.contains('cinder-run-step-timeline__item'),
    );
    // first step, branch group, last step
    expect(items.length).toBe(3);
    expect(items[1]?.getAttribute('data-cinder-status')).toBe('branch');
  });

  test('does not collide keys between a branch group and a step id "branch" with children', () => {
    // A step id of "branch" plus a child would previously produce the same
    // keyed-each path as a branch group; the branch key is namespaced so both
    // render instead of one being deduped away.
    const steps: RunStepTimelineEntry[] = [
      {
        id: 'branch',
        label: 'Literal branch step',
        status: 'running',
        children: [{ id: 'race', label: 'Nested child', status: 'succeeded' }],
      },
      {
        kind: 'branch',
        id: 'race',
        label: 'Actual branch group',
        lanes: [{ id: 'l', label: 'L', steps: [{ id: 's', label: 'S', status: 'succeeded' }] }],
      },
    ];
    const { container } = render(RunStepTimeline, { steps });
    expect(container.textContent).toContain('Literal branch step');
    expect(container.textContent).toContain('Actual branch group');
    expect(container.querySelector('.cinder-run-step-timeline__item--branch')).not.toBeNull();
  });

  test('keeps a single aria-current on the rail when active steps flank a branch group', () => {
    const steps: RunStepTimelineEntry[] = [
      { id: 'before', label: 'Before', status: 'running' },
      branchGroup,
      { id: 'after', label: 'After', status: 'running' },
    ];
    const { container } = render(RunStepTimeline, { steps });
    const rootList = container.querySelector('ol.cinder-run-step-timeline');
    const currentRows = [...(rootList?.children ?? [])].filter(
      (el) =>
        el.classList.contains('cinder-run-step-timeline__item') &&
        el.getAttribute('aria-current') === 'step',
    );
    // Exactly one current row across the whole outer rail, not one per run.
    expect(currentRows.length).toBe(1);
  });

  test('accepts a branch group through the generated schema', () => {
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(runStepTimelineSchema);
    expect(
      validate({
        steps: [
          {
            kind: 'branch',
            id: 'g',
            label: 'Group',
            lanes: [
              { id: 'l1', outcome: 'won', steps: [{ id: 's', label: 'S', status: 'succeeded' }] },
            ],
          },
        ],
      }),
    ).toBe(true);
    // A branch group missing its required `lanes` fails validation.
    expect(validate({ steps: [{ kind: 'branch', id: 'g', label: 'Group' }] })).toBe(false);
  });

  test('accepts a branch lane step with nested children through the schema', () => {
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(runStepTimelineSchema);
    // Lane steps are RunStep[] at runtime and can nest children; the schema
    // must accept that rather than rejecting it under additionalProperties.
    expect(
      validate({
        steps: [
          {
            kind: 'branch',
            id: 'g',
            label: 'Group',
            lanes: [
              {
                id: 'l1',
                steps: [
                  {
                    id: 's',
                    label: 'Parent',
                    status: 'running',
                    children: [{ id: 's-child', label: 'Child', status: 'succeeded' }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  test('rejects a non-step nested lane child (validated as a step, not any object)', () => {
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(runStepTimelineSchema);
    // A rendered-depth lane child must be a proper step (id/label/status); an
    // arbitrary object would crash the renderer (path keys come from step.id),
    // so the schema rejects it.
    expect(
      validate({
        steps: [
          {
            kind: 'branch',
            id: 'g',
            label: 'Group',
            lanes: [
              {
                id: 'l1',
                steps: [
                  {
                    id: 's',
                    label: 'Parent',
                    status: 'running',
                    children: [{ reason: 'not a step' }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });
});

describe('rewound steps', () => {
  const rewoundStep: RunStep = {
    id: 'speculative',
    label: 'Speculative write',
    status: 'succeeded',
    rewound: true,
    details: [{ id: 'log', label: 'Log', content: 'unwound after conflict' }],
  };

  test('flags a rewound step with a data attribute and visible badge', () => {
    const { container, getByText } = render(RunStepTimeline, {
      steps: [rewoundStep] as RunStepTimelineEntry[],
    });
    expect(
      container.querySelector('.cinder-run-step-timeline__item[data-cinder-rewound]'),
    ).not.toBeNull();
    // State conveyed as text, not color alone.
    expect(getByText('Rewound')).not.toBeNull();
  });

  test('keeps a rewound step inspectable (details still render)', () => {
    const { container } = render(RunStepTimeline, {
      steps: [rewoundStep] as RunStepTimelineEntry[],
    });
    expect(container.querySelector('.cinder-run-step-timeline__details')).not.toBeNull();
  });

  test('does not flag a normal step as rewound', () => {
    const { container } = render(RunStepTimeline, {
      steps: [{ id: 'normal', label: 'Normal', status: 'succeeded' }] as RunStepTimelineEntry[],
    });
    expect(
      container.querySelector('.cinder-run-step-timeline__item[data-cinder-rewound]'),
    ).toBeNull();
  });
});

describe('compensation', () => {
  test('insets and labels a step that compensates a resolvable forward step', () => {
    const steps: RunStepTimelineEntry[] = [
      { id: 'charge', label: 'Charge card', status: 'succeeded' },
      { id: 'refund', label: 'Refund card', status: 'succeeded', compensates: 'charge' },
    ];
    const { container } = render(RunStepTimeline, { steps });
    const compensating = container.querySelector(
      '.cinder-run-step-timeline__item[data-cinder-compensation]',
    );
    expect(compensating).not.toBeNull();
    expect(container.textContent).toContain('Compensates Charge card');
  });

  test('renders a step with an unresolved compensates id in place, without inset', () => {
    const steps: RunStepTimelineEntry[] = [
      { id: 'refund', label: 'Refund card', status: 'succeeded', compensates: 'does-not-exist' },
    ];
    const { container } = render(RunStepTimeline, { steps });
    expect(
      container.querySelector('.cinder-run-step-timeline__item[data-cinder-compensation]'),
    ).toBeNull();
    expect(container.textContent).not.toContain('Compensates');
  });

  test('resolves a compensation against a sibling within the same branch lane', () => {
    const lanedSaga: RunStepBranchGroup = {
      kind: 'branch',
      id: 'saga',
      label: 'Saga',
      lanes: [
        {
          id: 'lane-a',
          label: 'A',
          steps: [
            { id: 'charge', label: 'Charge card', status: 'succeeded' },
            { id: 'refund', label: 'Refund card', status: 'succeeded', compensates: 'charge' },
          ],
        },
      ],
    };
    const { container } = render(RunStepTimeline, { steps: [lanedSaga] as RunStepTimelineEntry[] });
    expect(container.textContent).toContain('Compensates Charge card');
  });

  test('does not resolve a compensation to a nested descendant (siblings only)', () => {
    // "charge" exists only as a child of "parent"; a top-level step compensating
    // "charge" must NOT match that descendant — compensates targets a sibling.
    const steps: RunStepTimelineEntry[] = [
      {
        id: 'parent',
        label: 'Parent',
        status: 'succeeded',
        children: [{ id: 'charge', label: 'Charge card', status: 'succeeded' }],
      },
      { id: 'refund', label: 'Refund card', status: 'succeeded', compensates: 'charge' },
    ];
    const { container } = render(RunStepTimeline, { steps });
    expect(container.textContent).not.toContain('Compensates Charge card');
  });

  test('does not resolve a compensation across a lane boundary (sibling scope only)', () => {
    // `compensates` is documented as a SIBLING step id. A top-level step must
    // not resolve to a same-id step inside a branch lane (which could pick the
    // wrong one when ids repeat across lanes).
    const steps: RunStepTimelineEntry[] = [
      branchGroup, // contains a lane step id "blue-deploy"
      { id: 'undo-blue', label: 'Undo blue', status: 'succeeded', compensates: 'blue-deploy' },
    ];
    const { container } = render(RunStepTimeline, { steps });
    expect(container.textContent).not.toContain('Compensates Deploy blue');
    // The unresolved compensation renders in place, without the inset marker.
    const undo = [...container.querySelectorAll('.cinder-run-step-timeline__item')].find((el) =>
      el.textContent?.includes('Undo blue'),
    );
    expect(undo?.hasAttribute('data-cinder-compensation')).toBe(false);
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

  test('CSS sidecar imports composed primitive styles', () => {
    const { readFileSync } = require('node:fs');
    const css = readFileSync(
      new URL('./run-step-timeline.css', import.meta.url).pathname,
      'utf8',
    ) as string;

    expect(css).toContain("@import '../badge/badge.css';");
    expect(css).toContain("@import '../collapsible/collapsible.css';");
    expect(css).toContain("@import '../link/link.css';");
    expect(css).toContain("@import '../progress/progress.css';");
    expect(css).toContain("@import '../status-dot/status-dot.css';");
  });
});
