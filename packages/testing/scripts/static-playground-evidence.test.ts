import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import {
  aggregateShardEvidence,
  caseIdentities,
  expectedCases,
  readShardEvidence,
} from './static-playground-evidence.ts';

const producer = {
  sourceSha: 'a'.repeat(40),
  artifactDigest: 'b'.repeat(64),
  routes: ['/', '/one', '/two', '/three'],
  manifest: [],
};

function report(route: string, viewport: 'desktop' | 'mobile') {
  return {
    suites: [
      {
        specs: [
          {
            file: 'playground-production.playwright.ts',
            title: `${route} documentation and playground at ${viewport}`,
            tests: [
              {
                projectName: 'chromium',
                projectId: 'chromium',
                expectedStatus: 'passed',
                status: 'expected',
                results: [{ status: 'passed', retry: 0, errors: [] }],
              },
            ],
          },
        ],
      },
    ],
  };
}

async function evidence(
  root: string,
  index: number,
  entries: Array<[string, 'desktop' | 'mobile']>,
  exitCode = 0,
) {
  const directory = join(root, `shard-${index}`);
  await mkdir(join(directory, 'blob'), { recursive: true });
  await mkdir(join(directory, 'failures'), { recursive: true });
  await writeFile(join(directory, 'blob', 'report.zip'), 'blob fixture');
  await writeFile(
    join(directory, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      sourceSha: producer.sourceSha,
      artifactDigest: producer.artifactDigest,
      shard: { index, total: 8 },
      exitCode,
      inventory: [...expectedCases(producer.routes)].sort(),
    }),
  );
  await writeFile(
    join(directory, 'playwright.json'),
    JSON.stringify({
      suites: entries.map(([route, viewport]) => report(route, viewport).suites[0]!),
    }),
  );
}

describe('static playground evidence', () => {
  test('includes both landing viewport cases in the expected inventory', () => {
    expect(expectedCases(producer.routes)).toContain('/\u0000desktop');
    expect(expectedCases(producer.routes)).toContain('/\u0000mobile');
  });

  test('preserves strict shard identity while accepting the installed merged-report schema', () => {
    const merged = report('/one', 'desktop');
    Reflect.deleteProperty(merged.suites[0]!.specs[0]!.tests[0]!, 'projectId');
    expect(() => caseIdentities(merged)).toThrow(/identity/);
    expect(caseIdentities(merged, 'merged')).toEqual(new Set(['/one\u0000desktop']));
    merged.suites[0]!.specs[0]!.tests[0]!.projectName = 'firefox';
    expect(() => caseIdentities(merged, 'merged')).toThrow(/identity/);
  });

  test('reads nested describe suites without dropping their specs', () => {
    expect(
      caseIdentities({ suites: [{ specs: [], suites: report('/one', 'desktop').suites }] }),
    ).toEqual(new Set(['/one\u0000desktop']));
  });

  test('rejects empty or missing blob output even when the JSON report passed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cinder-static-missing-blob-'));
    try {
      await evidence(root, 1, [['/one', 'desktop']]);
      const directory = join(root, 'shard-1');
      await writeFile(join(directory, 'blob', 'report.zip'), '');
      await expect(readShardEvidence(directory)).rejects.toThrow(/blob/);
      await rm(join(directory, 'blob', 'report.zip'));
      await expect(readShardEvidence(directory)).rejects.toThrow(/blob/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('aggregate command rejects duplicate and unknown flags before reading reports', () => {
    for (const argumentsList of [
      ['--report', '/tmp/missing', '--report', '/tmp/other'],
      ['--report', '/tmp/missing', '--evidence-directory', '/tmp/missing', '--unexpected'],
    ]) {
      const result = Bun.spawnSync([
        'bun',
        'run',
        'packages/testing/scripts/aggregate-static-playground.ts',
        '--',
        ...argumentsList,
      ]);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toMatch(/aggregate|unknown/i);
    }
  });

  test('rejects skipped or malformed terminal results', () => {
    expect(() =>
      caseIdentities({
        suites: [
          {
            specs: [
              {
                file: 'playground-production.playwright.ts',
                title: '/one documentation and playground at desktop',
                tests: [
                  {
                    projectName: 'chromium',
                    projectId: 'chromium',
                    expectedStatus: 'passed',
                    status: 'expected',
                    results: [{ status: 'skipped', retry: 0, errors: [] }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow(/did not pass terminally/);
  });

  test('rejects report-level errors, annotations, duplicate cases, and unknown cases', () => {
    const passing = report('/one', 'desktop');
    expect(() => caseIdentities({ ...passing, errors: [{ message: 'worker failed' }] })).toThrow(
      /report-level errors/,
    );
    expect(() => caseIdentities({ suites: [passing.suites[0], passing.suites[0]] })).toThrow(
      /duplicate/,
    );
    const annotated = structuredClone(passing) as Record<string, unknown>;
    const suites = annotated['suites'] as Array<Record<string, unknown>>;
    const specs = suites[0]!['specs'] as Array<Record<string, unknown>>;
    const tests = specs[0]!['tests'] as Array<Record<string, unknown>>;
    tests[0]!['annotations'] = [{ type: 'fixme' }];
    expect(() => caseIdentities(annotated)).toThrow(/invalid Playwright test identity/);
    expect(() => caseIdentities(report('/unknown', 'desktop'))).not.toThrow();
  });

  test('accepts a complete eight-shard union', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cinder-static-evidence-'));
    const entries = producer.routes.flatMap(
      (route) =>
        [
          ['' + route, 'desktop' as const],
          ['' + route, 'mobile' as const],
        ] as Array<[string, 'desktop' | 'mobile']>,
    );
    try {
      for (let index = 1; index <= 8; index++) await evidence(root, index, [entries[index - 1]!]);
      await writeFile(join(root, 'producer.json'), JSON.stringify(producer));
      const result = await aggregateShardEvidence({
        producerReport: join(root, 'producer.json'),
        evidenceDirectory: root,
        shards: 8,
        output: join(root, 'aggregate.json'),
      });
      expect(result.cases).toBe(8);
      expect(JSON.parse(await Bun.file(join(root, 'aggregate.json')).text()).artifactDigest).toBe(
        producer.artifactDigest,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects missing shard indices', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cinder-static-evidence-'));
    try {
      await evidence(root, 1, [['/one', 'desktop']]);
      await writeFile(join(root, 'producer.json'), JSON.stringify(producer));
      await expect(
        aggregateShardEvidence({
          producerReport: join(root, 'producer.json'),
          evidenceDirectory: root,
          shards: 8,
          output: join(root, 'aggregate.json'),
        }),
      ).rejects.toThrow(/missing or duplicate shard evidence/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects a mismatched source, digest, inventory, or nonzero process exit', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cinder-static-evidence-'));
    try {
      await evidence(root, 1, [['/one', 'desktop']], 1);
      const manifestPath = join(root, 'shard-1', 'manifest.json');
      await writeFile(
        manifestPath,
        JSON.stringify({
          schemaVersion: 1,
          sourceSha: 'wrong',
          artifactDigest: producer.artifactDigest,
          shard: { index: 1, total: 1 },
          exitCode: 1,
          inventory: [...expectedCases(producer.routes)].sort(),
        }),
      );
      await writeFile(join(root, 'producer.json'), JSON.stringify(producer));
      await expect(
        aggregateShardEvidence({
          producerReport: join(root, 'producer.json'),
          evidenceDirectory: root,
          shards: 1,
          output: join(root, 'aggregate.json'),
        }),
      ).rejects.toThrow(/identity mismatch|exited/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
