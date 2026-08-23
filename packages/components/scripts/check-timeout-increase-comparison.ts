import { basename, extname } from 'node:path';

import type {
  DiffHunk,
  ThresholdCandidate,
  TimeoutIncreaseViolation,
} from './check-timeout-increase-types';

const POLICY_MESSAGE =
  'Pull request policy: timeout, retry, wait, and slow() threshold increases hide real slowness or races. Revert the threshold increase and fix the underlying failure in source or test code.';

const SUPPORTED_EXTENSIONS = new Set([
  '.bash',
  '.cjs',
  '.js',
  '.jsx',
  '.json',
  '.mjs',
  '.sh',
  '.svelte',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
  '.zsh',
]);

const LOCKFILE_NAMES = new Set([
  'bun.lock',
  'bun.lockb',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);

type CandidateEntry = { candidate: ThresholdCandidate; hunk: DiffHunk };

function callsiteFingerprint(candidate: ThresholdCandidate): string {
  return candidate.line
    .replace(candidate.label, '<threshold-name>')
    .replace(candidate.renderedValue, '<threshold>')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function isSupportedFile(filePath: string): boolean {
  if (LOCKFILE_NAMES.has(basename(filePath))) return false;
  return SUPPORTED_EXTENSIONS.has(extname(filePath));
}

export function parseHunkStart(header: string): { oldLine: number; newLine: number } {
  const match = /^@@ -(?<oldLine>\d+)(?:,\d+)? \+(?<newLine>\d+)(?:,\d+)? @@/u.exec(header);
  if (match?.groups === undefined) {
    return { oldLine: 0, newLine: 0 };
  }
  return {
    oldLine: Number(match.groups['oldLine']),
    newLine: Number(match.groups['newLine']),
  };
}

export function collectComparableViolations(
  hunks: readonly DiffHunk[],
): TimeoutIncreaseViolation[] {
  const violations: TimeoutIncreaseViolation[] = [];
  const removedEntries = hunks.flatMap((hunk) =>
    hunk.removed.map((candidate) => ({ candidate, hunk })),
  );
  const addedEntries = hunks.flatMap((hunk) =>
    hunk.added.map((candidate) => ({ candidate, hunk })),
  );
  const consumedRemoved = new Set<ThresholdCandidate>();
  const consumedAdded = new Set<ThresholdCandidate>();
  const candidateOrder = new Map<ThresholdCandidate, number>();
  let nextCandidateOrder = 0;
  for (const hunk of hunks) {
    for (const candidate of hunk.added) {
      candidateOrder.set(candidate, nextCandidateOrder);
      nextCandidateOrder += 1;
    }
  }
  const pairEntries = (removed: CandidateEntry[], added: CandidateEntry[]): void => {
    const availableRemoved = removed.filter(({ candidate }) => !consumedRemoved.has(candidate));
    const availableAdded = added.filter(({ candidate }) => !consumedAdded.has(candidate));

    for (const newEntry of availableAdded) {
      const unchangedIndex = availableRemoved.findIndex(
        ({ candidate }) =>
          !consumedRemoved.has(candidate) &&
          candidate.effectiveValue === newEntry.candidate.effectiveValue,
      );
      if (unchangedIndex === -1) continue;
      const oldEntry = availableRemoved[unchangedIndex];
      if (oldEntry === undefined) continue;
      consumedRemoved.add(oldEntry.candidate);
      consumedAdded.add(newEntry.candidate);
    }

    const remainingRemoved = availableRemoved
      .filter(({ candidate }) => !consumedRemoved.has(candidate))
      .sort((left, right) => left.candidate.effectiveValue - right.candidate.effectiveValue);
    const remainingAdded = availableAdded
      .filter(({ candidate }) => !consumedAdded.has(candidate))
      .sort((left, right) => left.candidate.effectiveValue - right.candidate.effectiveValue);
    const pairCount = Math.min(remainingRemoved.length, remainingAdded.length);
    const removedStart =
      remainingRemoved.length > remainingAdded.length ? 0 : remainingRemoved.length - pairCount;
    const addedStart =
      remainingAdded.length > remainingRemoved.length ? remainingAdded.length - pairCount : 0;

    for (let index = 0; index < pairCount; index += 1) {
      const oldEntry = remainingRemoved[removedStart + index];
      const newEntry = remainingAdded[addedStart + index];
      if (oldEntry === undefined || newEntry === undefined) continue;
      consumedRemoved.add(oldEntry.candidate);
      consumedAdded.add(newEntry.candidate);
      if (newEntry.candidate.effectiveValue > oldEntry.candidate.effectiveValue) {
        violations.push({
          filePath: newEntry.hunk.filePath,
          hunkHeader: newEntry.hunk.hunkHeader,
          old: oldEntry.candidate,
          new: newEntry.candidate,
        });
      }
    }
  };

  const pairByKey = (
    removed: CandidateEntry[],
    added: CandidateEntry[],
    keyFor: (entry: CandidateEntry) => string,
  ): void => {
    const keys = new Set([...removed.map(keyFor), ...added.map(keyFor)]);
    for (const key of keys) {
      pairEntries(
        removed.filter((entry) => keyFor(entry) === key),
        added.filter((entry) => keyFor(entry) === key),
      );
    }
  };

  for (const hunk of hunks) {
    const removed = removedEntries.filter((entry) => entry.hunk === hunk);
    const added = addedEntries.filter((entry) => entry.hunk === hunk);
    pairByKey(removed, added, ({ candidate }) => candidate.identity);
    pairByKey(
      removed,
      added,
      ({ candidate }) => `${candidate.kind}:${callsiteFingerprint(candidate)}`,
    );
  }
  pairByKey(
    removedEntries,
    addedEntries,
    ({ candidate, hunk }) =>
      `${candidate.identity}:${callsiteFingerprint(candidate)}:${candidate.identity.includes(':') ? '' : hunk.filePath}`,
  );

  for (const { candidate: newCandidate, hunk } of addedEntries) {
    if (consumedAdded.has(newCandidate)) continue;
    if (
      newCandidate.baselineValue === undefined ||
      newCandidate.baselineRenderedValue === undefined ||
      newCandidate.effectiveValue <= newCandidate.baselineValue
    ) {
      continue;
    }
    violations.push({
      filePath: hunk.filePath,
      hunkHeader: hunk.hunkHeader,
      old: {
        ...newCandidate,
        effectiveValue: newCandidate.baselineValue,
        value: newCandidate.baselineValue,
        renderedValue: newCandidate.baselineRenderedValue,
        line:
          newCandidate.kind === 'retries'
            ? 'test runs with the default retry count (no retries setting)'
            : newCandidate.kind === 'slow'
              ? 'test runs with the normal timeout (no test.slow())'
              : 'test runs with the implicit bounded framework timeout',
      },
      new: newCandidate,
    });
  }

  return violations.sort(
    (left, right) =>
      (candidateOrder.get(left.new) ?? Number.MAX_SAFE_INTEGER) -
      (candidateOrder.get(right.new) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function formatTimeoutIncreaseViolations(
  violations: readonly TimeoutIncreaseViolation[],
): string {
  if (violations.length === 0) return 'check-timeout-increases — OK\n';
  const lines = [
    'check-timeout-increases — timeout/retry threshold increase(s) detected.',
    POLICY_MESSAGE,
    '',
  ];
  for (const violation of violations) {
    lines.push(
      `${violation.filePath} ${violation.hunkHeader}`,
      `  old line ${violation.old.lineNumber}: ${violation.old.line}`,
      `  new line ${violation.new.lineNumber}: ${violation.new.line}`,
      `  ${violation.old.label} ${violation.old.renderedValue} -> ${violation.new.label} ${violation.new.renderedValue}`,
      '',
    );
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export async function readDiffInput(): Promise<string> {
  const standardInput = await Bun.stdin.text();
  if (standardInput.trim().length > 0) return standardInput;

  const baseRef = Bun.env['BASE_REF'] ?? Bun.env['GITHUB_BASE_REF'];
  if (baseRef === undefined || baseRef.trim().length === 0) return standardInput;

  const result = Bun.spawnSync(['git', 'diff', '--unified=100000', `origin/${baseRef}...HEAD`], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `could not read fallback diff against origin/${baseRef}: ${result.stderr.toString().trim()}`,
    );
  }
  return result.stdout.toString();
}
