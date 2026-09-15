import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, test } from 'bun:test';

const repositoryRoot = resolve(import.meta.dir, '..', '..', '..');
const productionSpec = resolve(
  repositoryRoot,
  'packages/testing/tests/playground-production.playwright.ts',
);

function listTests(
  config: string,
  argumentsList: string[],
  environment: Record<string, string | undefined> = {},
): ReturnType<typeof Bun.spawnSync> {
  const env = { ...process.env, ...environment };
  for (const [name, value] of Object.entries(env)) if (value === undefined) delete env[name];
  return Bun.spawnSync(
    ['bunx', 'playwright', 'test', '--config', config, '--list', ...argumentsList],
    { cwd: repositoryRoot, env },
  );
}

function output(result: ReturnType<typeof Bun.spawnSync>): string {
  return result.stdout?.toString() ?? '';
}

describe('Playwright discovery lane ownership', () => {
  test('ordinary discovery excludes the artifact-only production spec before importing it', () => {
    const result = listTests(
      'packages/testing/playwright.config.ts',
      ['playground-production|playground-landing'],
      { PLAYGROUND_STATIC_REPORT: undefined },
    );

    expect(result.exitCode).toBe(0);
    expect(output(result)).toContain('Total: 2 tests in 1 file');
    expect(output(result)).not.toContain('PLAYGROUND_STATIC_REPORT is required');
  });

  test('dedicated discovery loads the production matrix from its positive report fixture', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cinder-playwright-discovery-'));
    try {
      const reportPath = join(root, 'static-report.json');
      const wrapperPath = join(root, 'production-wrapper.playwright.ts');
      await writeFile(
        reportPath,
        JSON.stringify({ routes: ['/', '/page/button', '/page/schema-form'] }),
      );
      await writeFile(wrapperPath, `import ${JSON.stringify(productionSpec)};\n`);
      const result = listTests('packages/testing/playwright-static.config.ts', [], {
        PLAYGROUND_STATIC_REPORT: reportPath,
        PLAYWRIGHT_TEST_DIR: root,
        PLAYWRIGHT_TEST_MATCH: '**/production-wrapper.playwright.ts',
      });

      expect(result.exitCode).toBe(0);
      expect(output(result)).toContain('Total: 4 tests in 1 file');
      expect(output(result)).toContain('desktop');
      expect(output(result)).toContain('mobile');
      const missingReport = listTests('packages/testing/playwright-static.config.ts', [], {
        PLAYGROUND_STATIC_REPORT: undefined,
        PLAYWRIGHT_TEST_DIR: root,
        PLAYWRIGHT_TEST_MATCH: '**/production-wrapper.playwright.ts',
      });
      expect(missingReport.exitCode).not.toBe(0);
      expect(output(missingReport) + missingReport.stderr?.toString()).toContain(
        'PLAYGROUND_STATIC_REPORT is required',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
