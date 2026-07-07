/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Steps } = await import('./steps.svelte');
const { default: ExportedSteps } = await import('@lostgradient/cinder/steps');

// Read once at module load — `describe` callbacks are synchronous, so the
// CSS-contract tests below reference this constant instead of awaiting inside them.
const stepsCss = await Bun.file(new URL('./steps.css', import.meta.url)).text();

const defaultSteps = [
  { id: 'a', label: 'Set up profile', description: 'Tell us about yourself' },
  { id: 'b', label: 'Connect account', description: 'Link your services' },
  { id: 'c', label: 'Invite teammates' },
  { id: 'd', label: 'Done' },
];

describe('Steps', () => {
  test('browser/Svelte export renders completed, current, and upcoming items without SVG initialization errors', () => {
    const { container } = render(ExportedSteps, {
      steps: [
        { id: 'completed', label: 'Read the brief' },
        { id: 'current', label: 'Configure the project' },
        { id: 'upcoming', label: 'Invite teammates' },
      ],
      currentStep: 1,
      label: 'Setup progress',
    });

    const items = Array.from(container.querySelectorAll('.cinder-steps__item'));
    expect(items.length).toBe(3);
    expect(items.map((item) => item.getAttribute('data-cinder-state'))).toEqual([
      'complete',
      'current',
      'upcoming',
    ]);
    expect(items[0]?.querySelector('svg.cinder-steps__check')).not.toBeNull();
    expect(items[1]?.querySelector('.cinder-steps__index')?.textContent).toBe('2');
    expect(items[2]?.querySelector('.cinder-steps__index')?.textContent).toBe('3');
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain(
      'Configure the project',
    );
  });

  test('renders the supplied step labels and descriptions', () => {
    const { container } = render(Steps, { steps: defaultSteps, currentStep: 1 });
    for (const step of defaultSteps) {
      expect(container.textContent).toContain(step.label);
    }
    expect(container.textContent).toContain('Tell us about yourself');
    expect(container.textContent).toContain('Link your services');
  });

  test('marks the active step with aria-current="step" on the list item', () => {
    const { container } = render(Steps, { steps: defaultSteps, currentStep: 1 });
    const current = Array.from(container.querySelectorAll('[aria-current="step"]'));
    expect(current.length).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(current[0]!.tagName).toBe('LI');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(current[0]!.textContent).toContain('Connect account');
  });

  test('completed steps include visually-hidden completion text inside the li', () => {
    const { container } = render(Steps, { steps: defaultSteps, currentStep: 2 });
    const items = Array.from(container.querySelectorAll('li'));
    expect(items.length).toBe(4);

    const [first, second, third, fourth] = items;

    // First two are complete
    for (const item of [first!, second!]) {
      const srOnly = item.querySelector('.cinder-steps__sr-only');
      expect(srOnly).not.toBeNull();
      expect(srOnly?.textContent).toContain('Completed');
      expect(item.querySelector('.cinder-steps__check')).not.toBeNull();
      expect(item.querySelector('.cinder-steps__index')).toBeNull();
    }

    // Current and upcoming should not have sr-only
    for (const item of [third!, fourth!]) {
      expect(item.querySelector('.cinder-steps__sr-only')).toBeNull();
      expect(item.querySelector('.cinder-steps__index')).not.toBeNull();
    }
  });

  test('completedLabel prop overrides the default visually-hidden text', () => {
    const { container } = render(Steps, {
      steps: defaultSteps,
      currentStep: 2,
      completedLabel: 'Finished',
    });
    const srOnlySpans = container.querySelectorAll('.cinder-steps__sr-only');
    expect(srOnlySpans.length).toBe(2);
    for (const span of srOnlySpans) {
      expect(span.textContent).toBe('Finished');
    }
  });

  test('completedLabel is separated from the visible step label in accessible text', () => {
    const { container } = render(Steps, {
      steps: defaultSteps,
      currentStep: 1,
      completedLabel: 'Finished',
    });
    const firstItem = container.querySelector('li');
    expect(firstItem?.textContent).not.toContain('FinishedSet up profile');
    expect(firstItem?.textContent).toMatch(/Finished\s+Set up profile/);
  });

  test('explicit skipped steps do not inherit completed styling or completed accessible text', () => {
    const { container } = render(Steps, {
      steps: [
        { id: 'a', label: 'Account' },
        { id: 'b', label: 'Optional profile', state: 'skipped' },
        { id: 'c', label: 'Review' },
      ],
      currentStep: 2,
      skippedLabel: 'Skipped',
    });

    const items = Array.from(container.querySelectorAll('.cinder-steps__item'));
    expect(items.map((item) => item.getAttribute('data-cinder-state'))).toEqual([
      'complete',
      'skipped',
      'current',
    ]);

    const skipped = items[1];
    expect(skipped?.querySelector('.cinder-steps__check')).toBeNull();
    expect(skipped?.querySelector('.cinder-steps__index')?.textContent).toBe('2');
    expect(skipped?.textContent).not.toContain('Completed');
    expect(skipped?.textContent).toMatch(/Skipped\s+Optional profile/);
  });

  test('only honors skipped overrides before currentStep and ignores active or future overrides', () => {
    const { container } = render(Steps, {
      steps: [
        { id: 'a', label: 'Account' },
        { id: 'b', label: 'Profile', state: 'skipped' },
        { id: 'c', label: 'Review', state: 'skipped' },
        { id: 'd', label: 'Confirm', state: 'current' as never },
      ],
      currentStep: 2,
    });

    const items = Array.from(container.querySelectorAll('.cinder-steps__item'));
    expect(items.map((item) => item.getAttribute('data-cinder-state'))).toEqual([
      'complete',
      'skipped',
      'current',
      'upcoming',
    ]);
    expect(container.querySelectorAll('[aria-current="step"]').length).toBe(1);
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain('Review');
  });

  test('connectors behind skipped past steps still show completed progress', () => {
    const { container } = render(Steps, {
      steps: [
        { id: 'a', label: 'Account' },
        { id: 'b', label: 'Optional profile', state: 'skipped' },
        { id: 'c', label: 'Review' },
      ],
      currentStep: 2,
    });

    const connectors = Array.from(container.querySelectorAll('.cinder-steps__connector'));
    expect(connectors.map((connector) => connector.getAttribute('data-cinder-state'))).toEqual([
      'complete',
      'complete',
    ]);
  });

  test('orientation prop drives layout via data-cinder-orientation', () => {
    const { container: hContainer } = render(Steps, {
      steps: defaultSteps,
      currentStep: 0,
    });
    expect(hContainer.querySelector('nav')?.getAttribute('data-cinder-orientation')).toBe(
      'horizontal',
    );

    const { container: vContainer } = render(Steps, {
      steps: defaultSteps,
      currentStep: 0,
      orientation: 'vertical',
    });
    expect(vContainer.querySelector('nav')?.getAttribute('data-cinder-orientation')).toBe(
      'vertical',
    );
  });

  test('does not render role="progressbar"', () => {
    const { container } = render(Steps, { steps: defaultSteps, currentStep: 1 });
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  test('clamps out-of-range currentStep values', () => {
    const { container: loContainer } = render(Steps, { steps: defaultSteps, currentStep: -3 });
    const loCurrent = Array.from(loContainer.querySelectorAll('[aria-current="step"]'));
    expect(loCurrent.length).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(loCurrent[0]!.textContent).toContain('Set up profile');

    const { container: hiContainer } = render(Steps, { steps: defaultSteps, currentStep: 99 });
    // All steps complete, no current
    expect(hiContainer.querySelectorAll('[aria-current="step"]').length).toBe(0);
    expect(hiContainer.querySelectorAll('.cinder-steps__sr-only').length).toBe(4);
  });

  test('currentStep === steps.length renders all steps as complete with no current', () => {
    const { container } = render(Steps, { steps: defaultSteps, currentStep: 4 });
    expect(container.querySelectorAll('[aria-current="step"]').length).toBe(0);
    expect(container.querySelectorAll('.cinder-steps__sr-only').length).toBe(4);
  });

  test('exposes the nav landmark with the default label', () => {
    const { container } = render(Steps, { steps: defaultSteps, currentStep: 0 });
    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute('aria-label')).toBe('Progress');
  });

  test('label prop overrides the nav accessible name', () => {
    const { container } = render(Steps, { steps: defaultSteps, currentStep: 0, label: 'Wizard' });
    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute('aria-label')).toBe('Wizard');
  });

  test('empty steps array renders an empty nav without throwing', () => {
    const { container } = render(Steps, { steps: [], currentStep: 0 });
    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
    const ol = container.querySelector('ol');
    expect(ol).not.toBeNull();
    expect(container.querySelectorAll('li').length).toBe(0);
    expect(container.querySelectorAll('[aria-current="step"]').length).toBe(0);
  });

  test('reorder preserves the list-item DOM identity by id', async () => {
    const stepsABC = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' },
    ];

    const { container, rerender } = render(Steps, { steps: stepsABC, currentStep: 0 });
    const items = container.querySelectorAll('li');
    const betaNode = items[1];
    expect(betaNode).not.toBeUndefined();

    await rerender({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      steps: [stepsABC[2]!, stepsABC[1]!, stepsABC[0]!],
      currentStep: 0,
    });

    const reorderedItems = container.querySelectorAll('li');
    const betaAfterReorder = reorderedItems[1];
    expect(betaAfterReorder).not.toBeUndefined();
    // Beta is at index 1 in [c, b, a] — verify content and stable DOM identity
    expect(betaAfterReorder?.textContent).toContain('Beta');
    expect(betaAfterReorder).toBe(betaNode);
  });
});

