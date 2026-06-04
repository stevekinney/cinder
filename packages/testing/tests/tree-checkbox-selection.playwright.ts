/// <reference lib="dom" />
/**
 * Regression spec for Tree checkbox selection + indeterminate parent state
 * (ticket f76b0e42).
 *
 * The bug: the native checkbox in tree-item.svelte was a CONTROLLED input
 * driven by a one-way declarative `checked={selectionState.checked}` attribute,
 * while `.indeterminate` was set imperatively. Svelte only writes the `.checked`
 * DOM property when the bound expression's VALUE changes between renders — it
 * does not re-assert it on every flush. A real browser flips a checkbox's DOM
 * `.checked` on click BEFORE the handler runs (preventDefault reverts it only on
 * that tick), so any residual native mutation that lands on a checkbox whose
 * authoritative `selectionState.checked` then evaluates to the same boolean
 * Svelte last rendered desyncs: the visible `<input>.checked` diverges from the
 * authoritative `aria-checked`. The fix re-asserts both `.checked` and
 * `.indeterminate` imperatively on every reactive flush.
 *
 * This spec proves the user-visible behavior against the LIVE playground (not
 * CSS parsing, not programmatic .focus()):
 *   - First establishes REAL KEYBOARD focus: Tab-walks from document.body until
 *     a tree item is the activeElement AND matches `:focus-visible`
 *     (programmatic .focus() does not engage :focus-visible in Chromium), and
 *     drives a keyboard toggle (Space) to prove the keyboard path stays in
 *     sync too.
 *   - Then reproduces the actual bug via REAL MOUSE CLICKS on the native
 *     checkboxes. The desync only manifests on a native checkbox click:
 *     Chromium flips the input's `.checked` BEFORE the handler runs and
 *     preventDefault reverts it only on that tick, so a controlled input wired
 *     with a declarative `checked={...}` attribute (whose boolean did not
 *     change value) leaves the visible checkbox diverged from the authoritative
 *     `aria-checked`. Keyboard toggles never natively mutate `.checked`, so the
 *     mouse path is the one that exposes the regression. After every click the
 *     spec asserts the visible native checkbox `.checked` / `.indeterminate`
 *     agree with `aria-checked` ("true" / "false" / "mixed").
 *
 * Routes to the `indeterminate-parents` example (branch `archive` with leaf
 * children january/february, scope ['archive','january','february'], sibling
 * leaf summary; initial selectedIds ['february'], expandedIds ['archive']).
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

const TREE_ROUTE = '/page/tree?snapshot=1';
// Each playground example mounts into a container keyed by its scenario slug.
const EXAMPLE = '#example-mount-indeterminate-parents';

// Locate a treeitem by its visually-hidden label (the tree labels each row via
// an aria-labelledby pointer to a `.cinder-sr-only` span holding the full text).
function treeItemByLabel(page: Page, label: string): Locator {
  return page.locator(`${EXAMPLE} [role="treeitem"]:has(> .cinder-sr-only:text-is("${label}"))`);
}

// Scope to the item's OWN checkbox (the one in its row), not the checkboxes of
// nested descendant treeitems. `.cinder-tree-item__row` is a direct child of
// the treeitem and holds only that row's checkbox.
function checkboxOf(item: Locator): Locator {
  return item.locator('> .cinder-tree-item__row > input.cinder-tree-item__checkbox');
}

// Read the visible native checkbox properties together with the authoritative
// aria-checked, so the assertion can prove they AGREE on the same tick. Reads
// the item's OWN row checkbox (a direct child), never a descendant's.
type CheckboxState = { ariaChecked: string | null; checked: boolean; indeterminate: boolean };

async function checkboxStateOf(item: Locator): Promise<CheckboxState> {
  return item.evaluate((node) => {
    const input = node.querySelector(
      ':scope > .cinder-tree-item__row > input.cinder-tree-item__checkbox',
    ) as HTMLInputElement | null;
    return {
      ariaChecked: node.getAttribute('aria-checked'),
      checked: input?.checked ?? false,
      indeterminate: input?.indeterminate ?? false,
    };
  });
}

// Poll the FULL state object until it matches. `aria-checked` (a Svelte
// attribute) and the native `.checked`/`.indeterminate` properties (written by
// the imperative $effect) can land on adjacent reactive ticks, so a single read
// can momentarily catch them mid-flush. Polling on the combined object asserts
// they converge — proving the visible checkbox and the authoritative
// aria-checked AGREE once the flush settles.
async function expectCheckboxState(
  item: Locator,
  expected: CheckboxState,
  message: string,
): Promise<void> {
  await expect
    .poll(async () => JSON.stringify(await checkboxStateOf(item)), { message })
    .toBe(JSON.stringify(expected));
}

test.describe('Tree — checkbox selection and indeterminate parent state', () => {
  test('keyboard toggling keeps the visible checkbox in sync with aria-checked and parent mixed state', async ({
    page,
  }) => {
    await page.goto(TREE_ROUTE, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');

    // Wait for the example to mount and lay out (presence alone is not enough —
    // subsequent reads must see resolved DOM).
    await page.waitForSelector(`${EXAMPLE} [role="tree"]`, { state: 'visible' });
    await page.waitForFunction((selector) => {
      const tree = document.querySelector(`${selector} [role="tree"]`);
      return tree instanceof HTMLElement && tree.querySelectorAll('[role="treeitem"]').length >= 4;
    }, EXAMPLE);

    const archive = treeItemByLabel(page, 'archive');
    const january = treeItemByLabel(page, 'january.pdf');
    const february = treeItemByLabel(page, 'february.pdf');

    await expect(archive).toBeVisible();
    await expect(january).toBeVisible();
    await expect(february).toBeVisible();

    // ── Initial render contract ───────────────────────────────────────────
    // february is selected → its checkbox is checked. january is unchecked.
    // archive's scope (archive, january, february) is 1/3 selected → mixed,
    // so its native checkbox renders indeterminate (not checked).
    await expectCheckboxState(
      february,
      { ariaChecked: 'true', checked: true, indeterminate: false },
      'february initially selected',
    );
    await expectCheckboxState(
      january,
      { ariaChecked: 'false', checked: false, indeterminate: false },
      'january initially unselected',
    );
    await expectCheckboxState(
      archive,
      { ariaChecked: 'mixed', checked: false, indeterminate: true },
      'archive initially mixed (1/3)',
    );

    // ── Engage real keyboard focus with :focus-visible ────────────────────
    // The checkbox itself is aria-hidden + tabindex=-1, so focus lives on the
    // treeitem (roving tabindex). Reset to body, then Tab-walk until a treeitem
    // inside THIS example owns focus and engages :focus-visible. Programmatic
    // .focus() does NOT engage :focus-visible in Chromium — a real Tab does.
    await page.evaluate(() => {
      document.body.focus();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });

    const focusedTreeItem = page.locator(`${EXAMPLE} [role="treeitem"][tabindex="0"]`);
    let landed = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await page.keyboard.press('Tab');
      landed = await focusedTreeItem.evaluate(
        (element) => element === document.activeElement && element.matches(':focus-visible'),
      );
      if (landed) break;
    }
    expect(landed, 'a tree item in the example became keyboard-focused with :focus-visible').toBe(
      true,
    );
    await expect(focusedTreeItem).toBeFocused();
    expect(await focusedTreeItem.evaluate((element) => element.matches(':focus-visible'))).toBe(
      true,
    );

    // Roving tabindex initializes on the selected item (february). Confirm we
    // are sitting on a leaf so ArrowUp lands deterministically on january.
    const focusedLabel = await focusedTreeItem.evaluate(
      (element) =>
        element.querySelector('.cinder-sr-only')?.textContent ?? element.textContent ?? '',
    );
    expect(focusedLabel).toContain('february.pdf');

    // ── Keyboard path stays in sync: toggle january ON via Space ──────────
    // ArrowUp from february moves focus up one visible row to january, then
    // Space toggles january's selection (APG checkbox-tree contract). This
    // proves the keyboard toggle keeps the visible checkbox in sync.
    await page.keyboard.press('ArrowUp');
    await expect(january).toBeFocused();
    await page.keyboard.press('Space');

    await expectCheckboxState(
      january,
      { ariaChecked: 'true', checked: true, indeterminate: false },
      'january checked after keyboard Space',
    );
    // archive scope is now 2/3 selected (january + february) → still mixed.
    await expectCheckboxState(
      archive,
      { ariaChecked: 'mixed', checked: false, indeterminate: true },
      'archive mixed (2/3) after keyboard toggle',
    );

    // ── Mouse path exposes the regression: click january's native checkbox ─
    // A native checkbox click flips `.checked` in the DOM before the handler's
    // preventDefault reverts it. Clicking january OFF leaves archive at 1/3
    // selected (still "mixed") — the parent's checked-boolean does NOT change
    // value, so a declarative `checked={...}` binding would skip the DOM write
    // and the visible parent checkbox would desync. The imperative
    // re-assertion must keep every checkbox in sync after the click.
    await checkboxOf(january).click();
    await expectCheckboxState(
      january,
      { ariaChecked: 'false', checked: false, indeterminate: false },
      'january unchecked after native checkbox click',
    );
    await expectCheckboxState(
      archive,
      { ariaChecked: 'mixed', checked: false, indeterminate: true },
      'archive still mixed (1/3) — parent checkbox reconciled after native click',
    );

    // Click february's native checkbox OFF → archive scope is now 0/3 selected
    // → fully unchecked, NEVER mixed; the visible checkbox must follow.
    await checkboxOf(february).click();
    await expectCheckboxState(
      february,
      { ariaChecked: 'false', checked: false, indeterminate: false },
      'february unchecked after native checkbox click',
    );
    await expectCheckboxState(
      archive,
      { ariaChecked: 'false', checked: false, indeterminate: false },
      'archive fully unchecked (0/3) — never mixed',
    );

    // Click january's native checkbox back ON → archive returns to 1/3 → mixed.
    // Re-checking january is the inverse residual-mutation case: the click's
    // native pre-flip and the authoritative state must converge on checked.
    await checkboxOf(january).click();
    await expectCheckboxState(
      january,
      { ariaChecked: 'true', checked: true, indeterminate: false },
      'january re-checked after native checkbox click',
    );
    await expectCheckboxState(
      archive,
      { ariaChecked: 'mixed', checked: false, indeterminate: true },
      'archive back to mixed (1/3) after re-check',
    );
  });

  test('toggling the parent checkbox cascades to fully checked then fully unchecked (never mixed)', async ({
    page,
  }) => {
    await page.goto(TREE_ROUTE, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector(`${EXAMPLE} [role="tree"]`, { state: 'visible' });
    await page.waitForFunction((selector) => {
      const tree = document.querySelector(`${selector} [role="tree"]`);
      return tree instanceof HTMLElement && tree.querySelectorAll('[role="treeitem"]').length >= 4;
    }, EXAMPLE);

    const archive = treeItemByLabel(page, 'archive');
    const january = treeItemByLabel(page, 'january.pdf');
    const february = treeItemByLabel(page, 'february.pdf');

    // Engage keyboard focus, then walk up to the archive branch row.
    await page.evaluate(() => {
      document.body.focus();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    const focusedTreeItem = page.locator(`${EXAMPLE} [role="treeitem"][tabindex="0"]`);
    let landed = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await page.keyboard.press('Tab');
      landed = await focusedTreeItem.evaluate(
        (element) => element === document.activeElement && element.matches(':focus-visible'),
      );
      if (landed) break;
    }
    expect(landed).toBe(true);

    // Walk to the archive row (Home jumps to the first visible item, which is
    // the root-level archive branch) and confirm the focus ring engages — the
    // keyboard-focus proof required for this component.
    await page.keyboard.press('Home');
    await expect(archive).toBeFocused();
    expect(await archive.evaluate((element) => element.matches(':focus-visible'))).toBe(true);

    // Now drive the cascade via a REAL MOUSE CLICK on the parent's native
    // checkbox (the path that natively pre-flips `.checked`). The archive
    // checkbox starts indeterminate (1/3 selected); clicking it selects the
    // WHOLE scope (cascade).
    await checkboxOf(archive).click();
    await expectCheckboxState(
      archive,
      { ariaChecked: 'true', checked: true, indeterminate: false },
      'archive fully checked after cascade select',
    );
    // Children follow.
    await expectCheckboxState(
      january,
      { ariaChecked: 'true', checked: true, indeterminate: false },
      'january checked by cascade',
    );
    await expectCheckboxState(
      february,
      { ariaChecked: 'true', checked: true, indeterminate: false },
      'february checked by cascade',
    );

    // Click again clears the whole scope → fully unchecked, NEVER mixed.
    await checkboxOf(archive).click();
    await expectCheckboxState(
      archive,
      { ariaChecked: 'false', checked: false, indeterminate: false },
      'archive fully unchecked after cascade clear — never mixed',
    );
    await expectCheckboxState(
      january,
      { ariaChecked: 'false', checked: false, indeterminate: false },
      'january cleared by cascade',
    );
    await expectCheckboxState(
      february,
      { ariaChecked: 'false', checked: false, indeterminate: false },
      'february cleared by cascade',
    );
  });
});
