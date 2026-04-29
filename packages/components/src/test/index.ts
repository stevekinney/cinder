/**
 * Test helper barrel. Internal — not part of the public package surface.
 *
 * Helpers in this directory are intended for use by Cinder's own component
 * tests. They are not exported from the package and should not be relied upon
 * by consumers.
 */

export { expectAttribute, expectAttributes, getRelated } from './aria.ts';
export { setupHappyDom } from './happy-dom.ts';
export { renderThenHydrate, type HydrateResult } from './hydrate.ts';
export {
  expectFocused,
  getFocused,
  press,
  pressSequence,
  type Key,
  type KeyModifiers,
} from './keyboard.ts';
export { expectNoLeakedTimers, trackTimers } from './lifecycle.ts';
