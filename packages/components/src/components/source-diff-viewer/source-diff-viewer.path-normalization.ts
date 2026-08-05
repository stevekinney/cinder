import type { SourceDiffFile } from './source-diff-viewer.types.ts';

const TEXT_ENCODER = new TextEncoder();

export function stripSyntheticDiffPrefix(path: string): string {
  return path.replace(/^[ab]\//, '');
}

export function stripLeadingPathSegmentPrefix(path: string): string {
  return path.replace(/^[^/]+\//, '');
}

export function sharedPathSegmentSuffixSegments(firstPath: string, secondPath: string): string[] {
  const firstSegments = firstPath.split('/');
  const secondSegments = secondPath.split('/');
  const sharedSegments: string[] = [];

  while (firstSegments.length > 0 && secondSegments.length > 0) {
    const firstSegment = firstSegments.pop();
    const secondSegment = secondSegments.pop();
    if (firstSegment !== secondSegment || firstSegment === undefined) break;
    sharedSegments.unshift(firstSegment);
  }

  return sharedSegments;
}

export function sharedPathSegmentSuffix(firstPath: string, secondPath: string): string | null {
  const sharedSegments = sharedPathSegmentSuffixSegments(firstPath, secondPath);
  return sharedSegments.length > 0 ? sharedSegments.join('/') : null;
}

export function decodeGitQuotedPath(path: string): string {
  if (!path.startsWith('"') || !path.endsWith('"')) return path;

  const bytes: number[] = [];
  const quoted = path.slice(1, -1);
  for (let index = 0; index < quoted.length; index += 1) {
    const character = quoted[index];
    if (character !== '\\') {
      const codePoint = quoted.codePointAt(index);
      if (codePoint !== undefined) {
        bytes.push(...TEXT_ENCODER.encode(String.fromCodePoint(codePoint)));
        if (codePoint > 0xffff) index += 1;
      }
      continue;
    }

    const next = quoted[index + 1];
    if (next && /[0-7]/.test(next)) {
      const octal = quoted.slice(index + 1).match(/^[0-7]{1,3}/)?.[0] ?? '';
      bytes.push(Number.parseInt(octal, 8));
      index += octal.length;
      continue;
    }

    const escapes: Record<string, number> = {
      '"': 0x22,
      '\\': 0x5c,
      a: 0x07,
      b: 0x08,
      f: 0x0c,
      n: 0x0a,
      r: 0x0d,
      t: 0x09,
      v: 0x0b,
    };
    bytes.push(next ? (escapes[next] ?? next.charCodeAt(0)) : 0x5c);
    if (next) index += 1;
  }

  return new TextDecoder().decode(new Uint8Array(bytes));
}

export function parsePatchPath(
  path: string,
  options: { stripSyntheticPrefix: boolean },
): string | null {
  const [pathWithoutTimestamp = path] = path.split('\t');
  const trimmedPath = decodeGitQuotedPath(pathWithoutTimestamp);
  const normalized = options.stripSyntheticPrefix
    ? stripSyntheticDiffPrefix(trimmedPath)
    : trimmedPath;
  return normalized === '/dev/null' ? null : normalized;
}

export function normalizeGitHeaderPaths(
  oldPath: string | null,
  newPath: string | null,
): Pick<SourceDiffFile, 'oldPath' | 'newPath'> {
  if (!oldPath || !newPath) return { oldPath, newPath };
  if (oldPath === newPath) return { oldPath, newPath };

  const oldSegments = oldPath.split('/');
  const newSegments = newPath.split('/');
  const sharedSegments = sharedPathSegmentSuffixSegments(oldPath, newPath);
  const [oldPrefix] = oldSegments;
  const [newPrefix] = newSegments;
  if (oldPrefix === 'a' && newPrefix === 'b') {
    return {
      oldPath: stripSyntheticDiffPrefix(oldPath),
      newPath: stripSyntheticDiffPrefix(newPath),
    };
  }

  if (oldPrefix === 'old' && newPrefix === 'new') {
    if (
      sharedSegments.length >= 2 &&
      oldSegments.length === sharedSegments.length + 1 &&
      newSegments.length === sharedSegments.length + 1
    ) {
      const sharedSuffix = sharedPathSegmentSuffix(oldPath, newPath);
      return { oldPath: sharedSuffix, newPath: sharedSuffix };
    }

    return {
      oldPath: stripLeadingPathSegmentPrefix(oldPath),
      newPath: stripLeadingPathSegmentPrefix(newPath),
    };
  }

  return { oldPath, newPath };
}

export function parseGitFileSidePath(
  file: SourceDiffFile,
  rawPath: string,
  currentPath: string | null,
): string | null {
  const parsedPath = parsePatchPath(rawPath, { stripSyntheticPrefix: false });
  if (!parsedPath || !file.header?.startsWith('diff --git ')) return parsedPath;
  if (currentPath && parsedPath === currentPath) return currentPath;
  const [prefix] = parsedPath.split('/');
  const hasKnownDiffPrefix =
    prefix === 'a' || prefix === 'b' || prefix === 'old' || prefix === 'new';
  if (prefix === 'a' || prefix === 'b') return stripSyntheticDiffPrefix(parsedPath);
  if (currentPath && hasKnownDiffPrefix && parsedPath.endsWith(`/${currentPath}`)) {
    return currentPath;
  }

  const pathWithoutPrefix = stripLeadingPathSegmentPrefix(parsedPath);
  return currentPath && hasKnownDiffPrefix && pathWithoutPrefix === currentPath
    ? currentPath
    : parsedPath;
}
