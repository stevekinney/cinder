import { describe, expect, test } from 'bun:test';
import { chmod, cp, link, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArtifactTreeManifest, verifyArtifactTree } from './playground-artifact-tree.ts';

describe('playground artifact tree identity', () => {
  test.each(['newline', 'hardlink', 'extra-file'].map((kind) => ({ kind })))(
    'rejects actual archive with $kind',
    async ({ kind }) => {
      const root = await mkdtemp(join(tmpdir(), 'cinder-archive-rejection-'));
      const payload = join(root, 'payload');
      try {
        const staticDirectory = join(payload, 'vercel-output', 'static');
        await mkdir(staticDirectory, { recursive: true });
        await writeFile(join(staticDirectory, 'index.html'), '<h1>ok</h1>');
        await writeFile(
          join(payload, 'static-playground-report.json'),
          JSON.stringify({ sourceSha: 'a'.repeat(40), artifactDigest: 'b'.repeat(64) }),
        );
        if (kind === 'newline')
          await writeFile(join(staticDirectory, 'line\nbreak.txt'), 'ambiguous name');
        if (kind === 'hardlink')
          await link(join(staticDirectory, 'index.html'), join(staticDirectory, 'hardlink.html'));
        await Bun.write(
          join(payload, 'artifact-tree-manifest.json'),
          JSON.stringify(await createArtifactTreeManifest(payload)),
        );
        if (kind === 'extra-file')
          await writeFile(join(staticDirectory, 'extra.txt'), 'not in the producer manifest');
        const archive = join(root, 'artifact.tar');
        expect(
          Bun.spawnSync([
            'tar',
            '-cf',
            archive,
            '-C',
            payload,
            'vercel-output',
            'static-playground-report.json',
            'artifact-tree-manifest.json',
          ]).exitCode,
        ).toBe(0);
        const result = Bun.spawnSync([
          'bun',
          'run',
          'packages/testing/scripts/extract-playground-artifact.ts',
          '--archive',
          archive,
          '--destination',
          join(root, 'extracted'),
        ]);
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr.toString()).toMatch(/unsafe|ambiguous|identity/);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  test('includes complete metadata and rejects additions or mutations', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cinder-artifact-tree-'));
    try {
      await mkdir(join(root, 'vercel-output', 'static'), { recursive: true });
      await writeFile(join(root, 'vercel-output', 'static', 'index.html'), '<h1>ok</h1>');
      await writeFile(
        join(root, 'static-playground-report.json'),
        JSON.stringify({ sourceSha: 'a'.repeat(40) }),
      );
      await chmod(join(root, 'vercel-output', 'static', 'index.html'), 0o640);
      const manifest = await createArtifactTreeManifest(root);
      await verifyArtifactTree(root, manifest);
      await writeFile(join(root, 'unexpected.txt'), 'added');
      await expect(verifyArtifactTree(root, manifest)).rejects.toThrow(/identity/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('round-trips a real tar archive and final prebuilt-tree restore', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cinder-artifact-roundtrip-'));
    const extracted = join(root, 'extracted');
    const restored = join(root, 'restored');
    try {
      await mkdir(join(root, 'vercel-output', 'static'), { recursive: true });
      await writeFile(join(root, 'vercel-output', 'static', 'index.html'), '<h1>ok</h1>');
      await writeFile(
        join(root, 'static-playground-report.json'),
        JSON.stringify({ sourceSha: 'a'.repeat(40), artifactDigest: 'b'.repeat(64) }),
      );
      const manifestPath = join(root, 'artifact-tree-manifest.json');
      await Bun.write(manifestPath, `${JSON.stringify(await createArtifactTreeManifest(root))}\n`);
      const archive = join(root, 'artifact.tar');
      expect(
        Bun.spawnSync([
          'tar',
          '-cf',
          archive,
          '-C',
          root,
          'vercel-output',
          'static-playground-report.json',
          'artifact-tree-manifest.json',
        ]).exitCode,
      ).toBe(0);
      const extract = Bun.spawnSync([
        'bun',
        'run',
        'packages/testing/scripts/extract-playground-artifact.ts',
        '--archive',
        archive,
        '--destination',
        extracted,
      ]);
      expect(extract.exitCode).toBe(0);
      await mkdir(restored, { recursive: true });
      await cp(join(extracted, 'vercel-output'), join(restored, 'vercel-output'), {
        recursive: true,
      });
      await verifyArtifactTree(
        join(restored, 'vercel-output'),
        JSON.parse(await Bun.file(manifestPath).text()),
        'vercel-output',
      );

      const hostile = join(root, 'hostile.tar');
      const outside = join(root, 'outside.txt');
      await writeFile(outside, 'outside');
      await symlink(outside, join(root, 'vercel-output', 'static', 'escape'));
      expect(Bun.spawnSync(['tar', '-cf', hostile, '-C', root, 'vercel-output']).exitCode).toBe(0);
      const hostileExtract = Bun.spawnSync([
        'bun',
        'run',
        'packages/testing/scripts/extract-playground-artifact.ts',
        '--archive',
        hostile,
        '--destination',
        join(root, 'hostile-extracted'),
      ]);
      expect(hostileExtract.exitCode).not.toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
