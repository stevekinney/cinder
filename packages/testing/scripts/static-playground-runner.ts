import { spawn } from 'node:child_process';
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join, resolve as resolvePath } from 'node:path';
import {
  cleanupManagedChildren,
  installSignalCleanupHandlers,
  manageChildProcess,
  waitForExit,
} from './process-lifecycle.ts';
import {
  expectedCases,
  parseExpectedReport,
  readShardEvidence,
  validatedShardCases,
  type ShardIdentity,
} from './static-playground-evidence.ts';
import { startStaticServer, type StaticVercelConfig } from './static-playground-server.ts';

export function playwrightArguments(shard: ShardIdentity): string[] {
  return [
    'x',
    '--no-install',
    'playwright',
    'test',
    '-c',
    'playwright-static.config.ts',
    ...(shard.total > 1 ? [`--shard=${shard.index}/${shard.total}`] : []),
  ];
}

export async function runStaticPlaywright(
  directory: string,
  reportPath: string,
  config: StaticVercelConfig,
  shard: ShardIdentity = { index: 1, total: 1 },
  evidenceDirectory?: string,
): Promise<number> {
  const evidenceRoot = resolvePath(
    evidenceDirectory ??
      join(
        resolvePath(import.meta.dirname),
        '..',
        `test-results/playground-production-evidence-${process.pid}`,
      ),
  );
  const evidenceWasProvided = evidenceDirectory !== undefined;
  const evidencePath = evidenceRoot;
  {
    const existing = await readdir(evidencePath).catch(() => [] as string[]);
    if (existing.length > 0)
      throw new Error('[static-playground] evidence directory must be fresh and empty');
    await mkdir(join(evidencePath, 'failures'), { recursive: true });
    await mkdir(join(evidencePath, 'blob'), { recursive: true });
  }
  const server = await startStaticServer(directory, config);
  const jsonPath = join(evidencePath, 'playwright.json');
  const legacyJsonPath = join(
    resolvePath(import.meta.dirname),
    '..',
    'test-results/playground-production.json',
  );
  const blobPath = join(evidencePath, 'blob', 'report.zip');
  const child = spawn(process.env['BUN_BIN'] ?? 'bun', playwrightArguments(shard), {
    cwd: resolvePath(import.meta.dirname, '..'),
    env: {
      ...process.env,
      PLAYGROUND_STATIC_BASE_URL: server.origin,
      PLAYGROUND_STATIC_REPORT: reportPath,
      PLAYWRIGHT_JSON_OUTPUT_FILE: jsonPath,
      PLAYWRIGHT_BLOB_OUTPUT_FILE: blobPath,
      PLAYWRIGHT_TEST_OUTPUT_DIR: join(evidencePath, 'failures'),
    },
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  });
  const managed = manageChildProcess(child, 'static-playwright', process.platform !== 'win32');
  let cleanupPromise: Promise<void> | undefined;
  const cleanup = (): Promise<void> => {
    cleanupPromise ??= cleanupManagedChildren([managed], null).then(() => server.close());
    return cleanupPromise;
  };
  installSignalCleanupHandlers(cleanup);
  try {
    const exitCode = await waitForExit(child);
    const report = await Bun.file(jsonPath)
      .json()
      .catch(() => undefined);
    const blobExists = await stat(blobPath)
      .then((value) => value.isFile())
      .catch(() => false);
    const effectiveExitCode = report !== undefined && blobExists ? exitCode : 1;
    if (report !== undefined && blobExists) {
      if (!evidenceWasProvided) await copyFile(jsonPath, legacyJsonPath);
      const producer = parseExpectedReport(await Bun.file(reportPath).json());
      await Bun.write(
        join(evidencePath, 'manifest.json'),
        `${JSON.stringify(
          {
            schemaVersion: 1,
            sourceSha: producer.sourceSha,
            artifactDigest: producer.artifactDigest,
            shard,
            exitCode,
            inventory: [...expectedCases(producer.routes)].sort(),
          },
          null,
          2,
        )}\n`,
      );
      validatedShardCases(await readShardEvidence(evidencePath), producer);
    }
    if (effectiveExitCode !== 0)
      console.error('[static-playground] Playwright evidence is incomplete or failed');
    return effectiveExitCode;
  } finally {
    await cleanup();
  }
}
