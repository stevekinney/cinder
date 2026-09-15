import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { caseIdentities, expectedCases, readShardEvidence } from './static-playground-evidence.ts';
import { runStaticPlaywright } from './static-playground-runner.ts';

const testingRoot = resolve(import.meta.dirname, '..');
const legacyReport = join(testingRoot, 'test-results/playground-production.json');
const routes = ['/', '/one', '/two', '/three', '/four'];

async function runChild(root: string, index: number, total: number, mode: string): Promise<void> {
  const evidence =
    mode === 'default'
      ? join(testingRoot, `test-results/playground-production-evidence-${process.pid}`)
      : join(root, 'evidence', `shard-${index}`);
  await writeFile(join(root, 'child-evidence.json'), JSON.stringify(evidence));
  const code = await runStaticPlaywright(
    join(root, 'static'),
    join(root, 'producer.json'),
    { cleanUrls: true, rewrites: [{ source: '/', destination: '/index.html' }] },
    { index, total },
    mode === 'default' ? undefined : evidence,
  );
  process.exitCode = code;
}

async function main(): Promise<void> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cinder-playwright-evidence-')));
  const previousLegacy = await readFile(legacyReport).catch(() => undefined);
  let defaultEvidence: string | undefined;
  try {
    await mkdir(join(root, 'static'));
    await writeFile(join(root, 'static/index.html'), '<h1>Fixture</h1>');
    await mkdir(join(root, 'specifications'));
    const testModule = createRequire(import.meta.url).resolve('@playwright/test');
    await writeFile(
      join(root, 'specifications/playground-production.playwright.ts'),
      [
        `import { expect, test } from ${JSON.stringify(testModule)};`,
        `const routes = ${JSON.stringify(routes)};`,
        `for (const route of routes) for (const viewport of ['desktop', 'mobile']) {`,
        `  if (process.env.SMOKE_OMIT_LAST && route === '/four' && viewport === 'mobile') continue;`,
        '  test(`${route} documentation and playground at ${viewport}`, () => { expect(route.startsWith("/")).toBe(true); });',
        `}`,
      ].join('\n'),
    );
    await writeFile(
      join(root, 'producer.json'),
      JSON.stringify({
        sourceSha: 'a'.repeat(40),
        artifactDigest: 'b'.repeat(64),
        routes,
        manifest: [],
      }),
    );
    const environment = {
      ...process.env,
      CI: '1',
      PLAYWRIGHT_TEST_DIR: join(root, 'specifications'),
      PLAYWRIGHT_TEST_MATCH: 'playground-production.playwright.ts',
    };
    const launch = (index: number, total: number, mode = 'explicit', omitLast = false) =>
      Bun.spawnSync(
        [
          process.execPath,
          import.meta.path,
          '--runner-child',
          root,
          String(index),
          String(total),
          mode,
        ],
        { cwd: testingRoot, env: { ...environment, SMOKE_OMIT_LAST: omitLast ? '1' : '' } },
      );
    const union = new Set<string>();
    const blobDigests = new Set<string>();
    const mergeInput = join(root, 'merge-input');
    await mkdir(mergeInput);
    for (let index = 1; index <= 8; index++) {
      const result = launch(index, 8);
      assert.equal(result.exitCode, 0, result.stdout.toString() + result.stderr.toString());
      const evidence = await readShardEvidence(join(root, 'evidence', `shard-${index}`));
      const cases = caseIdentities(evidence.report);
      assert(cases.size > 0, `shard ${index} must collect cases`);
      for (const item of cases) {
        assert(!union.has(item));
        union.add(item);
      }
      const blob = join(evidence.directory, 'blob/report.zip');
      blobDigests.add(
        createHash('sha256')
          .update(await readFile(blob))
          .digest('hex'),
      );
      await cp(blob, join(mergeInput, `report-${index}.zip`));
    }
    assert.deepEqual(union, expectedCases(routes));
    assert.equal(blobDigests.size, 8);
    const aggregate = Bun.spawnSync([
      process.execPath,
      join(import.meta.dirname, 'aggregate-static-playground.ts'),
      '--report',
      join(root, 'producer.json'),
      '--evidence-directory',
      join(root, 'evidence'),
      '--shards',
      '8',
      '--output',
      join(root, 'aggregate.json'),
    ]);
    assert.equal(aggregate.exitCode, 0, aggregate.stderr.toString());
    const aggregateReport = await Bun.file(join(root, 'aggregate.json')).json();
    assert.equal(aggregateReport.cases, expectedCases(routes).size);
    const mergedJson = join(root, 'merged.json');
    const merge = Bun.spawnSync(
      [
        process.execPath,
        'x',
        '--no-install',
        'playwright',
        'merge-reports',
        '--reporter=json,html',
        mergeInput,
      ],
      {
        cwd: testingRoot,
        env: {
          ...environment,
          PLAYWRIGHT_JSON_OUTPUT_FILE: mergedJson,
          PLAYWRIGHT_HTML_OUTPUT_DIR: join(root, 'html'),
          PLAYWRIGHT_HTML_OPEN: 'never',
        },
      },
    );
    assert.equal(merge.exitCode, 0, merge.stderr.toString());
    assert.deepEqual(caseIdentities(await Bun.file(mergedJson).json(), 'merged'), union);
    const html = await readFile(join(root, 'html/index.html'));
    assert(html.byteLength > 0);

    const unsharded = launch(1, 1, 'default');
    defaultEvidence = await Bun.file(join(root, 'child-evidence.json')).json();
    assert.equal(unsharded.exitCode, 0, unsharded.stderr.toString());
    assert.equal(typeof defaultEvidence, 'string');
    const local = await readShardEvidence(defaultEvidence!);
    assert.deepEqual(local.manifest.shard, { index: 1, total: 1 });
    assert.deepEqual(caseIdentities(local.report), union);
    assert.deepEqual(
      await readFile(legacyReport),
      await readFile(join(defaultEvidence!, 'playwright.json')),
    );
    await rm(join(root, 'evidence'), { recursive: true });
    const incomplete = launch(1, 1, 'explicit', true);
    assert.notEqual(incomplete.exitCode, 0);
    assert.match(incomplete.stderr.toString(), /unsharded case coverage is incomplete/);
    console.log(
      'Static evidence fixtures passed: 8 distinct real shards, merged exact case union, default 1/1 parity, incomplete local coverage rejected.',
    );
  } finally {
    if (defaultEvidence) await rm(defaultEvidence, { recursive: true, force: true });
    if (previousLegacy) await writeFile(legacyReport, previousLegacy);
    else await rm(legacyReport, { force: true });
    await rm(root, { recursive: true, force: true });
  }
}

try {
  if (process.argv[2] === '--runner-child') {
    await runChild(
      process.argv[3]!,
      Number(process.argv[4]),
      Number(process.argv[5]),
      process.argv[6]!,
    );
  } else await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
