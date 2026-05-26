import { expect, test } from '../src/fixtures/component-page.ts';

test.describe('dropdown trigger caret', () => {
  test('renders as an RTL-safe SVG chevron aligned with the trigger label', async ({ page }) => {
    await page.goto('/page/dropdown?snapshot=1');

    const basicExample = page.locator('#example-mount-basic');
    await expect(basicExample).toBeVisible();

    const trigger = basicExample.getByRole('button', { name: 'Options' });
    await expect(trigger).toBeVisible();

    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
    });

    const caret = trigger.locator('.cinder-dropdown-trigger__caret');
    await expect(caret).toHaveCount(1);

    const caretDetails = await caret.evaluate((element) => {
      const computedStyle = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      const paths = Array.from(element.querySelectorAll('path'));

      return {
        isSvg: element instanceof SVGSVGElement,
        ariaHidden: element.getAttribute('aria-hidden'),
        focusable: element.getAttribute('focusable'),
        stroke: element.getAttribute('stroke'),
        strokeWidth: element.getAttribute('stroke-width'),
        viewBox: element.getAttribute('viewBox'),
        pathData: paths.map((path) => path.getAttribute('d')),
        width: box.width,
        height: box.height,
        borderTopWidth: computedStyle.borderTopWidth,
        borderRightWidth: computedStyle.borderRightWidth,
        borderBottomWidth: computedStyle.borderBottomWidth,
        borderLeftWidth: computedStyle.borderLeftWidth,
        rotate: computedStyle.rotate,
        translate: computedStyle.translate,
      };
    });

    expect(caretDetails.isSvg).toBe(true);
    expect(caretDetails.ariaHidden).toBe('true');
    expect(caretDetails.focusable).toBe('false');
    expect(caretDetails.stroke).toBe('currentColor');
    expect(caretDetails.strokeWidth).toBe('2');
    expect(caretDetails.viewBox).toBe('0 0 20 20');
    expect(caretDetails.pathData).toEqual(['M6 8l4 4 4-4']);
    expect(caretDetails.width).toBeGreaterThan(0);
    expect(caretDetails.height).toBeGreaterThan(0);
    expect(caretDetails.borderTopWidth).toBe('0px');
    expect(caretDetails.borderRightWidth).toBe('0px');
    expect(caretDetails.borderBottomWidth).toBe('0px');
    expect(caretDetails.borderLeftWidth).toBe('0px');
    expect(['none', '0deg']).toContain(caretDetails.rotate);
    expect(['none', '0px']).toContain(caretDetails.translate);

    const centerDifference = await trigger.evaluate((element) => {
      const textNode = Array.from(element.childNodes).find(
        (node): node is Text => node.nodeType === Node.TEXT_NODE && node.textContent?.trim() !== '',
      );
      const caretElement = element.querySelector<SVGSVGElement>('.cinder-dropdown-trigger__caret');
      if (!textNode || !caretElement) {
        throw new Error('Dropdown trigger label text or caret is missing.');
      }

      const range = document.createRange();
      range.selectNodeContents(textNode);
      const textBox = range.getBoundingClientRect();
      range.detach();

      const caretBox = caretElement.getBoundingClientRect();
      const textCenter = textBox.top + textBox.height / 2;
      const caretCenter = caretBox.top + caretBox.height / 2;

      return Math.abs(textCenter - caretCenter);
    });

    expect(centerDifference).toBeLessThanOrEqual(2);
  });
});
