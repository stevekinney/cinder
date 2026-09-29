/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { resetEscapeStack, resetScrollLock } from '../../_internal/overlay.ts';
import { installDrawerDialogStubs, installDrawerStyleProbe } from './drawer-test-helpers.ts';

setupHappyDom();
installDrawerDialogStubs();
const restoreDrawerStyles = installDrawerStyleProbe();
const { cleanup } = await import('@testing-library/svelte');
const drawerCss = await Bun.file(new URL('./drawer.css', import.meta.url)).text();
const PLACEMENT_SLIDE_VECTORS: Record<string, string> = {
  right: '--_cinder-drawer-slide: 100% 0;',
  left: '--_cinder-drawer-slide: -100% 0;',
  bottom: '--_cinder-drawer-slide: 0 100%;',
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
async function schemaPlacements(): Promise<string[]> {
  const schema: unknown = JSON.parse(
    await Bun.file(new URL('./drawer.schema.json', import.meta.url)).text(),
  );
  const placement =
    isRecord(schema) && isRecord(schema['properties']) ? schema['properties']['placement'] : null;
  const enumValues = isRecord(placement) ? placement['enum'] : null;
  if (
    !Array.isArray(enumValues) ||
    !enumValues.every((value): value is string => typeof value === 'string')
  )
    throw new Error('drawer.schema.json placement enum is malformed');
  return enumValues;
}

afterAll(() => {
  restoreDrawerStyles();
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
  resetEscapeStack();
});
describe('Drawer slide direction lifecycle', () => {
  test('the slide-vector map covers every placement in the generated schema', async () => {
    const placements = await schemaPlacements();
    expect(Object.keys(PLACEMENT_SLIDE_VECTORS).toSorted()).toEqual(placements.toSorted());
  });
  test('every placement block declares its slide vector', async () => {
    for (const placement of await schemaPlacements()) {
      const selector = `.cinder-drawer__panel[data-cinder-placement='${placement}']`;
      const selectorIndex = drawerCss.indexOf(`${selector} {`);
      expect(selectorIndex).toBeGreaterThan(-1);
      const rule = drawerCss.slice(selectorIndex, drawerCss.indexOf('}', selectorIndex));
      expect(rule).toContain(
        PLACEMENT_SLIDE_VECTORS[placement] ?? `<no slide vector mapped for ${placement}>`,
      );
    }
  });
  test('one closing rule and one @starting-style rule consume the slide vector', () => {
    const closingIndex = drawerCss.indexOf('.cinder-drawer__panel[data-cinder-closing]');
    expect(closingIndex).toBeGreaterThan(-1);
    const closingRule = drawerCss.slice(closingIndex, drawerCss.indexOf('}', closingIndex));
    expect(closingRule).toContain('translate: var(--_cinder-drawer-slide);');

    const panelStartingStyleIndex = drawerCss.indexOf('@starting-style', closingIndex);
    expect(panelStartingStyleIndex).toBeGreaterThan(-1);
    const startingBlock = drawerCss.slice(panelStartingStyleIndex);
    const panelIndex = startingBlock.indexOf('.cinder-drawer__panel');
    expect(panelIndex).toBeGreaterThan(-1);
    const startingRule = startingBlock.slice(panelIndex, startingBlock.indexOf('}', panelIndex));
    expect(startingRule).toContain('translate: var(--_cinder-drawer-slide);');
  });

  // ---------------------------------------------------------------------------
  // Focus trap wrap behavior (ported from the former Sheet suite).
  //
  // DOM order inside the panel: the close button lives in the <header> first,
  // then the body <input>. So the close button is the FIRST tabbable and the
  // input is the LAST — asserting exact wrap destinations (not mere panel
  // containment, which is already true before the event) makes these tests fail
  // if the shared trap is removed or its boundary logic breaks.
  //
  // Each test `await tick()`s after render: on open, the drawer defers its own
  // initial focus to the body via `tick().then(() => bodyElement.focus())`. That
  // microtask must drain BEFORE we exercise the trap, otherwise it races in
  // during the `await fireEvent` and clobbers the trap's wrap destination. In
  // real usage the deferred focus has long settled before a user tabs.
  // ---------------------------------------------------------------------------
});
