import { isAbsolute, join, relative as relativePath } from 'node:path';

/**
 * Resolve `requestedPath` against `baseDir`, rejecting anything that would
 * lexically escape it: any `.` or `..` path *segment* (not merely a `..`
 * substring, which would also reject harmless filenames like `foo..css`), a
 * leading or embedded empty segment (e.g. a leading `/` or a doubled `//`),
 * or — as defense-in-depth — a `join()`-then-`relative()` round-trip that
 * lands outside `baseDir`. Segments are split on both `/` and `\`: `join()`
 * is platform-specific (win32 treats `\` as a separator; POSIX doesn't), so
 * splitting on `/` alone would let a backslash-disguised `..` segment (e.g.
 * `foo/..\..\secret.css`) slip past this check on POSIX while still
 * escaping `baseDir` if the same code ran on win32. Returns the absolute
 * path, or `null` when the request is unsafe.
 *
 * This is a LEXICAL containment check only — it operates on path strings and
 * does not call `fs.realpath`/`fs.lstat`. It does not detect a symlink
 * located inside `baseDir` whose target resolves outside `baseDir`; such a
 * symlink would pass this check and the subsequent `Bun.file().exists()`
 * read would follow it. As of this issue, none of the three roots this
 * function guards (`STYLES_ROOT` under `packages/components/src/styles`, the
 * components-barrel CSS root, and each `componentSource.componentsRoot` in
 * `component-sources.ts`, which point directly at `packages/<name>/src/...` —
 * not through `node_modules`) contain any symlinks (verified with `find
 * packages/playground/src packages/components/src -type l`), so this gap is
 * not currently exploitable through these three call sites. If a future
 * caller serves a directory that may contain symlinks (e.g. anything
 * traversing through `node_modules`), it must add an `fs.realpathSync`
 * check on the resolved path before serving the file — this function alone
 * is not sufficient for that case.
 */
export function resolveSafePath(baseDir: string, requestedPath: string): string | null {
  const segments = requestedPath.split(/[/\\]/);
  const hasUnsafeSegment = segments.some(
    (segment) => segment === '' || segment === '.' || segment === '..',
  );
  if (hasUnsafeSegment) return null;

  const resolved = join(baseDir, requestedPath);
  const relativeToBase = relativePath(baseDir, resolved);
  if (relativeToBase.startsWith('..') || isAbsolute(relativeToBase)) return null;
  return resolved;
}
