/// <reference lib="dom" />
/**
 * Build-flag hydration-safety regression for ShareCard (issue #11 / #324).
 *
 * ShareCard's native-share button is a client-only affordance. It originally
 * gated on `esm-env`'s `BROWSER` build flag, which made the SSR markup
 * (`BROWSER=false`) disagree with the client's initial hydration render
 * (`BROWSER=true`) — a hydration mismatch. The fix gates it on a `hydrated`
 * `$effect` instead, so the SSR render is identical regardless of the build
 * flag. ShareCard also unconditionally renders a child component
 * (`VisuallyHiddenLiveRegion`), making it the "component with unconditional
 * child-effects" case the helper is built for.
 *
 * This pins the fix: render ShareCard's SSR output under `BROWSER=false` and
 * `BROWSER=true` and assert they agree. A regression to a build-flag gate would
 * make the two diverge and fail here.
 */
import { describe, expect, test } from 'bun:test';

import { checkBuildFlagHydrationSafety } from '../../test/hydration-safety.ts';

const shareCardPath = new URL('./share-card.svelte', import.meta.url).pathname;

describe('ShareCard build-flag hydration safety', () => {
  test('SSR markup is invariant under the BROWSER build-flag flip', async () => {
    const result = await checkBuildFlagHydrationSafety(shareCardPath, {
      value: 'https://example.com/share/abc',
    });
    expect(result.buildFlagInvariant).toBe(true);
    // The native-share affordance must be absent from BOTH renders — it only
    // appears after the `hydrated` $effect runs post-hydration, never in SSR.
    expect(result.serverHtml).not.toContain('data-cinder-action="native-share"');
    expect(result.clientHtml).not.toContain('data-cinder-action="native-share"');
  });
});
