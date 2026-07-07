import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Glob } from 'bun';
import { describe, expect, it } from 'bun:test';

import { findOneArgumentServerComponentBoundaries } from './svelte-plugin.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const serverDistributionRoot = join(packageRoot, 'dist/server');
const SERVER_COMPONENT_IDENTITY_SCAN_BATCH_SIZE = 64;

describe.skipIf(!existsSync(serverDistributionRoot))(
  'server component boundaries preserve component identity',
  () => {
    it('contains no one-argument renderer.component boundaries in dist/server', async () => {
      const offenders: string[] = [];
      const glob = new Glob('**/*.js');
      const relativePaths = await Array.fromAsync(glob.scan({ cwd: serverDistributionRoot }));

      for (
        let startIndex = 0;
        startIndex < relativePaths.length;
        startIndex += SERVER_COMPONENT_IDENTITY_SCAN_BATCH_SIZE
      ) {
        const batch = relativePaths.slice(
          startIndex,
          startIndex + SERVER_COMPONENT_IDENTITY_SCAN_BATCH_SIZE,
        );
        const batchOffenders = await Promise.all(
          batch.map(async (relativePath) => {
            const filePath = join(serverDistributionRoot, relativePath);
            const source = await Bun.file(filePath).text();
            const boundaries = findOneArgumentServerComponentBoundaries(source, filePath);
            return boundaries.map(
              (boundary) => `${relativePath}:${boundary.line}:${boundary.column}`,
            );
          }),
        );
        offenders.push(...batchOffenders.flat());
      }

      expect(offenders).toEqual([]);
    });
  },
);
