import { describe, expect, test } from 'bun:test';

const cssPath = `${import.meta.dir}/components/_scroll-fade.css`;

async function readCss(): Promise<string> {
  return Bun.file(cssPath).text();
}

/** Strips `/* … *​/` comments so assertions never accidentally match commentary. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** One edge recipe: a (selector, pseudo-element, axis, size-property, margin-property) tuple. */
type EdgeRecipe = {
  name: string;
  selector: string;
  pseudo: '::before' | '::after';
  attribute: string;
  sizeProperty: 'block-size' | 'inline-size';
  marginProperty: string;
  keyframeName: string;
};

const EDGE_RECIPES: EdgeRecipe[] = [
  {
    name: 'block-end',
    selector: '.cinder-_scroll-fade',
    pseudo: '::after',
    attribute: 'data-cinder-overflows',
    sizeProperty: 'block-size',
    marginProperty: 'margin-block-start',
    keyframeName: 'cinder-scroll-fade-block-end',
  },
  {
    name: 'block-start',
    selector: '.cinder-_scroll-fade-start',
    pseudo: '::before',
    attribute: 'data-cinder-overflows-start',
    sizeProperty: 'block-size',
    marginProperty: 'margin-block-end',
    keyframeName: 'cinder-scroll-fade-block-start',
  },
  {
    name: 'inline-end',
    selector: '.cinder-_scroll-fade-inline-end',
    pseudo: '::after',
    attribute: 'data-cinder-overflows-inline-end',
    sizeProperty: 'inline-size',
    marginProperty: 'margin-inline-start',
    keyframeName: 'cinder-scroll-fade-inline-end',
  },
  {
    name: 'inline-start',
    selector: '.cinder-_scroll-fade-inline-start',
    pseudo: '::before',
    attribute: 'data-cinder-overflows-inline-start',
    sizeProperty: 'inline-size',
    marginProperty: 'margin-inline-end',
    keyframeName: 'cinder-scroll-fade-inline-start',
  },
];

/** Extracts every `selector { … }` top-level-ish rule body (non-nested) matching an ALREADY-escaped `selector`. */
function findRuleBody(css: string, escapedSelector: string): string {
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? '';
}

