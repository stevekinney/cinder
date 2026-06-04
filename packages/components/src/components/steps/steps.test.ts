/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Steps } = await import('./steps.svelte');

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

  test('horizontal marker stacks above the connector line passing behind it', () => {
    const body = ruleBody(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__marker\s*\{/,
    );
    expect(body).toMatch(/position:\s*relative;/);
    expect(body).toMatch(/z-index:\s*1;/);
  });

  test('horizontal body centers its label and description under the marker', () => {
    const body = ruleBody(
      /\.cinder-steps\[data-cinder-orientation='horizontal'\]\s*\.cinder-steps__body\s*\{/,
    );
    expect(body).toMatch(/text-align:\s*center;/);
    expect(body).toMatch(/align-items:\s*center;/);
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
  });
});
