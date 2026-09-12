/**
 * CIN-602/CIN-245: the computed-cascade half of the structural border tier
 * audit.
 *
 * `packages/components/src/styles/border-tier-non-border-uses.test.ts` scans
 * SOURCE TEXT across every workspace for a tier reference, and that scan is
 * real and still useful for what it can see. Five consecutive review rounds
 * found it narrower than its own claim, and every miss was the same shape: a
 * tier reference that is not literal text in any one file, because it only
 * exists once the CASCADE resolves it across files or through a generated
 * `:root` custom property. A text scan cannot see that by construction, no
 * matter how many properties or directories it is widened to cover.
 *
 * This file drives the two shapes a text scan cannot see from the real,
 * rendered cascade instead, via `CSS.getMatchedStylesForNode` (which reports
 * declarations with `var()`/`light-dark()` intact -- unlike
 * `getComputedStyle`, which resolves them away; see the CDP spike this ticket
 * is built on):
 *
 *   - a non-border use of a tier reached through ONE HOP of a custom-property
 *     alias, where the alias's own tier reference lives in a different rule
 *     (the Toggle track, whose `background` falls back to a custom property
 *     that only the GENERATED `tokens-base.css` -- excluded from the text
 *     scan's targets -- declares as a tier reference);
 *   - a tier reference (border declarations included) compounding with a
 *     fractional element `opacity` declared in a DIFFERENT file (a disabled
 *     Button: the border comes from `button.css`, the opacity from
 *     `foundation.css`'s shared disabled-visual rule).
 *
 * Both are computed here, from the real cascade, with no hand-maintained
 * per-file table: see `border-tier-audit.ts` for the classification logic
 * this replaces a source-text scan with.
 *
 * `AUDITED_SITES` below is the single list a later lane extends -- add a
 * site there (with its own `kind`, route, and selector) and re-run with
 * `CINDER_UPDATE_SEAM_AUDIT=1`; the generated doc section is rendered from
 * that same list, so there is nothing else to keep in sync by hand.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import {
  effectiveOpacity,
  flattenMatchedStyles,
  isBorderProperty,
  opacityCompoundedTierDeclarations,
  referencesBorderTier,
  tierNameIn,
  tierUses,
  type MatchedDeclaration,
} from '../src/helpers/border-tier-audit.ts';

const ROUTE_BUTTON = '/page/button?snapshot=1';
const ROUTE_TOGGLE = '/page/toggle?snapshot=1';
const DISABLED_ICON_BUTTON = '[data-testid="button-ghost-icon-only-disabled"]';
// A PLAIN (non-icon-only) disabled button, secondary variant. `button.css`'s
// base disabled rule (`.cinder-button:disabled`) sets `border-color: var(
// --cinder-border-muted)` alone and says so explicitly ("opacity centralized
// in foundation.css disabled-visual rule") -- no rule in either file pairs a
// border declaration with an `opacity` for this element. The icon-only ghost
// site above additionally matches a variant-specific rule that pairs
// `border-color` and `opacity: 0.6` in ONE rule body, which is a same-rule
// case `border-tier-non-border-uses.test.ts` already catches; this site has
// no such same-rule pairing anywhere, so it is the genuinely cross-file-only
// case a source-text scan structurally cannot see.
const DISABLED_PLAIN_BUTTON = '[data-testid="button-secondary-disabled"]';
// The first unchecked, non-disabled toggle track on the page -- the "Basic
// toggle" example, which starts `checked={false}`.
const RESTING_TOGGLE_TRACK = '.cinder-toggle:not([data-cinder-checked]):not(:disabled)';

/**
 * Every CSS declaration matched for `selector` (the element's own rules, plus
 * every ancestor's up to and including `:root`), via CDP's `CSS.enable` +
 * `CSS.getMatchedStylesForNode` -- `getComputedStyle`'s resolved values would
 * erase every `var()`/`light-dark()` this audit needs intact. Returns `null`
 * when `selector` matches nothing.
 */
