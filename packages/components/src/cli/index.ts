#!/usr/bin/env node

/**
 * The `cinder` binary's published entry point.
 *
 * The manifest's `bin` maps `cinder` to `dist/cli/index.js`, which the build
 * bundles from this path. Corvidae keeps the implementation under
 * `scripts/knowledge/`, outside the published source tree; the build inlines it
 * here, so the binary ships complete rather than pointing at a directory the
 * `files` allowlist does not carry.
 *
 * `scripts/knowledge/index.ts` runs its own `isCliEntrypoint()` dispatch at
 * module evaluation, which this re-export preserves.
 */

export * from '../../scripts/knowledge/index.ts';
