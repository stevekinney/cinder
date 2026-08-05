import {
  normalizeGitHeaderPaths,
  parsePatchPath,
} from './source-diff-viewer.path-normalization.ts';
import type { SourceDiffFile } from './source-diff-viewer.types.ts';

export function readQuotedGitToken(
  payload: string,
  startIndex: number,
): { token: string; endIndex: number } | null {
  if (payload[startIndex] !== '"') return null;

  for (let index = startIndex + 1; index < payload.length; index += 1) {
    if (payload[index] === '\\') {
      index += 1;
      continue;
    }

    if (payload[index] === '"') {
      return {
        token: payload.slice(startIndex, index + 1),
        endIndex: index + 1,
      };
    }
  }

  return null;
}

export function parseQuotedDiffGitHeader(
  payload: string,
): Pick<SourceDiffFile, 'oldPath' | 'newPath'> | null {
  const oldToken = readQuotedGitToken(payload, 0);
  if (!oldToken) return null;

  const separator = payload.slice(oldToken.endIndex).match(/^ +/);
  if (!separator) return null;

  const newToken = readQuotedGitToken(payload, oldToken.endIndex + separator[0].length);
  if (!newToken || newToken.endIndex !== payload.length) return null;

  return normalizeGitHeaderPaths(
    parsePatchPath(oldToken.token, { stripSyntheticPrefix: false }),
    parsePatchPath(newToken.token, { stripSyntheticPrefix: false }),
  );
}

export function parseDiffGitHeader(
  line: string,
): Pick<SourceDiffFile, 'oldPath' | 'newPath' | 'header'> {
  const payload = line.slice('diff --git '.length);
  const quotedHeader = parseQuotedDiffGitHeader(payload);
  if (quotedHeader) return { ...quotedHeader, header: line };

  const separatorIndexes = [...payload.matchAll(/ /g)].map((match) => match.index ?? -1);
  for (const separatorIndex of separatorIndexes) {
    if (separatorIndex <= 0) continue;
    const parsedPaths = normalizeGitHeaderPaths(
      parsePatchPath(payload.slice(0, separatorIndex), { stripSyntheticPrefix: false }),
      parsePatchPath(payload.slice(separatorIndex + 1), { stripSyntheticPrefix: false }),
    );
    if (parsedPaths.oldPath && parsedPaths.oldPath === parsedPaths.newPath) {
      return { ...parsedPaths, header: line };
    }
  }

  const separatorIndex = separatorIndexes[separatorIndexes.length - 1] ?? -1;
  if (separatorIndex <= 0) return { oldPath: null, newPath: null, header: line };

  return {
    ...normalizeGitHeaderPaths(
      parsePatchPath(payload.slice(0, separatorIndex), { stripSyntheticPrefix: false }),
      parsePatchPath(payload.slice(separatorIndex + 1), { stripSyntheticPrefix: false }),
    ),
    header: line,
  };
}

export function createParsedGitFile(rawLine: string): SourceDiffFile {
  return {
    ...parseDiffGitHeader(rawLine),
    metadata: [],
    hunks: [],
  };
}