describe('Steps — interactive step items', () => {
  test('href step renders the body as an <a> whose name contains label + description', () => {
    const steps = [
      { id: 'a', label: 'Account', description: 'Sign in', href: '/account' },
      { id: 'b', label: 'Review' },
    ];
    const { container } = render(Steps, { steps, currentStep: 1 });
    const anchor = container.querySelector('a.cinder-steps__interactive') as HTMLAnchorElement;
    expect(anchor).not.toBeNull();
    expect(anchor.getAttribute('href')).toBe('/account');
    expect(anchor.tagName).toBe('A');
    expect(anchor.textContent).toContain('Account');
    expect(anchor.textContent).toContain('Sign in');
    // Marker stays a separate non-interactive sibling (not inside the anchor).
    const li = anchor.closest('li') as HTMLElement;
    const marker = li.querySelector('.cinder-steps__marker') as HTMLElement;
    expect(marker).not.toBeNull();
    expect(anchor.contains(marker)).toBe(false);
  });

  test('onclick step renders a <button type="button"> and clicking invokes the callback', async () => {
    let clicked = 0;
    const steps = [
      { id: 'a', label: 'Activate', onclick: () => (clicked += 1) },
      { id: 'b', label: 'Review' },
    ];
    const { container } = render(Steps, { steps, currentStep: 0 });
    const button = container.querySelector('button.cinder-steps__interactive') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.getAttribute('type')).toBe('button');
    button.click();
    expect(clicked).toBe(1);
  });

  test('empty-string href still renders an <a> (presence, not truthiness)', () => {
    const steps = [
      { id: 'a', label: 'Empty', href: '', onclick: () => {} },
      { id: 'b', label: 'Next' },
    ];
    const { container } = render(Steps, { steps, currentStep: 0 });
    const anchor = container.querySelector('a.cinder-steps__interactive') as HTMLAnchorElement;
    expect(anchor).not.toBeNull();
    expect(anchor.getAttribute('href')).toBe('');
    // Must NOT fall through to the button arm just because href is falsy.
    expect(container.querySelector('button.cinder-steps__interactive')).toBeNull();
  });

  test('plain step renders neither <a> nor <button>', () => {
    const steps = [{ id: 'a', label: 'Plain' }];
    const { container } = render(Steps, { steps, currentStep: 0 });
    expect(container.querySelector('.cinder-steps__interactive')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('span.cinder-steps__body')).not.toBeNull();
  });

  test('href + onclick together renders an <a> and still invokes the callback', () => {
    let clicked = 0;
    const steps = [
      { id: 'a', label: 'Go', href: '/go', onclick: () => (clicked += 1) },
      { id: 'b', label: 'Next' },
    ];
    const { container } = render(Steps, { steps, currentStep: 0 });
    const anchor = container.querySelector('a.cinder-steps__interactive') as HTMLAnchorElement;
    expect(anchor).not.toBeNull();
    expect(container.querySelector('button.cinder-steps__interactive')).toBeNull();
    anchor.click();
    expect(clicked).toBe(1);
  });

  test('interactive current step carries aria-current on the interactive element, not the li', () => {
    const steps = [
      { id: 'a', label: 'Done', href: '/done' },
      { id: 'b', label: 'Current', href: '/current' },
      { id: 'c', label: 'Next', href: '/next' },
    ];
    const { container } = render(Steps, { steps, currentStep: 1 });
    const current = Array.from(container.querySelectorAll('[aria-current="step"]'));
    expect(current.length).toBe(1);
    expect(current[0]?.classList.contains('cinder-steps__interactive')).toBe(true);
    expect(current[0]?.tagName).toBe('A');
    // The owning li must NOT also carry aria-current.
    expect(current[0]?.closest('li')?.hasAttribute('aria-current')).toBe(false);
  });

  test('static current step keeps aria-current on the li', () => {
    const steps = [
      { id: 'a', label: 'One' },
      { id: 'b', label: 'Two' },
    ];
    const { container } = render(Steps, { steps, currentStep: 0 });
    const current = Array.from(container.querySelectorAll('[aria-current="step"]'));
    expect(current.length).toBe(1);
    expect(current[0]?.tagName).toBe('LI');
  });

  test('element switching: static → button → link → static, with aria-current following', async () => {
    const base = { id: 'a', label: 'Switcher' };
    const second = { id: 'b', label: 'Second' };
    const { container, rerender } = render(Steps, {
      steps: [base, second],
      currentStep: 0,
    });

    // static
    expect(container.querySelector('.cinder-steps__interactive')).toBeNull();
    expect(container.querySelector('li[aria-current="step"]')).not.toBeNull();

    // → button (add onclick)
    await rerender({ steps: [{ ...base, onclick: () => {} }, second], currentStep: 0 });
    let interactive = container.querySelector('.cinder-steps__interactive');
    expect(interactive?.tagName).toBe('BUTTON');
    expect(container.querySelector('a.cinder-steps__interactive')).toBeNull();
    expect(interactive?.getAttribute('aria-current')).toBe('step');
    expect(interactive?.closest('li')?.hasAttribute('aria-current')).toBe(false);

    // → link (add href)
    await rerender({ steps: [{ ...base, href: '/x' }, second], currentStep: 0 });
    interactive = container.querySelector('.cinder-steps__interactive');
    expect(interactive?.tagName).toBe('A');
    expect(container.querySelector('button.cinder-steps__interactive')).toBeNull();
    expect(interactive?.getAttribute('aria-current')).toBe('step');

    // → static (remove both)
    await rerender({ steps: [base, second], currentStep: 0 });
    expect(container.querySelector('.cinder-steps__interactive')).toBeNull();
    expect(container.querySelector('li[aria-current="step"]')).not.toBeNull();
  });

  test('vertical interactive step bodies preserve static bottom spacing', () => {
    expect(stepsCss).toMatch(
      /\.cinder-steps\[data-cinder-orientation='vertical'\]\s*\.cinder-steps__interactive\.cinder-steps__body\s*\{[^}]*padding-bottom:\s*var\(--cinder-space-4\);/m,
    );
  });

  test('vertical step bodies align label content with the marker row', () => {
    const match = stepsCss.match(
      /\.cinder-steps\[data-cinder-orientation='vertical'\]\s*\.cinder-steps__body\s*\{(?<body>[^}]*)\}/m,
    );
    expect(match?.groups?.['body']).toContain('padding-block-start: 0;');
  });
});

