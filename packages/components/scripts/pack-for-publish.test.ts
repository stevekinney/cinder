import { describe, expect, it } from 'bun:test';

import { buildPublishedManifest, type SourceManifest } from './pack-for-publish.ts';

describe('buildPublishedManifest', () => {
  it('keeps Svelte test-harness exclusions after broad Svelte includes', () => {
    const manifest: SourceManifest = {
      name: 'cinder',
      version: '0.0.0',
      exports: {},
    };

    const published = buildPublishedManifest(manifest, []);
    const files = published.files ?? [];

    expect(files.indexOf('src/components/**/*.svelte')).toBeGreaterThanOrEqual(0);
    expect(files.indexOf('!src/components/**/_*-test-harness.svelte')).toBeGreaterThan(
      files.indexOf('src/components/**/*.svelte'),
    );
    expect(files.indexOf('!src/components/**/*.type-test.svelte')).toBeGreaterThan(
      files.indexOf('src/components/**/*.svelte'),
    );
  });
});
