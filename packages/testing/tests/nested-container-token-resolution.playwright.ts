import { expect, test } from '@playwright/test';

test('surface, text, and border tokens resolve from a nested host container', async ({ page }) => {
  await page.goto('/page/button?snapshot=1');

  const resolved = await page.evaluate(() => {
    const host = document.createElement('section');
    host.style.setProperty('--cinder-surface', 'rgb(11, 22, 33)');
    host.style.setProperty('--cinder-text-default', 'rgb(244, 233, 222)');
    host.style.setProperty('--cinder-border', 'rgb(77, 88, 99)');

    const child = document.createElement('div');
    child.style.backgroundColor = 'var(--cinder-surface)';
    child.style.color = 'var(--cinder-text-default)';
    child.style.border = '1px solid var(--cinder-border)';
    host.append(child);
    document.body.append(host);

    const style = getComputedStyle(child);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      borderColor: style.borderColor,
    };
  });

  expect(resolved).toEqual({
    backgroundColor: 'rgb(11, 22, 33)',
    color: 'rgb(244, 233, 222)',
    borderColor: 'rgb(77, 88, 99)',
  });
});

/**
 * CIN-245: what a scoped `--cinder-border-ink` override does, and does not, do.
 *
 * The three structural border tiers are `color-mix()` values over one ink, and
 * the obvious reading of that is "set the ink anywhere and the borders follow."
 * They do not. `var()` inside a custom property is substituted where that
 * property is DECLARED, so `--cinder-border` computes against `:root`'s ink and
 * every descendant inherits the already-resolved value — setting only the ink
 * further down changes nothing.
 *
 * That is how every derived token in the corpus behaves, not a border-specific
 * quirk, but the ink invites the wrong assumption. Pinned here in both
 * directions so the documented workaround (redeclare the tiers in the same
 * scope) cannot silently stop being the right advice.
 */
test('a scoped border-ink override retints only where the tiers are redeclared', async ({
  page,
}) => {
  await page.goto('/page/button?snapshot=1');

  const resolved = await page.evaluate(() => {
    const BRAND = 'oklch(0.5 0.3 30)';
    const read = (host: HTMLElement) => {
      const child = document.createElement('div');
      child.style.borderColor = 'var(--cinder-border)';
      host.append(child);
      const value = getComputedStyle(child).borderColor;
      host.remove();
      return value;
    };

    const inkOnly = document.createElement('section');
    inkOnly.style.setProperty('--cinder-border-ink', BRAND);
    document.body.append(inkOnly);

    const inkAndTier = document.createElement('section');
    inkAndTier.style.setProperty('--cinder-border-ink', BRAND);
    inkAndTier.style.setProperty(
      '--cinder-border',
      'color-mix(in oklch, var(--cinder-border-ink), transparent 52%)',
    );
    document.body.append(inkAndTier);

    const untouched = document.createElement('section');
    document.body.append(untouched);

    return {
      inkOnly: read(inkOnly),
      inkAndTier: read(inkAndTier),
      untouched: read(untouched),
    };
  });

  // The ink alone does not reach the already-resolved tier.
  expect(resolved.inkOnly).toBe(resolved.untouched);
  // Redeclaring the tier in the same scope does.
  expect(resolved.inkAndTier).not.toBe(resolved.untouched);
  expect(resolved.inkAndTier).toContain('0.5');
});
