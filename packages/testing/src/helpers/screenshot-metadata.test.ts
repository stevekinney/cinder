import { describe, expect, it } from 'bun:test';
import { readFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';

import { screenshotMetadataPath, screenshotPath, type ArtifactKey } from './artifact-path.ts';
import { buildScreenshotMetadata, writeScreenshotMetadata } from './screenshot-metadata.ts';

const key: ArtifactKey = {
  slug: 'metadata-contract-test',
  theme: 'light',
  viewport: 'desktop',
  fixture: 'focused',
};

const metadataInput = {
  key,
  component: 'Metadata Contract',
  category: 'interaction-state' as const,
  route: '/page/metadata-contract-test?fixture=focused',
  fixtureContentHash: 'a'.repeat(64),
  interact: [{ action: 'focus' as const, target: { label: 'Focused input' } }],
  mask: [{ testId: 'dynamic-clock', reason: 'timestamp' as const, maxAreaPercent: 5 }],
};

describe('screenshot metadata sidecars', () => {
  it('builds the full sidecar contract from an artifact key', () => {
    expect(buildScreenshotMetadata(metadataInput)).toEqual({
      slug: key.slug,
      component: 'Metadata Contract',
      fixture: key.fixture,
      category: 'interaction-state',
      theme: key.theme,
      viewport: key.viewport,
      route: metadataInput.route,
      fixtureContentHash: metadataInput.fixtureContentHash,
      interact: metadataInput.interact,
      mask: metadataInput.mask,
      screenshotPath: screenshotPath(key),
    });
  });

  it('writes the viewport-aware metadata file shape', async () => {
    const outputPath = screenshotMetadataPath(key);
    await rm(dirname(outputPath), { recursive: true, force: true });

    try {
      await writeScreenshotMetadata(metadataInput);
      const written = JSON.parse(await readFile(outputPath, 'utf8'));

      expect(outputPath.endsWith('/light-desktop-focused.json')).toBe(true);
      expect(written).toEqual(buildScreenshotMetadata(metadataInput));
    } finally {
      await rm(dirname(outputPath), { recursive: true, force: true });
    }
  });
});
