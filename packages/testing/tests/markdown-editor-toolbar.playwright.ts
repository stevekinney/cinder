import { expect, test } from '../src/fixtures/component-page.ts';
import { THEMES, VIEWPORTS } from '../src/helpers/manifest.ts';

const markdownEditorEntry = {
  name: 'MarkdownEditor',
  slug: 'markdown-editor',
  route: '/page/markdown-editor?tab=examples',
} as const;

const testedViewports = VIEWPORTS.filter(
  (viewport) => viewport.name === 'desktop' || viewport.name === 'mobile',
);

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function expectInsideContentBox(childBox: Box, contentBox: { left: number; right: number }) {
  expect(childBox.x).toBeGreaterThanOrEqual(contentBox.left - 1);
  expect(childBox.x + childBox.width).toBeLessThanOrEqual(contentBox.right + 1);
}

for (const theme of THEMES) {
  for (const viewport of testedViewports) {
    test(`MarkdownEditor toolbar padding keeps controls inset in ${theme} ${viewport.name}`, async ({
      componentPage,
    }) => {
      const page = await componentPage.open({
        entry: markdownEditorEntry,
        theme,
        viewport,
      });

      // The example's editor id is namespaced per mount (#399), so this test
      // locates the editor by its component wrapper class instead of a hardcoded
      // id. Snapshot mode renders exactly one example, so the wrapper is unique.
      const editorWrapper = page.locator('.markdown-editor-wrapper');
      await expect(editorWrapper).toBeVisible();

      const toolbarWrapper = editorWrapper.locator('.editor-toolbar-wrapper');
      await expect(toolbarWrapper).toBeVisible();

      const toolbar = toolbarWrapper.locator('.editor-toolbar');
      await expect(toolbar).toBeVisible();

      const modeToggle = toolbarWrapper.getByRole('radiogroup', { name: 'Editor mode' });
      await expect(modeToggle).toBeVisible();

      const wrapperMetrics = await toolbarWrapper.evaluate((element) => {
        const computed = getComputedStyle(element);
        const probe = document.createElement('div');
        probe.style.padding = 'var(--cinder-space-2) var(--cinder-space-3)';
        element.append(probe);
        const probeComputed = getComputedStyle(probe);
        const rect = element.getBoundingClientRect();
        const metrics = {
          paddingBlockStart: computed.paddingBlockStart,
          paddingBlockEnd: computed.paddingBlockEnd,
          paddingInlineStart: computed.paddingInlineStart,
          paddingInlineEnd: computed.paddingInlineEnd,
          expectedPaddingBlockStart: probeComputed.paddingBlockStart,
          expectedPaddingBlockEnd: probeComputed.paddingBlockEnd,
          expectedPaddingInlineStart: probeComputed.paddingInlineStart,
          expectedPaddingInlineEnd: probeComputed.paddingInlineEnd,
          left: rect.left,
          right: rect.right,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        };
        probe.remove();
        return metrics;
      });

      expect(wrapperMetrics.paddingBlockStart).toBe(wrapperMetrics.expectedPaddingBlockStart);
      expect(wrapperMetrics.paddingBlockEnd).toBe(wrapperMetrics.expectedPaddingBlockEnd);
      expect(wrapperMetrics.paddingInlineStart).toBe(wrapperMetrics.expectedPaddingInlineStart);
      expect(wrapperMetrics.paddingInlineEnd).toBe(wrapperMetrics.expectedPaddingInlineEnd);

      await expect(toolbar).toHaveCSS('padding-top', '0px');
      await expect(toolbar).toHaveCSS('padding-right', '0px');
      await expect(toolbar).toHaveCSS('padding-bottom', '0px');
      await expect(toolbar).toHaveCSS('padding-left', '0px');

      const toolbarBox = await toolbar.boundingBox();
      const modeToggleBox = await modeToggle.boundingBox();
      expect(toolbarBox).not.toBeNull();
      expect(modeToggleBox).not.toBeNull();

      const contentBox = {
        left: wrapperMetrics.left + parseFloat(wrapperMetrics.paddingInlineStart),
        right: wrapperMetrics.right - parseFloat(wrapperMetrics.paddingInlineEnd),
      };

      expectInsideContentBox(toolbarBox as Box, contentBox);
      expectInsideContentBox(modeToggleBox as Box, contentBox);
      expect(wrapperMetrics.scrollWidth).toBeLessThanOrEqual(wrapperMetrics.clientWidth + 1);

      if (viewport.name === 'desktop') {
        const toolbarCenter = (toolbarBox as Box).y + (toolbarBox as Box).height / 2;
        const modeToggleCenter = (modeToggleBox as Box).y + (modeToggleBox as Box).height / 2;
        expect(Math.abs(toolbarCenter - modeToggleCenter)).toBeLessThanOrEqual(8);
      }
    });
  }
}
