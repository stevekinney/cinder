import { expect, test } from '@playwright/test';

test.describe('checkbox-group disabled-fieldset label dimming', () => {
  test('a disabled CheckboxGroup dims a child label styled only via the native fieldset cascade', async ({
    page,
  }) => {
    await page.goto('/page/checkbox-group?snapshot=1', { waitUntil: 'load' });
    await page.waitForSelector('#app > *', { state: 'visible', timeout: 20_000 });

    const mount = page.locator('#example-mount-disabled-fieldset');
    await expect(mount).toBeVisible();

    // The group is disabled; no individual <Checkbox> in this example was
    // ever given its own `disabled` prop — the SMS checkbox's own label
    // dims purely because it is a descendant of a disabled <fieldset>.
    const smsLabel = mount.locator('label', { hasText: 'SMS' });
    await expect(smsLabel).toBeVisible();

    const styles = await smsLabel.evaluate((element) => {
      const resolvedDisabledColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--cinder-text-disabled')
        .trim();
      // Resolve the custom property the same way the browser resolves it when
      // used as a `color` value, so a `light-dark()`/token-indirection change
      // does not require updating a hardcoded expected color here.
      const probe = document.createElement('div');
      probe.style.color = resolvedDisabledColor;
      document.body.appendChild(probe);
      const resolvedDisabledRgb = getComputedStyle(probe).color;
      probe.remove();

      const computed = getComputedStyle(element);
      return {
        color: computed.color,
        cursor: computed.cursor,
        resolvedDisabledRgb,
      };
    });

    expect(styles.color).toBe(styles.resolvedDisabledRgb);
    expect(styles.cursor).toBe('not-allowed');
  });
});
