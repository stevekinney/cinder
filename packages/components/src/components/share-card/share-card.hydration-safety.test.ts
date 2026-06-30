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
 * The expensive two-build SSR discriminator is covered by the synthetic
 * `hydration-probe-child-browser-flag` fixture in `src/test/hydration-safety.test.ts`.
 * This real-world companion keeps ShareCard itself pinned to the safe source
 * shape: no `esm-env` browser import, and the native-share capability check must
 * be guarded by the post-hydration state.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

const shareCardPath = new URL('./share-card.svelte', import.meta.url).pathname;

describe('ShareCard build-flag hydration safety', () => {
  test('native-share capability stays behind the post-hydration gate', () => {
    const source = readFileSync(shareCardPath, 'utf-8');

    expect(source).not.toMatch(/from\s+['"]esm-env['"]/);
    expect(source).toContain('let hydrated = $state(false);');
    expect(source).toContain('$effect(() => {\n    hydrated = true;\n  });');
    expect(source).toMatch(
      /const canNativeShare = \$derived\(\s*hydrated && typeof navigator !== 'undefined' && typeof navigator\.share === 'function',\s*\);/,
    );
    expect(source).toMatch(/{#if !actions && canNativeShare}\s*{@render shareButton/s);
  });
});
