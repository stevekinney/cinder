/**
 * CSS test helpers. Internal — not part of the public package surface.
 *
 * Mirrors `@lostgradient/cinder`'s own internal `src/test/css.ts` helper
 * (`injectStrippedStyles`), adapted for Chat: Chat components rely on Cinder's
 * `.cinder-sr-only` utility rather than declaring their own visually-hidden
 * recipe, so a Chat test asserting real `getComputedStyle` values on a
 * visually-hidden element needs that rule injected into happy-dom's document —
 * happy-dom does not resolve `@import` or apply cross-package stylesheets on
 * its own.
 */

/**
 * Inject one or more raw CSS texts into a single `<style>` element appended to
 * `document.head`, so a test can assert real `getComputedStyle` values instead
 * of grepping markup or CSS source text. Returns a cleanup function that
 * removes the injected `<style>` — call it in a `finally` block or `afterEach`
 * so styles never leak across tests.
 */
export function injectStyles(...cssTexts: string[]): () => void {
  const style = document.createElement('style');
  style.textContent = cssTexts.join('\n');
  document.head.append(style);
  return () => style.remove();
}