async function matchedDeclarationsFor(
  page: Page,
  selector: string,
): Promise<MatchedDeclaration[] | null> {
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('DOM.enable');
    await client.send('CSS.enable');
    const { root } = await client.send('DOM.getDocument', { depth: -1, pierce: true });
    const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    if (!nodeId) return null;

    const matched = await client.send('CSS.getMatchedStylesForNode', { nodeId });
    return flattenMatchedStyles(matched);
  } finally {
    await client.detach();
  }
}

/** `getComputedStyle(element).opacity` from `selector` up through every ancestor, folded into one effective opacity via {@link effectiveOpacity}. `opacity` is always a literal number in this corpus, never a `var()`, so `getComputedStyle` loses nothing here. */
async function effectiveOpacityFor(page: Page, selector: string): Promise<number> {
  const opacities = await page.evaluate((sel) => {
    const values: number[] = [];
    let element: Element | null = document.querySelector(sel);
    while (element instanceof HTMLElement) {
      values.push(Number(getComputedStyle(element).opacity));
      element = element.parentElement;
    }
    return values;
  }, selector);
  return effectiveOpacity(opacities.filter((value) => Number.isFinite(value)));
}

test.describe('CIN-602/CIN-245: structural border tier uses, from the real cascade', () => {
  test('the disabled Button: border.muted compounds with a cross-file opacity, with no hand-maintained entry', async ({
    page,
  }) => {
    await page.goto(ROUTE_BUTTON, { waitUntil: 'load' });
    await page.locator(DISABLED_ICON_BUTTON).waitFor({ state: 'visible' });

    const declarations = await matchedDeclarationsFor(page, DISABLED_ICON_BUTTON);
    expect(declarations, 'the disabled icon-only ghost Button was not found').not.toBeNull();

    const opacity = await effectiveOpacityFor(page, DISABLED_ICON_BUTTON);
    expect(opacity, 'the disabled Button is expected to render at reduced opacity').toBeLessThan(1);

    const compounded = opacityCompoundedTierDeclarations(declarations!, opacity);
    expect(
      compounded.some(
        (declaration) =>
          isBorderProperty(declaration.property) &&
          referencesBorderTier(declaration.resolvedValue ?? declaration.value),
      ),
      `expected a border declaration naming a structural tier to compound with opacity ${opacity}; ` +
        `found: ${JSON.stringify(compounded)}`,
    ).toBe(true);
  });

  test('the plain disabled Button: border.muted compounds with an opacity declared in an ENTIRELY DIFFERENT rule, in a different file, with no hand-maintained entry', async ({
    page,
  }) => {
    // Unlike DISABLED_ICON_BUTTON, this element matches no variant-specific
    // rule that pairs `border-color` and `opacity` in the same rule body --
    // `button.css`'s base disabled rule sets `border-color` alone, and the
    // ONLY rule that ever sets this element's `opacity` lives in
    // `foundation.css`. This is the case a source-text scan cannot see even
    // in principle, because the two declarations never appear together as
    // literal text anywhere.
    await page.goto(ROUTE_BUTTON, { waitUntil: 'load' });
    await page.locator(DISABLED_PLAIN_BUTTON).waitFor({ state: 'visible' });

    const declarations = await matchedDeclarationsFor(page, DISABLED_PLAIN_BUTTON);
    expect(declarations, 'the disabled secondary Button was not found').not.toBeNull();

    const opacity = await effectiveOpacityFor(page, DISABLED_PLAIN_BUTTON);
    expect(opacity, 'the disabled Button is expected to render at reduced opacity').toBeLessThan(1);

    const compounded = opacityCompoundedTierDeclarations(declarations!, opacity);
    expect(
      compounded.some(
        (declaration) =>
          isBorderProperty(declaration.property) &&
          referencesBorderTier(declaration.resolvedValue ?? declaration.value),
      ),
      `expected a border declaration naming a structural tier to compound with opacity ${opacity}; ` +
        `found: ${JSON.stringify(compounded)}`,
    ).toBe(true);
  });

  test('the Toggle track: a one-hop alias through the GENERATED :root reaches an area fill, with no hand-maintained entry', async ({
    page,
  }) => {
    await page.goto(ROUTE_TOGGLE, { waitUntil: 'load' });
    await page.locator(RESTING_TOGGLE_TRACK).first().waitFor({ state: 'visible' });

    const declarations = await matchedDeclarationsFor(page, RESTING_TOGGLE_TRACK);
    expect(
      declarations,
      'a resting (unchecked, enabled) Toggle track was not found',
    ).not.toBeNull();

    const uses = tierUses(declarations!);
    expect(
      uses.some((use) => use.property === 'background' && use.viaAlias !== undefined),
      `expected a "background" use reached through one hop of a custom-property alias; ` +
        `found: ${JSON.stringify(uses)}`,
    ).toBe(true);
  });

  test('regression: the Button finding disappears if the cross-file opacity rule is removed', async ({
    page,
  }) => {
    // Proves the mechanism actually depends on reading foundation.css's
    // shared disabled-visual rule alongside button.css's border declaration
    // -- not a coincidence of some OTHER opacity rule. Overriding the shared
    // selector's opacity back to 1 removes exactly the fact this test exists
    // to catch, and the assertion above must fail without it.
    await page.goto(ROUTE_BUTTON, { waitUntil: 'load' });
    await page.locator(DISABLED_ICON_BUTTON).waitFor({ state: 'visible' });
    await page.addStyleTag({
      content: `.cinder-button:disabled:not([data-cinder-loading]) { opacity: 1 !important; }`,
    });

    const opacity = await effectiveOpacityFor(page, DISABLED_ICON_BUTTON);
    expect(opacity).toBe(1);

    const declarations = await matchedDeclarationsFor(page, DISABLED_ICON_BUTTON);
    const compounded = opacityCompoundedTierDeclarations(declarations!, opacity);
    expect(compounded).toEqual([]);
  });

  test('regression: the plain-disabled-Button finding disappears if the SHARED foundation.css opacity rule is removed', async ({
    page,
  }) => {
    // Proves the finding depends on the shared foundation.css rule: removing
    // it removes the finding entirely. (That this is the ONLY source of this
    // element's opacity is established statically -- no rule in button.css
    // sets `opacity` for the secondary variant, unlike ghost/ghost-danger's
    // icon-only disabled rule -- this override does not by itself prove that,
    // since it targets the same selector both files match.)
    await page.goto(ROUTE_BUTTON, { waitUntil: 'load' });
    await page.locator(DISABLED_PLAIN_BUTTON).waitFor({ state: 'visible' });
    await page.addStyleTag({
      content: `.cinder-button:disabled:not([data-cinder-loading]) { opacity: 1 !important; }`,
    });

    const opacity = await effectiveOpacityFor(page, DISABLED_PLAIN_BUTTON);
    expect(opacity).toBe(1);

    const declarations = await matchedDeclarationsFor(page, DISABLED_PLAIN_BUTTON);
    const compounded = opacityCompoundedTierDeclarations(declarations!, opacity);
    expect(compounded).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Part C: packages/components/docs/css-audit/translucent-border-seams.md
// carries a delimited section generated from AUDITED_SITES below rather than
// hand-listed. A later lane (Popover, retuned-indicator content) extends
// coverage by adding its own entry to AUDITED_SITES and re-running this file
// with CINDER_UPDATE_SEAM_AUDIT=1 -- it should never need to hand-edit prose
// inside the markers, and this list is the only place it needs to touch.
// ---------------------------------------------------------------------------

const DOC_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  'components',
  'docs',
  'css-audit',
  'translucent-border-seams.md',
);
const BEGIN_MARKER = '<!-- BEGIN GENERATED: border-tier-computed-audit -->';
const END_MARKER = '<!-- END GENERATED: border-tier-computed-audit -->';

type AuditedSite = {
  /** Which finding this site proves: a cross-file opacity compound, or a one-hop alias use. */
  readonly kind: 'opacity-compound' | 'alias-use';
  readonly route: string;
  readonly selector: string;
  /** The doc table's "site" cell. */
  readonly displayName: string;
  /** The doc table's "how it was found" cell -- describes the MECHANISM class (which file the compounding declarations live in), not a measurement. */
  readonly howFound: string;
};

const AUDITED_SITES: readonly AuditedSite[] = [
  {
    kind: 'opacity-compound',
    route: ROUTE_BUTTON,
    selector: DISABLED_ICON_BUTTON,
    displayName: 'disabled icon-only ghost Button (`/page/button`)',
    howFound:
      "opacity compound: a variant-specific rule in `button.css` pairs `border-color` and `opacity: 0.6` in the SAME rule (also caught by the source-text scan), while `foundation.css`'s shared disabled-visual rule redundantly contributes the identical opacity from a second file; matched via CDP",
  },
  {
    kind: 'opacity-compound',
    route: ROUTE_BUTTON,
    selector: DISABLED_PLAIN_BUTTON,
    displayName: 'disabled secondary Button (`/page/button`)',
    howFound:
      "cross-file-only opacity compound: `button.css`'s base disabled rule sets `border-color: var(--cinder-border-muted)` alone (no same-rule `opacity`), and `opacity: 0.6` comes entirely from `foundation.css`'s shared disabled-visual rule -- the two declarations never appear together as literal text in any one file, matched on the same element via CDP",
  },
  {
    kind: 'alias-use',
    route: ROUTE_TOGGLE,
    selector: RESTING_TOGGLE_TRACK,
    displayName: 'resting Toggle track (`/page/toggle`)',
    howFound:
      "one-hop alias: a non-border property's `var()` fallback names a custom property whose own declaration (inherited from the generated `:root` block) names the tier",
  },
];

type GeneratedRow = {
  readonly site: string;
  readonly property: string;
  readonly tierReference: string;
  readonly howFound: string;
};

/** Navigates to `site.route`, reads `site.selector`'s matched cascade, and derives the doc row purely from what the mechanism computes -- no hand-listed property or tier name. */
async function computeGeneratedRow(page: Page, site: AuditedSite): Promise<GeneratedRow> {
  await page.goto(site.route, { waitUntil: 'load' });
  await page.locator(site.selector).first().waitFor({ state: 'visible' });
  const declarations = await matchedDeclarationsFor(page, site.selector);
  expect(declarations, `${site.displayName} was not found`).not.toBeNull();

  if (site.kind === 'opacity-compound') {
    const opacity = await effectiveOpacityFor(page, site.selector);
    const finding = opacityCompoundedTierDeclarations(declarations!, opacity).find(
      (declaration) =>
        isBorderProperty(declaration.property) &&
        referencesBorderTier(declaration.resolvedValue ?? declaration.value),
    );
    expect(
      finding,
      `expected an opacity-compounded tier declaration for ${site.displayName}`,
    ).toBeDefined();
    return {
      site: site.displayName,
      property: finding!.property,
      tierReference: `\`${finding!.resolvedValue ?? finding!.value}\``,
      howFound: site.howFound,
    };
  }

  const use = tierUses(declarations!).find((candidate) => candidate.viaAlias !== undefined);
  expect(use, `expected a one-hop alias use for ${site.displayName}`).toBeDefined();
  const tierName = tierNameIn(use!.resolvedTierReference ?? '');
  expect(
    tierName,
    `expected the resolved tier reference to name a tier for ${site.displayName}`,
  ).toBeDefined();
  return {
    site: site.displayName,
    property: use!.property,
    tierReference: `\`${use!.viaAlias}\` → \`var(${tierName})\``,
    howFound: site.howFound,
  };
}

/**
 * Renders the full span between {@link BEGIN_MARKER} and {@link END_MARKER},
 * comment and coverage note included -- this function OWNS that whole span.
 * Extending the audit means adding an entry to `AUDITED_SITES` above (and
 * nothing else) and re-running with `CINDER_UPDATE_SEAM_AUDIT=1`, not
 * hand-editing the markdown between the markers.
 *
 * Wrapped in `prettier-ignore` markers: the repository's `prettier --write`
 * pre-commit hook reformats GFM tables (column padding), which would fight
 * this generator's exact-string verification on every commit otherwise.
 */
function renderGeneratedSection(rows: readonly GeneratedRow[]): string {
  const lines = [
    BEGIN_MARKER,
    '<!-- prettier-ignore-start -->',
    '<!--',
    '  Generated by packages/testing/tests/border-tier-computed-audit.playwright.ts.',
    '  Do not hand-edit between these markers -- run',
    '    CINDER_UPDATE_SEAM_AUDIT=1 bun run --filter=@cinder/testing test:playwright -- tests/border-tier-computed-audit.playwright.ts',
    '  to regenerate it, and commit the result. Everything outside these markers is',
    '  human-owned narrative and is never touched by that command.',
    '',
    "  Each row is a real, rendered element read via CDP's",
    '  CSS.getMatchedStylesForNode -- category and identity only, no contrast',
    '  numbers (those still belong in the hand-authored measurements above and',
    '  stay that way; this table exists to prove WHICH sites the mechanism finds,',
    '  not to re-measure them). A later lane extends this by adding its own site',
    '  to AUDITED_SITES in that file and re-running the command above.',
    '-->',
    '',
    '| site | property | tier reference | how it was found |',
    '| --- | --- | --- | --- |',
    ...rows.map(
      (row) => `| ${row.site} | \`${row.property}\` | ${row.tierReference} | ${row.howFound} |`,
    ),
    '',
    'Coverage note: this table currently audits, across three sites, the two shapes',
    'CIN-602 was scoped to prove (an opacity compound, and a corpus-alias area fill',
    'invisible to static source text) -- one of the three (the icon-only Button) is',
    'ALSO caught by the same-rule case in `border-tier-non-border-uses.test.ts`; the',
    'plain (secondary) disabled Button is the one the text scan cannot see even in',
    'principle. It is not yet a full replacement for the hand-maintained',
    'tables elsewhere in this document -- extending `AUDITED_SITES` to the rest of the',
    'sites listed by hand above (SortableList, ResizablePanels, SegmentedControl, the',
    'disabled-state list, the fourteen-site area-fill table) has not been done.',
    '<!-- prettier-ignore-end -->',
    END_MARKER,
  ];
  return lines.join('\n');
}

test('the generated computed-audit section in translucent-border-seams.md matches what the audit finds', async ({
  page,
}) => {
  const rows: GeneratedRow[] = [];
  for (const site of AUDITED_SITES) rows.push(await computeGeneratedRow(page, site));
  const expected = renderGeneratedSection(rows);

  const doc = readFileSync(DOC_PATH, 'utf8');
  const beginIndex = doc.indexOf(BEGIN_MARKER);
  const endIndex = doc.indexOf(END_MARKER);
  expect(beginIndex, `${BEGIN_MARKER} not found in ${DOC_PATH}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `${END_MARKER} not found in ${DOC_PATH}`).toBeGreaterThanOrEqual(0);
  const currentSection = doc.slice(beginIndex, endIndex + END_MARKER.length);

  if (process.env['CINDER_UPDATE_SEAM_AUDIT'] === '1') {
    const updatedDoc =
      doc.slice(0, beginIndex) + expected + doc.slice(endIndex + END_MARKER.length);
    writeFileSync(DOC_PATH, updatedDoc);
    return;
  }

  expect(
    currentSection,
    'The generated section is stale. Regenerate it with:\n' +
      '  CINDER_UPDATE_SEAM_AUDIT=1 bun run --filter=@cinder/testing test:playwright -- ' +
      'tests/border-tier-computed-audit.playwright.ts\n' +
      'and commit the result.',
  ).toBe(expected);
});