/** Extracts every `@supports [^{]*\{ … \n  }` block body (the outer, not nested, closing brace). */
function findSupportsBlocks(css: string): string[] {
  return [...css.matchAll(/@supports[^{]*\{([\s\S]*?)\n\s{0,2}\}/g)].map((match) => match[1] ?? '');
}

describe('shared scroll-fade recipe', () => {
  test('never contains a mask- property (PR #972 invariant, generalized)', async () => {
    const css = stripComments(await readCss());
    expect(css).not.toMatch(/(?:-webkit-)?mask(?:-[a-z]+)?\s*:/);
  });

  test('is a self-declared shared partial with no layer-order prelude (matches _floating-surface.css/_status-surface.css)', async () => {
    const css = await readCss();
    const firstNonCommentLine = stripComments(css).trimStart();
    expect(firstNonCommentLine.startsWith('@layer cinder.components {')).toBe(true);
  });

  test('never sets animation-duration — reduced motion must stay governed solely by the global foundation rule', async () => {
    const css = stripComments(await readCss());
    expect(css).not.toMatch(/animation-duration\s*:/);
  });

  test('the size token is public and the color token is private', async () => {
    const css = stripComments(await readCss());
    expect(css).toMatch(/--cinder-scroll-fade-size\s*:/);
    expect(css).toMatch(/var\(--_cinder-scroll-fade-color\)/);
  });

  test('there are exactly four @supports blocks — one per edge recipe — each wrapping only animation/animation-timeline', async () => {
    const css = stripComments(await readCss());
    const supportsBlocks = findSupportsBlocks(css);
    expect(supportsBlocks.length).toBe(EDGE_RECIPES.length);
    for (const block of supportsBlocks) {
      expect(block).toMatch(/animation\s*:/);
      expect(block).toMatch(/animation-timeline\s*:/);
      // No gradient/background declared a second time inside the guard — the
      // base rule owns the gradient exactly once per edge.
      expect(block).not.toMatch(/background\s*:/);
      expect(block).not.toMatch(/linear-gradient/);
    }
  });

  test('exactly one linear-gradient per edge recipe (four total)', async () => {
    const css = stripComments(await readCss());
    const gradientOccurrences = (css.match(/linear-gradient/g) ?? []).length;
    // Each RTL override rule ALSO declares one gradient (a flipped physical
    // direction), so the two inline edges contribute two gradients each.
    expect(gradientOccurrences).toBe(6);
  });

  test('animation-timeline follows the animation shorthand in every rule (the shorthand resets it)', async () => {
    const css = stripComments(await readCss());
    // Rules setting `animation: none` (the forced-colors overrides) also
    // match `animation\s*:` but never pair with `animation-timeline` — only
    // the four `@supports` rules that actually start the scroll-timeline
    // animation are in scope for this ordering rule.
    const rulesWithAnimation = (css.match(/\{[^{}]*animation\s*:[^{}]*\}/g) ?? []).filter((rule) =>
      rule.includes('animation-timeline'),
    );
    expect(rulesWithAnimation.length).toBe(EDGE_RECIPES.length);
    for (const rule of rulesWithAnimation) {
      const shorthandIndex = rule.search(/animation\s*:/);
      const timelineIndex = rule.search(/animation-timeline\s*:/);
      expect(timelineIndex).toBeGreaterThan(shorthandIndex);
    }
  });

  test('forced-colors overrides use `animation: none`, not the scroll-timeline shorthand', async () => {
    const css = stripComments(await readCss());
    const animationNoneRules = (css.match(/\{[^{}]*animation:\s*none;[^{}]*\}/g) ?? []).filter(
      (rule) => !rule.includes('animation-timeline'),
    );
    expect(animationNoneRules.length).toBe(EDGE_RECIPES.length);
  });

  test('every scroll() timeline uses "nearest", never "self" — the animation targets a non-scrolling pseudo-element', async () => {
    const css = stripComments(await readCss());
    const timelineDeclarations = css.match(/animation-timeline\s*:\s*scroll\([^)]*\)\s*;/g) ?? [];
    expect(timelineDeclarations.length).toBe(EDGE_RECIPES.length);
    for (const declaration of timelineDeclarations) {
      expect(declaration).toMatch(/scroll\(\s*nearest\b/);
      expect(declaration).not.toMatch(/scroll\(\s*self\b/);
    }
  });

  test('block recipes use "nearest block"; inline recipes use "nearest inline"', async () => {
    const css = stripComments(await readCss());
    expect(css).toMatch(/animation-timeline:\s*scroll\(nearest block\)/g);
    const blockOccurrences = (css.match(/scroll\(nearest block\)/g) ?? []).length;
    const inlineOccurrences = (css.match(/scroll\(nearest inline\)/g) ?? []).length;
    expect(blockOccurrences).toBe(2);
    expect(inlineOccurrences).toBe(2);
  });

  test('keyframe names are cinder-prefixed and match each edge recipe exactly', async () => {
    const css = stripComments(await readCss());
    const keyframeNames = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]);
    const expectedNames = EDGE_RECIPES.map((recipe) => recipe.keyframeName);
    const alphabetically = (a?: string, b?: string) => (a ?? '').localeCompare(b ?? '');
    expect(keyframeNames.toSorted(alphabetically)).toEqual(expectedNames.toSorted(alphabetically));
    for (const name of keyframeNames) {
      expect(name).toMatch(/^cinder-/);
    }
  });

  test('forced-colors disables every edge outright — via BOTH animation:none and opacity:0', async () => {
    const css = stripComments(await readCss());
    for (const recipe of EDGE_RECIPES) {
      const escapedSelector = recipe.selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `@media\\s*\\(forced-colors:\\s*active\\)\\s*\\{\\s*${escapedSelector}${recipe.pseudo}\\s*\\{([^}]*)\\}`,
      );
      const match = css.match(pattern);
      expect(match).not.toBeNull();
      const body = match?.[1] ?? '';
      // opacity:0 ALONE cannot beat a still-running scroll-driven animation
      // (a running CSS Animation's keyframe value beats any normal-priority
      // author declaration) — the animation itself must be stopped too.
      expect(body).toMatch(/animation:\s*none;/);
      expect(body).toMatch(/opacity:\s*0;/);
    }
  });

  for (const recipe of EDGE_RECIPES) {
    describe(`${recipe.name} edge (${recipe.selector}${recipe.pseudo})`, () => {
      test('the attribute fallback rule sits OUTSIDE every @supports block', async () => {
        const css = stripComments(await readCss());
        const supportsBlocks = findSupportsBlocks(css).join('\n');
        expect(supportsBlocks).not.toContain(`[${recipe.attribute}]`);

        const escapedSelector = recipe.selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const fallbackPattern = new RegExp(
          `${escapedSelector}\\[${recipe.attribute}\\]${recipe.pseudo}\\s*\\{[^}]*opacity:\\s*1;`,
        );
        expect(css).toMatch(fallbackPattern);
      });

      test('the overlay ignores pointer events and its margin exactly cancels its own size', async () => {
        const css = stripComments(await readCss());
        const escapedSelector = recipe.selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const ruleBody = findRuleBody(css, `${escapedSelector}${recipe.pseudo}`);
        expect(ruleBody).not.toBe('');
        expect(ruleBody).toMatch(/pointer-events:\s*none/);

        const sizeMatch = ruleBody.match(new RegExp(`${recipe.sizeProperty}:\\s*([^;]+);`));
        const marginMatch = ruleBody.match(new RegExp(`${recipe.marginProperty}:\\s*([^;]+);`));
        expect(sizeMatch).not.toBeNull();
        expect(marginMatch).not.toBeNull();
        const size = sizeMatch![1]!.trim();
        const margin = marginMatch![1]!.trim();
        expect(margin).toBe(`calc(${size} * -1)`);
      });
    });
  }
});

describe('scroll-fade regression: overlay bodies never reintroduce a mask (PR #972)', () => {
  const overlayFiles = [
    `${import.meta.dir}/../components/modal/modal.css`,
    `${import.meta.dir}/../components/drawer/drawer.css`,
    `${import.meta.dir}/../components/sheet/sheet.css`,
  ];

  for (const filePath of overlayFiles) {
    test(`${filePath.split('/').at(-1)} has no mask- property`, async () => {
      const css = stripComments(await Bun.file(filePath).text());
      expect(css).not.toMatch(/(?:-webkit-)?mask(?:-[a-z]+)?\s*:/);
    });
  }
});
