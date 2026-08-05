import {
  normalizeGitHeaderPaths,
  parsePatchPath,
} from './source-diff-viewer.path-normalization.ts';
import type { SourceDiffFile } from './source-diff-viewer.types.ts';

export function parseBinaryNoticePaths(
  file: SourceDiffFile,
  rawLine: string,
): Pick<SourceDiffFile, 'oldPath' | 'newPath'> | null {
  const payload = rawLine.match(/^Binary files (.+) differ$/)?.[1];
  if (!payload) return null;

  const candidates: (Pick<SourceDiffFile, 'oldPath' | 'newPath'> & {
    hasKnownEndpoints: boolean;
  })[] = [];
  let delimiterIndex = payload.indexOf(' and ');
  while (delimiterIndex !== -1) {
    const rawOldPath = payload.slice(0, delimiterIndex);
    const rawNewPath = payload.slice(delimiterIndex + ' and '.length);
    const oldPath = parsePatchPath(rawOldPath, {
      stripSyntheticPrefix: true,
    });
    const newPath = parsePatchPath(rawNewPath, {
      stripSyntheticPrefix: true,
    });
    const normalizedPaths = normalizeGitHeaderPaths(oldPath, newPath);
    const normalizedOldPath =
      normalizedPaths.oldPath !== null &&
      file.oldPath !== null &&
      normalizedPaths.oldPath.endsWith(`/${file.oldPath}`)
        ? file.oldPath
        : normalizedPaths.oldPath;
    const normalizedNewPath =
      normalizedPaths.newPath !== null &&
      file.newPath !== null &&
      normalizedPaths.newPath.endsWith(`/${file.newPath}`)
        ? file.newPath
        : normalizedPaths.newPath;
    candidates.push({
      oldPath: normalizedOldPath,
      newPath: normalizedNewPath,
      hasKnownEndpoints:
        (rawOldPath.startsWith('a/') || rawOldPath === '/dev/null') &&
        (rawNewPath.startsWith('b/') || rawNewPath === '/dev/null'),
    });
    delimiterIndex = payload.indexOf(' and ', delimiterIndex + 1);
  }

  const preferredCandidates = candidates.some((candidate) => candidate.hasKnownEndpoints)
    ? candidates.filter((candidate) => candidate.hasKnownEndpoints)
    : candidates;

  if (preferredCandidates.length === 1) return preferredCandidates[0] ?? null;

  return (
    preferredCandidates.find(
      (candidate) => candidate.oldPath === file.oldPath && candidate.newPath === file.newPath,
    ) ?? null
  );
}

export function applyFileMetadata(file: SourceDiffFile, rawLine: string): void {
  const binaryPaths = parseBinaryNoticePaths(file, rawLine);
  if (binaryPaths) {
    file.oldPath = binaryPaths.oldPath;
    file.newPath = binaryPaths.newPath;
    return;
  }

  if (rawLine.startsWith('new file mode ')) {
    file.oldPath = null;
    return;
  }

  if (rawLine.startsWith('deleted file mode ')) {
    file.newPath = null;
    return;
  }

  if (rawLine.startsWith('rename from ')) {
    file.oldPath = parsePatchPath(rawLine.slice('rename from '.length), {
      stripSyntheticPrefix: false,
    });
    return;
  }

  if (rawLine.startsWith('rename to ')) {
    file.newPath = parsePatchPath(rawLine.slice('rename to '.length), {
      stripSyntheticPrefix: false,
    });
    return;
  }

  if (rawLine.startsWith('copy from ')) {
    file.oldPath = parsePatchPath(rawLine.slice('copy from '.length), {
      stripSyntheticPrefix: false,
    });
    return;
  }

  if (rawLine.startsWith('copy to ')) {
    file.newPath = parsePatchPath(rawLine.slice('copy to '.length), {
      stripSyntheticPrefix: false,
    });
  }
}

export function isGitBinaryNoticeMetadata(file: SourceDiffFile, rawLine: string): boolean {
  if (/^Binary files (?:a\/|\/dev\/null).+ and (?:b\/|\/dev\/null).+ differ$/.test(rawLine)) {
    return true;
  }

  const binaryPaths = parseBinaryNoticePaths(file, rawLine);
  return binaryPaths?.oldPath === file.oldPath && binaryPaths.newPath === file.newPath;
}
