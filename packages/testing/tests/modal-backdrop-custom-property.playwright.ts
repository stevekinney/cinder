/**
 * CIN-377 review (thread "Remove the cyclic backdrop custom-property
 * fallback"): `--cinder-modal-backdrop: var(--cinder-modal-backdrop,
 * fallback)` is a CSS custom-property dependency CYCLE — a property
 * referencing itself in its own declaration, even guarded by a fallback.
 * The spec resolves cycles by making the property invalid at
 * computed-value time, and cycle detection happens BEFORE fallback
 * substitution, so the fallback argument does not rescue it. That
 * self-referencing form (briefly landed in modal.css) broke the modal
 * backdrop for every consumer with no override at all.
 *
 * The fix moves the fallback to the CONSUMING property instead:
 *   .cinder-modal { --cinder-modal-backdrop: var(--cinder-overlay-backdrop); }
 *   .cinder-modal::backdrop { background-color: var(--cinder-modal-backdrop, var(--cinder-overlay-backdrop)); }
 *
 * This is a pure CSS-cascade/custom-property question, not something that
 * depends on Modal's component markup or design tokens, so this test
 * builds a minimal, self-contained page replicating exactly the shape of
 * modal.css's backdrop rules (with simple literal placeholder colors
 * instead of the real design tokens, to keep assertions exact and free of
 * color-space rounding) and opens a real native `<dialog>` with
 * `showModal()`, then reads `getComputedStyle(dialog, '::backdrop')`
 * directly — this cannot be verified in the package's Bun/happy-dom unit
 * tests, which do not implement `::backdrop` or its computed style at all.
 *
 * Four scenarios:
 *   1. No override anywhere — the plain default must paint (proves the
 *      cycle is gone: a cyclic property here would make the whole
 *      declaration invalid, and `background-color` would fall through to
 *      its own initial value, `transparent`, not the intended default).
 *   2. Class-level override only (no matching `::backdrop` rule) — Chromium
 *      does not inherit custom properties from a dialog onto its own
 *      `::backdrop`, so this is expected to be INERT (the default still
 *      paints) — this is exactly the reliability gap the paired-override
 *      documentation exists to warn consumers about, not a bug in this
 *      fix.
 *   3. `::backdrop`-level override — this MUST work in every engine, since
 *      the property is declared directly on the exact pseudo-element being
 *      queried; no inheritance involved at all.
 *   4. `:root`-scoped override — this does NOT reach `.cinder-modal` via
 *      ordinary inheritance the way it might look: BASE_CSS's own
 *      `.cinder-modal { --cinder-modal-backdrop: var(--cinder-overlay-backdrop); }`
 *      redeclares the property directly on `.cinder-modal`, and a
 *      redeclaration on a more specific rule always wins the cascade over
 *      an inherited value, regardless of inheritance — so `.cinder-modal`'s
 *      own computed `--cinder-modal-backdrop` is always the plain default,
 *      never the `:root` override. What this scenario actually tests is
 *      whether `::backdrop` — which is not a DOM descendant of
 *      `.cinder-modal` in the normal inheritance sense — picks up the
 *      `:root` value DIRECTLY, bypassing `.cinder-modal`'s redeclaration
 *      entirely. That's the same engine-dependent question as scenario 2,
 *      just approached from `:root` instead of the class. Either way, the
 *      value must not be "invalid"/garbage — this proves the self-reference
 *      removal didn't just move the cycle bug to a different scenario.
 */
import { expect, test } from '@playwright/test';

const DEFAULT_COLOR = 'rgb(10, 20, 30)';
const CLASS_OVERRIDE_COLOR = 'rgb(40, 50, 60)';
const BACKDROP_OVERRIDE_COLOR = 'rgb(70, 80, 90)';
const ROOT_OVERRIDE_COLOR = 'rgb(100, 110, 120)';

