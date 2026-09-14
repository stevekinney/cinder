import { execFileSync, spawnSync } from 'node:child_process';

export type ReleaseProvenance = {
  gitHead?: string;
  reason?: string;
  sourceHead?: string;
};

const shaPattern = /^[0-9a-f]{40}$/u;

function git(arguments_: readonly string[], cwd: string): string | undefined {
  try {
    const output = execFileSync('git', arguments_, { cwd, encoding: 'utf8' }).trim();
    return output.length > 0 ? output : undefined;
  } catch {
    return undefined;
  }
}

export function resolveReleaseProvenance(
  cwd: string,
  environment: Record<string, string | undefined> = process.env,
): ReleaseProvenance {
  const sourceHead = git(['rev-parse', '--verify', 'HEAD^{commit}'], cwd);
  if (!sourceHead || !shaPattern.test(sourceHead)) {
    return {
      reason: 'git HEAD is unavailable or is not a 40-character SHA',
      ...(sourceHead === undefined ? {} : { sourceHead }),
    };
  }

  const workflowHead = environment['GITHUB_SHA'];
  if (
    workflowHead !== undefined &&
    (!shaPattern.test(workflowHead) || workflowHead !== sourceHead)
  ) {
    return { reason: 'GITHUB_SHA does not match the checked-out git HEAD', sourceHead };
  }

  let status: string | undefined;
  try {
    status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd,
      encoding: 'utf8',
    });
  } catch {
    return { reason: 'git status is unavailable', sourceHead };
  }
  if (status.trim().length > 0) {
    return { reason: 'the checkout has tracked or untracked changes', sourceHead };
  }

  return { gitHead: sourceHead, sourceHead };
}

export function resolvePackProvenance(cwd: string): ReleaseProvenance {
  const provenance = resolveReleaseProvenance(cwd);
  if (provenance.gitHead === undefined) {
    process.stderr.write(
      `pack-for-publish — gitHead omitted: ${provenance.reason ?? 'provenance unavailable'}\n`,
    );
  }
  return provenance;
}

type PublishedManifest<T> = {
  [Key in keyof T as Key extends 'gitHead' ? never : Key]: T[Key];
} & { gitHead?: string };

export function withReleaseProvenance<T extends { gitHead?: string }>(
  manifest: T,
  provenance: ReleaseProvenance,
): PublishedManifest<T> {
  const published = { ...manifest };
  delete published.gitHead;
  if (provenance.gitHead !== undefined) published.gitHead = provenance.gitHead;
  return published;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertReleaseProvenance(
  cwd: string,
  manifest: { name: string; version: string },
  tarballManifest: unknown,
  environment: Record<string, string | undefined> = process.env,
): void {
  const provenance = resolveReleaseProvenance(cwd, environment);
  if (provenance.gitHead === undefined) {
    throw new Error(`release provenance unavailable: ${provenance.reason ?? 'unknown reason'}`);
  }
  if (!isRecord(tarballManifest)) {
    throw new Error('release artifact package.json is not an object');
  }
  const candidate = tarballManifest;
  if (candidate['name'] !== manifest.name || candidate['version'] !== manifest.version) {
    throw new Error('release artifact package.json identity does not match the source manifest');
  }
  if (candidate['gitHead'] !== provenance.gitHead || typeof candidate['gitHead'] !== 'string') {
    throw new Error(
      'release artifact package.json gitHead does not match the checked-out git HEAD',
    );
  }
}

export function readTarballManifest(tarballPath: string): unknown {
  const result = spawnSync('tar', ['-xOf', tarballPath, 'package/package.json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    throw new Error('cannot read package.json from release artifact: could not start tar', {
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || `tar exited with ${result.signal ?? result.status}`;
    throw new Error(`cannot read package.json from release artifact: ${detail}`);
  }
  if (typeof result.stdout !== 'string')
    throw new Error('cannot read package.json from release artifact: tar returned no output');
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error('release artifact package.json is not valid JSON');
  }
}
