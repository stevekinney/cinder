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