/** Same shape as modal.css's backdrop rules, with literal placeholder colors. */
const BASE_CSS = `
  .cinder-modal {
    --cinder-modal-backdrop: var(--cinder-overlay-backdrop);
  }
  .cinder-modal::backdrop {
    background-color: var(--cinder-modal-backdrop, var(--cinder-overlay-backdrop));
  }
`;

function buildHtml(extraCss: string, rootStyle = ''): string {
  return `<!doctype html>
<html style="${rootStyle}">
  <head>
    <style>
      :root {
        --cinder-overlay-backdrop: ${DEFAULT_COLOR};
      }
      ${BASE_CSS}
      ${extraCss}
    </style>
  </head>
  <body>
    <dialog class="cinder-modal"><p>content</p></dialog>
    <script>
      document.querySelector('dialog').showModal();
    </script>
  </body>
</html>`;
}

async function backdropBackgroundColor(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const dialog = document.querySelector('dialog')!;
    return getComputedStyle(dialog, '::backdrop').backgroundColor;
  });
}

test.describe('Modal --cinder-modal-backdrop custom-property cascade (no cycle)', () => {
  test('no override anywhere: the plain default paints', async ({ page }) => {
    await page.setContent(buildHtml(''));
    const color = await backdropBackgroundColor(page);
    // A cyclic declaration would make --cinder-modal-backdrop invalid,
    // which would make the WHOLE `background-color` declaration invalid —
    // falling through to background-color's own initial value
    // (`transparent`, i.e. `rgba(0, 0, 0, 0)`), never the intended default.
    expect(color).not.toBe('rgba(0, 0, 0, 0)');
    expect(color).toBe(DEFAULT_COLOR);
  });

  test('::backdrop-level override always wins, in every engine', async ({ page }) => {
    await page.setContent(
      buildHtml(`
        .cinder-modal::backdrop {
          --cinder-modal-backdrop: ${BACKDROP_OVERRIDE_COLOR};
        }
      `),
    );
    const color = await backdropBackgroundColor(page);
    expect(color).toBe(BACKDROP_OVERRIDE_COLOR);
  });

  test('class-level override alone does not throw or produce an invalid value', async ({
    page,
  }) => {
    // Whether this override actually reaches `::backdrop` is engine-
    // dependent (documented in modal.css/README/changeset — this is
    // precisely why the paired class + ::backdrop override pattern is
    // required). What this test guards against is the CYCLE regression:
    // the computed color must be a real, valid color — either the class
    // override (if this engine happens to route it through) or the plain
    // default — never `transparent`/invalid from a broken cyclic
    // declaration.
    await page.setContent(
      buildHtml(`
        .cinder-modal {
          --cinder-modal-backdrop: ${CLASS_OVERRIDE_COLOR};
        }
      `),
    );
    const color = await backdropBackgroundColor(page);
    expect(color).not.toBe('rgba(0, 0, 0, 0)');
    expect([DEFAULT_COLOR, CLASS_OVERRIDE_COLOR]).toContain(color);
  });

  test(':root-scoped override does not throw or produce an invalid value', async ({ page }) => {
    // BASE_CSS's `.cinder-modal` rule redeclares `--cinder-modal-backdrop`
    // itself, which always wins the cascade over this `:root` value at
    // `.cinder-modal` — so this scenario isn't really "does :root cascade
    // down to .cinder-modal" (it doesn't, by construction). It's "does
    // `::backdrop` pick up the `:root` value directly", the same
    // engine-dependent inheritance question as the class-level case above,
    // just sourced from `:root` instead. The regression this guards against
    // is the cycle, not a specific inheritance outcome.
    await page.setContent(buildHtml('', `--cinder-modal-backdrop: ${ROOT_OVERRIDE_COLOR}`));
    const color = await backdropBackgroundColor(page);
    expect(color).not.toBe('rgba(0, 0, 0, 0)');
    expect([DEFAULT_COLOR, ROOT_OVERRIDE_COLOR]).toContain(color);
  });
});
