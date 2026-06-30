import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Glob } from 'bun';
import { describe, expect, it } from 'bun:test';

import { findOneArgumentServerComponentBoundaries } from './svelte-plugin.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const serverDistributionRoot = join(packageRoot, 'dist/server');

describe.skipIf(!existsSync(serverDistributionRoot))(
  'server component boundaries preserve component identity',
  () => {
    it('contains no one-argument renderer.component boundaries in dist/server', async () => {
      const offenders: string[] = [];
      const glob = new Glob('**/*.js');

      for await (const relativePath of glob.scan({ cwd: serverDistributionRoot })) {
        const filePath = join(serverDistributionRoot, relativePath);
        const source = await Bun.file(filePath).text();
        const boundaries = findOneArgumentServerComponentBoundaries(source, filePath);
        for (const boundary of boundaries) {
          offenders.push(`${relativePath}:${boundary.line}:${boundary.column}`);
        }
      }

      expect(offenders).toEqual([]);
    });
  },
);
