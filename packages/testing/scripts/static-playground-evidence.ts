import { lstat, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export type ShardIdentity = { index: number; total: number };
export type ExpectedReport = {
  sourceSha: string;
  artifactDigest: string;
  routes: string[];
  manifest: unknown[];
};
export type ShardManifest = {
  schemaVersion: 1;
  sourceSha: string;
  artifactDigest: string;
  shard: ShardIdentity;
  exitCode: number;
  inventory: string[];
};
export type ShardEvidence = {
  manifest: ShardManifest;
  report: unknown;
  directory: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`[static-playground] ${label} is invalid`);
  return value;
}

function requireFiniteInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value))
    throw new Error(`[static-playground] ${label} is invalid`);
  return value;
}

export function expectedCases(routes: readonly string[]): Set<string> {
  if (routes.length < 2 || routes[0] !== '/' || new Set(routes).size !== routes.length)
    throw new Error('[static-playground] producer route inventory is invalid');
  const cases = new Set<string>();
  for (const route of routes.slice(1)) {
    if (route === '/' || !route.startsWith('/'))
      throw new Error('[static-playground] producer route inventory is invalid');
    for (const viewport of ['desktop', 'mobile']) cases.add(`${route}\u0000${viewport}`);
  }
  return cases;
}

export function parseExpectedReport(value: unknown): ExpectedReport {
  if (!isRecord(value)) throw new Error('[static-playground] producer report is invalid');
  const sourceSha = requireString(value['sourceSha'], 'producer source SHA');
  const artifactDigest = requireString(value['artifactDigest'], 'producer artifact digest');
  const routes = value['routes'];
  const manifest = value['manifest'];
  if (!Array.isArray(routes) || !routes.every((route) => typeof route === 'string'))
    throw new Error('[static-playground] producer routes are invalid');
  if (!Array.isArray(manifest)) throw new Error('[static-playground] producer manifest is invalid');
  expectedCases(routes);
  return { sourceSha, artifactDigest, routes, manifest };
}

export function parseShardManifest(value: unknown): ShardManifest {
  if (!isRecord(value) || value['schemaVersion'] !== 1)
    throw new Error('[static-playground] shard manifest is invalid');
  const sourceSha = requireString(value['sourceSha'], 'shard source SHA');
  const artifactDigest = requireString(value['artifactDigest'], 'shard artifact digest');
  const shardValue = value['shard'];
  if (!isRecord(shardValue)) throw new Error('[static-playground] shard identity is invalid');
  const index = requireFiniteInteger(shardValue['index'], 'shard index');
  const total = requireFiniteInteger(shardValue['total'], 'shard total');
  if (total < 1 || index < 1 || index > total)
    throw new Error('[static-playground] shard identity is out of range');
  const exitCode = requireFiniteInteger(value['exitCode'], 'shard exit code');
  if (exitCode < 0) throw new Error('[static-playground] shard exit code is invalid');
  const inventory = value['inventory'];
  if (!Array.isArray(inventory) || !inventory.every((route) => typeof route === 'string'))
    throw new Error('[static-playground] shard inventory is invalid');
  if (new Set(inventory).size !== inventory.length)
    throw new Error('[static-playground] shard inventory contains duplicates');
  return {
    schemaVersion: 1,
    sourceSha,
    artifactDigest,
    shard: { index, total },
    exitCode,
    inventory,
  };
}

