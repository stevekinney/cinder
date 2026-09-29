import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { throwingRejectionOf } from '@lostgradient/testing';
import { buildManifest } from './generate-manifest.ts';
import {
  checkRootMetadataExports,
  generateRootMetadataExports,
  writeRootMetadataExports,
} from './generate-root-metadata-exports.ts';

describe('root metadata export generation', () => {
  test('generates the complete public artifact census with collision checks', async () => {
    const manifest = await buildManifest();
    const generated = await generateRootMetadataExports(manifest, undefined, false);
    const contents = [...generated.values()].join('\n');

    expect(generated.size).toBe(6);
    expect((contents.match(/export \{ default as .*Schema \}/g) ?? []).length).toBe(200);
    expect((contents.match(/export \{ default as .*Variables \}/g) ?? []).length).toBe(200);
    expect((contents.match(/import .*Constraints from .*\.json/g) ?? []).length).toBe(4);
    expect((contents.match(/import .*Examples from .*\.json/g) ?? []).length).toBe(170);
    expect(contents).toContain('schemaFormSchema');

    const first = manifest.components.at(0);
    const second = manifest.components.at(1);
    if (first === undefined || second === undefined) {
      throw new Error('Expected the generated manifest to contain at least two components');
    }
    const duplicateManifest = {
      ...manifest,
      components: [first, { ...second, id: first.id }],
    };
    await Promise.resolve(
      expect(
        await throwingRejectionOf(generateRootMetadataExports(duplicateManifest, undefined, false)),
      ).toThrow(/Metadata export .* collides/),
    );
  });

  test('detects missing and stale generated files in an isolated output directory', async () => {
    const manifest = await buildManifest();
    const directory = mkdtempSync(join(tmpdir(), 'cinder-root-metadata-'));
    try {
      await writeRootMetadataExports(manifest, directory, false);
      expect(await checkRootMetadataExports(manifest, directory, false)).toEqual([]);

      const schemaPath = join(directory, 'metadata-schemas.ts');
      writeFileSync(schemaPath, `${await Bun.file(schemaPath).text()}\n`);
      expect(await checkRootMetadataExports(manifest, directory, false)).toContain(
        'root metadata export metadata-schemas.ts is stale',
      );

      rmSync(join(directory, 'metadata-variables.ts'));
      expect(await checkRootMetadataExports(manifest, directory, false)).toContain(
        'root metadata export metadata-variables.ts is missing',
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