// Layout geometry is not observable in happy-dom (no layout engine), so these
// pin the CSS contract by reading steps.css as text — the same approach the
// vertical-spacing test above uses. They guard the wide-horizontal "each step
// reads as one centered unit" design and the narrow stacked fallback.
describe('Steps — horizontal layout geometry (CSS contract)', () => {
  /** Extract the body of the first rule whose selector matches `selectorRegex`. */
  const ruleBody = (selectorRegex: RegExp): string => {
    const pos = stepsCss.search(selectorRegex);
    expect(pos, `selector not found: ${selectorRegex}`).toBeGreaterThan(-1);
    const source = stepsCss.slice(pos);
    const open = source.indexOf('{');
    const close = source.indexOf('}', open);
    expect(open).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(open);
    return source.slice(open + 1, close);
  };

  test('horizontal item is a centered flex column so marker + label read as a unit', () => {
    const body = ruleBody(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__item\s*\{/,
    );
    expect(body).toMatch(/display:\s*flex;/);
    expect(body).toMatch(/flex-direction:\s*column;/);
    expect(body).toMatch(/align-items:\s*center;/);
    // Must be positioned so the absolutely-positioned connector anchors to it.
    expect(body).toMatch(/position:\s*relative;/);
    // Equal-width columns keep every marker at the center of its track share.
    expect(body).toMatch(/flex:\s*1 1 0;/);
  });

  test('horizontal connector spans from this marker center to the next marker center', () => {
    const body = ruleBody(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__connector\s*\{/,
    );
    expect(body).toMatch(/position:\s*absolute;/);
    // Starts at this marker's center (50%) and runs one full item-width to the
    // next center (100%). Logical inset keeps it correct under RTL.
    expect(body).toMatch(/inset-inline-start:\s*50%;/);
    expect(body).toMatch(/width:\s*100%;/);
    // Painted as a thin line behind the markers.
    expect(body).toMatch(/z-index:\s*0;/);
  });

  test('horizontal marker stacks above both the connector line and the focusable body', () => {
    const body = ruleBody(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__marker\s*\{/,
    );
    expect(body).toMatch(/position:\s*relative;/);
    // z-index: 2 — one level above the focusable body (z-index: 1), whose box
    // overlaps the marker and whose :hover background is opaque, so the marker
    // must out-rank it to avoid being occluded on hover.
    expect(body).toMatch(/z-index:\s*2;/);
  });

  test('horizontal body centers its label and description under the marker', () => {
    const body = ruleBody(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__body\s*\{/,
    );
    expect(body).toMatch(/text-align:\s*center;/);
    expect(body).toMatch(/align-items:\s*center;/);
  });

  test('horizontal interactive body hugs centered content instead of spanning the column', () => {
    // The focusable <a>/<button> must NOT stretch to inline-size: 100% in the
    // wide layout — that makes its :focus-visible ring box the whole equal-width
    // column. It centers on a content-width box so the ring is a pill under the
    // marker. Match the wide-layout interactive-body rule specifically (the one
    // with the marker-capture margin), not the base reset or the narrow override.
    const body = ruleBody(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__interactive\.cinder-steps__body\s*\{[^}]*margin-block-start/,
    );
    expect(body).toMatch(/inline-size:\s*auto;/);
    expect(body).toMatch(/max-inline-size:\s*100%;/);
    expect(body).toMatch(/align-self:\s*center;/);
  });

  test('horizontal interactive body captures the marker into the focus ring with zero net shift', () => {
    // The box's top edge rises by the marker diameter (negative block-start
    // margin) so the focus ring encloses the marker; an equal-plus-existing
    // padding restores the label/description position so content does not move.
    const body = ruleBody(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__interactive\.cinder-steps__body\s*\{[^}]*margin-block-start/,
    );
    // Negative margin equals one marker diameter — the in-flow distance from the
    // body's current top up to the marker's top.
    expect(body).toMatch(/margin-block-start:\s*calc\(-1 \* var\(--_marker-size\)\);/);
    // Added padding restores the marker diameter plus the body's existing space-2
    // top padding, so the visible content y-position is invariant.
    expect(body).toMatch(
      /padding-block-start:\s*calc\(var\(--_marker-size\) \+ var\(--cinder-space-2\)\);/,
    );
  });

  test('horizontal interactive body lifts its focus ring above the connector line', () => {
    // The focusable body must be positioned with a z-index so its :focus-visible
    // box-shadow ring paints ABOVE the connector (z-index: 0) instead of being
    // bisected by it. Regression guard for #401 (connector bisects focus ring).
    const body = ruleBody(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__interactive\.cinder-steps__body\s*\{[^}]*margin-block-start/,
    );
    expect(body).toMatch(/position:\s*relative;/);
    expect(body).toMatch(/z-index:\s*1;/);
  });

  test('horizontal stacking order is connector < focusable body < marker', () => {
    // The three painted layers in a horizontal step overlap geometrically (the
    // connector runs through the marker center; the body's negative block-start
    // margin pulls its box up over the marker). The required paint order is:
    //   connector (behind) < focusable body (focus ring above the line) < marker.
    // The marker must out-rank the body specifically because the body paints
    // LATER in DOM order and its :hover background is opaque, so equal z-index
    // would let the body occlude the marker on hover (#401 committee finding).
    const zIndexOf = (selector: RegExp): number => {
      const match = ruleBody(selector).match(/z-index:\s*(-?\d+);/);
      expect(match, `z-index not found for ${selector}`).not.toBeNull();
      return Number(match?.[1]);
    };
    const connector = zIndexOf(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__connector\s*\{/,
    );
    const interactiveBody = zIndexOf(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__interactive\.cinder-steps__body\s*\{[^}]*margin-block-start/,
    );
    const marker = zIndexOf(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__marker\s*\{/,
    );
    expect(connector).toBeLessThan(interactiveBody);
    expect(interactiveBody).toBeLessThan(marker);
  });

  test('skipped marker uses an opaque surface and forced-colors outline', () => {
    const skippedMarkerBody = ruleBody(
      /\[data-cinder-state='skipped'\]\s*\.cinder-steps__marker\s*\{/,
    );
    expect(skippedMarkerBody).toMatch(/background:\s*var\(--cinder-surface\);/);
    expect(skippedMarkerBody).toMatch(
      /box-shadow:\s*inset 0 0 0 1px var\(--cinder-border-muted\);/,
    );

    expect(stepsCss).toMatch(
      /@media \(forced-colors: active\)[\s\S]*?\[data-cinder-state='skipped'\]\s*\.cinder-steps__marker\s*\{[\s\S]*?outline:\s*1px solid ButtonText;[\s\S]*?box-shadow:\s*none;/,
    );
  });
});

describe('Steps — narrow horizontal fallback (CSS contract)', () => {
  // The narrow container query must fully undo the wide flex column and return
  // to the grid-based vertical-style layout. This guards the exact regression
  // where the flex base left the narrow connector collapsed to a stub.
  const narrowBlock = (() => {
    const start = stepsCss.search(/@container cinder-steps \(max-width: 32rem\)/);
    expect(start, '@container cinder-steps (max-width: 32rem) not found in CSS').toBeGreaterThan(
      -1,
    );
    // The container query is the last block in the file; take everything after it.
    return stepsCss.slice(start);
  })();

  const ruleBody = (selectorRegex: RegExp): string => {
    const pos = narrowBlock.search(selectorRegex);
    expect(pos, `selector not found in narrow block: ${selectorRegex}`).toBeGreaterThan(-1);
    const source = narrowBlock.slice(pos);
    const open = source.indexOf('{');
    const close = source.indexOf('}', open);
    expect(open).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(open);
    return source.slice(open + 1, close);
  };

  test('narrow item re-establishes the grid the wide flex column replaced', () => {
    const body = ruleBody(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__item\s*\{/,
    );
    expect(body).toMatch(/display:\s*grid;/);
    // Must reset align-items so the wide flex-column value (center) does not
    // vertically center grid items, which would float labels mid-track.
    expect(body).toMatch(/align-items:\s*stretch;/);
  });

  test('narrow connector returns to an in-flow vertical line under the marker', () => {
    const body = ruleBody(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__connector\s*\{/,
    );
    // Undo the wide layout's absolute positioning…
    expect(body).toMatch(/position:\s*static;/);
    expect(body).toMatch(/inset-inline-start:\s*auto;/);
    // …and place it as a vertical line in grid row 2 below the marker.
    expect(body).toMatch(/grid-row:\s*2;/);
    expect(body).toMatch(/width:\s*1px;/);
    expect(body).toMatch(/align-self:\s*stretch;/);
  });

  test('narrow body left-aligns beside the marker, undoing the centered wide layout', () => {
    const body = ruleBody(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__body\s*\{/,
    );
    expect(body).toMatch(/text-align:\s*start;/);
    // The grid fallback should match the vertical layout: label content starts
    // on the marker row instead of inheriting the wide body's top padding.
    expect(body).toMatch(/padding-block-start:\s*0;/);
  });

  test('narrow interactive body undoes the wide marker-capture geometry', () => {
    // The wide layout's content-width centering and negative-margin marker
    // capture are higher-specificity than the narrow base-body rule, so the
    // narrow grid must explicitly reset them or the focus box would be pulled
    // out of its column-2 grid cell and up over column 1.
    const body = ruleBody(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__interactive\.cinder-steps__body\s*\{/,
    );
    expect(body).toMatch(/inline-size:\s*100%;/);
    expect(body).toMatch(/align-self:\s*stretch;/);
    expect(body).toMatch(/margin-block-start:\s*0;/);
    expect(body).toMatch(/padding-block-start:\s*0;/);
  });
});
