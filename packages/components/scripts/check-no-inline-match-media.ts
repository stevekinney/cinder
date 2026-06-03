/**
 * Prefers-reduced-motion policy guard.
 *
 * OVERLAY-POLICY (§ Reduced motion) mandates the shared `useReducedMotion()` hook
 * from `utilities/use-reduced-motion.svelte.ts` for all client-side reduced-motion
 * checks. Inline `window.matchMedia('(prefers-reduced-motion…')` calls:
 *   - Are not reactive — a user changing the OS preference mid-session is ignored.
 *   - Duplicate the SSR-guard logic that `useReducedMotion` already handles.
 *   - Scatter the policy across components, making future changes error-prone.
 *
 * This script walks `packages/components/src/components/**` and
 * `packages/components/src/utilities/**` and fails on any `.svelte` or `.ts` file
 * that calls `matchMedia` with the reduced-motion media string directly. The shared
 * utility itself is the single allowed call site.
 *
 * Like `check-no-bare-console-warn.ts`, this uses a grep-based scan because
 * oxlint cannot express this rule for Svelte files (they are in its ignorePatterns).
 * Wired into `bun run lint` (and therefore CI) via `package.json`.
 */

import { Glob } from 'bun';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(scriptDirectory, '..', 'src');

/**
 * Paths (relative to `src/`) permitted to call `matchMedia` with the
 * reduced-motion query directly. The shared utility is the single allowed site.
 */
const ALLOWED_RELATIVE_PATHS = new Set<string>(['utilities/use-reduced-motion.svelte.ts']);

/**
 * Matches `matchMedia(` followed (within a few chars) by `prefers-reduced-motion`.
 * Catches `window.matchMedia(…)`, `globalThis.matchMedia?.('…')`, and similar.
 */
const INLINE_MATCH_MEDIA_PATTERN = /matchMedia\s*\(?\s*['"(].*prefers-reduced-motion/;

type Violation = { filePath: string; lineNumber: number; line: string };

async function scan(): Promise<Violation[]> {
  const violations: Violation[] = [];
  const glob = new Glob('**/*.{svelte,ts}');

  for (const subdir of ['components', 'utilities']) {
    const root = resolve(srcRoot, subdir);
    for await (const relativePath of glob.scan({ cwd: root })) {
      const srcRelative = `${subdir}/${relativePath}`;
      if (ALLOWED_RELATIVE_PATHS.has(srcRelative)) continue;

      const absolutePath = resolve(root, relativePath);
      const source = await Bun.file(absolutePath).text();
      const lines = source.split('\n');

      for (let index = 0; index < lines.length; index++) {
        const line = lines[index]!;
        if (INLINE_MATCH_MEDIA_PATTERN.test(line)) {
          violations.push({
            filePath: relative(resolve(srcRoot, '..', '..', '..'), absolutePath),
            lineNumber: index + 1,
            line: line.trim(),
          });
        }
      }
    }
  }

  return violations;
}

async function main(): Promise<void> {
  const violations = await scan();
  if (violations.length === 0) {
    process.stdout.write(
      'check-no-inline-match-media — OK (reduced-motion checks use the shared useReducedMotion() hook).\n',
    );
    return;
  }

  process.stderr.write(
    'check-no-inline-match-media — inline matchMedia(prefers-reduced-motion…) detected.\n' +
      'Use `useReducedMotion()` from `utilities/use-reduced-motion.svelte.ts` instead of\n' +
      'calling matchMedia directly. The hook is reactive, SSR-safe, and the single canonical\n' +
      'source for this preference per OVERLAY-POLICY.md § Reduced motion.\n\n',
  );
  for (const violation of violations) {
    process.stderr.write(
      `  ${violation.filePath}:${violation.lineNumber}\n    ${violation.line}\n`,
    );
  }
  process.exit(1);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('check-no-inline-match-media failed:', error);
    process.exit(1);
  });
}