export async function readShardEvidence(directory: string): Promise<ShardEvidence> {
  const root = resolve(directory);
  const manifestPath = join(root, 'manifest.json');
  const reportPath = join(root, 'playwright.json');
  let manifest: ShardManifest;
  let report: unknown;
  try {
    manifest = parseShardManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
    report = JSON.parse(await readFile(reportPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `[static-playground] missing or malformed shard evidence in ${root}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  const blob = await stat(join(root, 'blob')).catch(() => undefined);
  if (!blob?.isDirectory()) {
    throw new Error(`[static-playground] missing blob report directory in ${root}`);
  }
  const blobFiles = await readdir(join(root, 'blob'));
  const reportBlob = await lstat(join(root, 'blob', 'report.zip')).catch(() => undefined);
  if (
    blobFiles.length !== 1 ||
    blobFiles[0] !== 'report.zip' ||
    !reportBlob?.isFile() ||
    reportBlob.size === 0
  )
    throw new Error(`[static-playground] missing, empty, or ambiguous blob report in ${root}`);
  const failures = await stat(join(root, 'failures')).catch(() => undefined);
  if (!failures?.isDirectory()) {
    throw new Error(`[static-playground] missing failures directory in ${root}`);
  }
  return { manifest, report, directory: root };
}

function collectSpecs(value: unknown, output: Array<Record<string, unknown>>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectSpecs(item, output);
    return;
  }
  if (!isRecord(value)) return;
  if (Array.isArray(value['specs'])) {
    for (const spec of value['specs']) if (isRecord(spec)) output.push(spec);
  }
  if (Array.isArray(value['suites'])) collectSpecs(value['suites'], output);
}

export function caseIdentities(report: unknown, format: 'shard' | 'merged' = 'shard'): Set<string> {
  if (!isRecord(report)) throw new Error('[static-playground] Playwright JSON report is invalid');
  if (report['errors'] !== undefined && !Array.isArray(report['errors']))
    throw new Error('[static-playground] Playwright JSON report errors are malformed');
  if (Array.isArray(report['errors']) && report['errors'].length > 0)
    throw new Error('[static-playground] Playwright JSON contains report-level errors');
  const specs: Array<Record<string, unknown>> = [];
  collectSpecs(report, specs);
  const identities = new Set<string>();
  for (const spec of specs) {
    const file = spec['file'];
    const title = spec['title'];
    const tests = spec['tests'];
    if (
      file !== 'playground-production.playwright.ts' ||
      typeof title !== 'string' ||
      !Array.isArray(tests) ||
      tests.length !== 1
    )
      throw new Error(
        `[static-playground] Playwright JSON contains an unknown or malformed spec: ${JSON.stringify({ file, title, tests: Array.isArray(tests) ? tests.length : null })}`,
      );
    const match = title.match(/^(\/[^ ]+) documentation and playground at (desktop|mobile)$/);
    if (!match) throw new Error(`[static-playground] unknown Playwright test title: ${title}`);
    const [route, viewport] = [match[1]!, match[2]!];
    const test = tests[0];
    if (
      !isRecord(test) ||
      test['projectName'] !== 'chromium' ||
      // Playwright 1.60 JSON from merge-reports omits the internal projectId.
      (format === 'shard' ? test['projectId'] !== 'chromium' : test['projectId'] !== undefined) ||
      test['expectedStatus'] !== 'passed' ||
      test['status'] !== 'expected' ||
      (test['annotations'] !== undefined &&
        (!Array.isArray(test['annotations']) || test['annotations'].length > 0))
    )
      throw new Error(
        `[static-playground] invalid Playwright test identity: ${title}; ${JSON.stringify(isRecord(test) ? { projectName: test['projectName'], projectId: test['projectId'], expectedStatus: test['expectedStatus'], status: test['status'], annotations: test['annotations'] } : test)}`,
      );
    const results = test['results'];
    if (!Array.isArray(results) || results.length !== 1)
      throw new Error(`[static-playground] ${title} must have exactly one result`);
    const result = results[0];
    if (
      !isRecord(result) ||
      result['status'] !== 'passed' ||
      result['retry'] !== 0 ||
      !Array.isArray(result['errors']) ||
      result['errors'].length !== 0 ||
      (result['annotations'] !== undefined &&
        (!Array.isArray(result['annotations']) || result['annotations'].length > 0))
    )
      throw new Error(`[static-playground] ${title} did not pass terminally without retries`);
    const identity = `${route}\u0000${viewport}`;
    if (identities.has(identity))
      throw new Error(`[static-playground] duplicate Playwright case: ${title}`);
    identities.add(identity);
  }
  return identities;
}

/** The same terminal-result contract applies to local runs and CI shard aggregation. */
export function validatedShardCases(shard: ShardEvidence, producer: ExpectedReport): Set<string> {
  const expected = expectedCases(producer.routes);
  const identity = shard.manifest;
  if (
    identity.sourceSha !== producer.sourceSha ||
    identity.artifactDigest !== producer.artifactDigest ||
    JSON.stringify(identity.inventory) !== JSON.stringify([...expected].sort())
  )
    throw new Error('[static-playground] shard producer identity mismatch');
  if (identity.exitCode !== 0)
    throw new Error(
      `[static-playground] shard ${identity.shard.index} exited with ${identity.exitCode}`,
    );
  const cases = caseIdentities(shard.report);
  if (cases.size === 0 || [...cases].some((item) => !expected.has(item)))
    throw new Error('[static-playground] shard case coverage is empty or invalid');
  if (identity.shard.total === 1 && cases.size !== expected.size)
    throw new Error('[static-playground] unsharded case coverage is incomplete');
  return cases;
}

export async function aggregateShardEvidence(options: {
  producerReport: string;
  evidenceDirectory: string;
  shards: number;
  output: string;
}): Promise<{ sourceSha: string; artifactDigest: string; cases: number; shards: number }> {
  if (!Number.isSafeInteger(options.shards) || options.shards < 1)
    throw new Error('[static-playground] shard total is invalid');
  const producer = parseExpectedReport(
    JSON.parse(await readFile(resolve(options.producerReport), 'utf8')),
  );
  const expected = expectedCases(producer.routes);
  const directoryEntries = await readdir(resolve(options.evidenceDirectory), {
    withFileTypes: true,
  });
  const entries = directoryEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(options.evidenceDirectory, entry.name));
  const evidence = await Promise.all(entries.map(readShardEvidence));
  if (evidence.length !== options.shards)
    throw new Error('[static-playground] missing or duplicate shard evidence');
  const seenShards = new Set<number>();
  const cases = new Set<string>();
  for (const shard of evidence) {
    const identity = shard.manifest;
    if (
      identity.shard.total !== options.shards ||
      identity.shard.index < 1 ||
      identity.shard.index > options.shards ||
      seenShards.has(identity.shard.index)
    )
      throw new Error('[static-playground] missing, duplicate, or mismatched shard');
    seenShards.add(identity.shard.index);
    for (const item of validatedShardCases(shard, producer)) {
      if (!expected.has(item) || cases.has(item))
        throw new Error('[static-playground] shard case union is invalid');
      cases.add(item);
    }
  }
  for (let index = 1; index <= options.shards; index++)
    if (!seenShards.has(index)) throw new Error('[static-playground] missing shard index');
  if (cases.size !== expected.size || [...expected].some((item) => !cases.has(item)))
    throw new Error('[static-playground] aggregate case coverage is incomplete');
  const result = {
    sourceSha: producer.sourceSha,
    artifactDigest: producer.artifactDigest,
    cases: cases.size,
    shards: options.shards,
  };
  await mkdir(resolve(options.output, '..'), { recursive: true });
  await Bun.write(options.output, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}
