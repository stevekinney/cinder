import { expect, test } from '@playwright/test';

test.describe('Card padding', () => {
  test('padding="none" flushes only the body', async ({ page }) => {
    await page.goto('/page/card?tab=examples', { waitUntil: 'load' });

    const body = page.locator(".cinder-card__body[data-cinder-padding='none']").first();
    const card = body.locator('..');
    const header = card.locator(':scope > .cinder-card__header');
    const footer = card.locator(':scope > .cinder-card__footer');

    await expect(card).toBeVisible();
    await expect(header).toHaveCSS('padding-top', '12px');
    await expect(header).toHaveCSS('padding-right', '16px');
    await expect(header).toHaveCSS('padding-bottom', '12px');
    await expect(header).toHaveCSS('padding-left', '16px');
    await expect(header).toHaveCSS('border-bottom-width', '1px');
    await expect(body).toHaveCSS('padding-top', '0px');
    await expect(body).toHaveCSS('padding-right', '0px');
    await expect(body).toHaveCSS('padding-bottom', '0px');
    await expect(body).toHaveCSS('padding-left', '0px');
    await expect(footer).toHaveCSS('padding-top', '12px');
    await expect(footer).toHaveCSS('padding-right', '16px');
    await expect(footer).toHaveCSS('padding-bottom', '12px');
    await expect(footer).toHaveCSS('padding-left', '16px');
  });

  test('the flush-body example has no horizontal overflow', async ({ page }) => {
    await page.goto('/page/card?tab=examples', { waitUntil: 'load' });

    const body = page.locator(".cinder-card__body[data-cinder-padding='none']").first();
    const card = body.locator('..');
    const preview = page.locator('#example-mount-flush-body');
    const overflow = await card.evaluate((element) => {
      const previewElement = element.closest('.example-preview');
      const cardRectangle = element.getBoundingClientRect();
      const previewRectangle = previewElement?.getBoundingClientRect();

      return {
        cardClientWidth: element.clientWidth,
        cardScrollWidth: element.scrollWidth,
        cardOverflow: getComputedStyle(element).overflow,
        cardBoxSizing: getComputedStyle(element).boxSizing,
        cardRight: cardRectangle.right,
        previewClientWidth: previewElement?.clientWidth,
        previewScrollWidth: previewElement?.scrollWidth,
        previewRight: previewRectangle?.right,
      };
    });

    await expect(preview).toBeVisible();
    expect(overflow.cardOverflow).toBe('hidden');
    expect(overflow.cardBoxSizing).toBe('border-box');
    expect(overflow.cardScrollWidth).toBeLessThanOrEqual(overflow.cardClientWidth);
    expect(overflow.previewScrollWidth).toBeLessThanOrEqual(overflow.previewClientWidth!);
    expect(overflow.cardRight).toBeLessThanOrEqual(overflow.previewRight!);
  });

  test('ApprovalCard keeps a single owned header padding layer', async ({ page }) => {
    await page.goto('/page/approval-card?tab=examples', { waitUntil: 'load' });

    const approvalCard = page.locator('.cinder-approval-card').first();
    const cardHeader = approvalCard.locator('.cinder-card__header');
    const ownedHeader = approvalCard.locator('.cinder-approval-card__header');

    await expect(approvalCard).toBeVisible();
    await expect(cardHeader).toHaveCSS('padding-top', '0px');
    await expect(cardHeader).toHaveCSS('padding-right', '0px');
    await expect(cardHeader).toHaveCSS('padding-bottom', '0px');
    await expect(cardHeader).toHaveCSS('padding-left', '0px');
    await expect(ownedHeader).toHaveCSS('padding-top', '16px');
    await expect(ownedHeader).toHaveCSS('padding-right', '16px');
    await expect(ownedHeader).toHaveCSS('padding-bottom', '16px');
    await expect(ownedHeader).toHaveCSS('padding-left', '16px');
  });
});
