/**
 * Cycle-prevention guard for the upstream workspace packages
 * (`markdown`, `editor`).
 *
 * `@lostgradient/cinder` depends directly on `@lostgradient/markdown` (see
 * `src/utilities/change-tracker.svelte.ts` and
 * `src/components/json-schema-editor/diff-view.svelte`) — if markdown's own
 * source ever imported `@lostgradient/cinder` or `@lostgradient/cinder/<subpath>`,
 * that would create a real runtime resolution cycle (`cinder → markdown →
 * cinder`), a type-emission cycle (the published `.d.ts` would reference an
 * unresolved `@lostgradient/cinder`), and an init-order hazard.
 *
 * Cinder no longer depends on `@lostgradient/editor` at all (Phase 5 of
 * `docs/decisions/package-boundaries.md` deleted cinder's upstream re-export
 * shims), so editor importing cinder would not create a resolution cycle
 * today — but editor's headless runtime still has no business depending on
 * cinder's component surface (only its Svelte component layer legitimately
 * does, as an ordinary downstream consumer — see `UNRESTRICTED_SUBTREES`
 * below), so the guard stays in place defensively.
 *
 * This script walks `packages/{markdown,editor}/src/**` and
 * fails on any source file that imports `@lostgradient/cinder` or `@lostgradient/cinder/...`. Run as
 * part of `bun run validate` (and CI) so violations fail loudly on the
 * branch that introduced them.
 *
 * oxlint cannot express this rule (no per-glob `no-restricted-imports`
 * scoping in our config), and adding an ESLint dependency just for this one
 * rule would inflate the toolchain. A scanned grep with an explicit allow-list
 * is the simplest durable enforcement.
 */

import { Glob } from 'bun';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDirectory, '..', '..', '..');

/** Workspace packages whose `src/` must never import `@lostgradient/cinder` or `@lostgradient/cinder/*`. */
const RESTRICTED_PACKAGES = ['markdown', 'editor'] as const;

/**
 * Per-package glob prefixes excluded from the restriction, relative to that
 * package's `src/`. `editor`'s Svelte components (`markdown-editor`,
 * `review-editor`, `diff-viewer`) are a normal downstream consumer of
 * cinder's published primitives, exactly like `@lostgradient/chat` — they
 * legitimately import `@lostgradient/cinder/<component>`, so that subtree is
 * exempt. Cinder no longer re-exports any of editor's headless runtime (see
 * the module doc above), so this exemption is the only carve-out needed.
 */
const UNRESTRICTED_SUBTREES: Readonly<
  Partial<Record<(typeof RESTRICTED_PACKAGES)[number], string>>
> = {
  editor: 'lib/components/',
};

/**
 * Matches `from '@lostgradient/cinder'` and `from '@lostgradient/cinder/...'` (single or double quoted),
 * dynamic `import('@lostgradient/cinder')` calls, and bare-side-effect `import '@lostgradient/cinder'`.
 * Deliberately does NOT match the upstream packages themselves
 * (`@lostgradient/markdown`, `@lostgradient/editor`) — those importing each
 * other is allowed.
 */
const FORBIDDEN_IMPORT_PATTERN =
  /(?:from\s*|import\s*\(\s*|import\s+)(['"])@lostgradient\/cinder(?:\/[^'"]*)?\1/g;

type Violation = {
  filePath: string;
  lineNumber: number;
  line: string;
  matched: string;
};

async function scanPackage(
  packageName: (typeof RESTRICTED_PACKAGES)[number],
): Promise<Violation[]> {
  const sourceRoot = join(workspaceRoot, 'packages', packageName, 'src');
  const unrestrictedPrefix = UNRESTRICTED_SUBTREES[packageName];
  const violations: Violation[] = [];
  const glob = new Glob('**/*.{ts,tsx,svelte,mts,cts}');
  for await (const relative of glob.scan({ cwd: sourceRoot })) {
    if (unrestrictedPrefix !== undefined && relative.startsWith(unrestrictedPrefix)) continue;
    const filePath = join(sourceRoot, relative);
    const content = await Bun.file(filePath).text();
    const lines = content.split('\n');
    for (const [index, line] of lines.entries()) {
      FORBIDDEN_IMPORT_PATTERN.lastIndex = 0;
      const match = FORBIDDEN_IMPORT_PATTERN.exec(line);
      if (match !== null) {
        violations.push({
          filePath,
          lineNumber: index + 1,
          line: line.trim(),
          matched: match[0],
        });
      }
    }
  }
  return violations;
}

async function main(): Promise<void> {
  const allViolations: Violation[] = [];
  for (const packageName of RESTRICTED_PACKAGES) {
    allViolations.push(...(await scanPackage(packageName)));
  }

  if (allViolations.length === 0) {
    process.stdout.write(
      `check-no-cycle-imports — OK (${RESTRICTED_PACKAGES.length} upstream packages, ` +
        'no `@lostgradient/cinder`/`@lostgradient/cinder/*` imports).\n',
    );
    return;
  }

  process.stderr.write(
    'check-no-cycle-imports — forbidden imports detected.\n' +
      'The upstream workspace packages must NEVER import `@lostgradient/cinder` or `@lostgradient/cinder/*` — ' +
      'doing so creates a resolution cycle (cinder → upstream package → cinder). ' +
      'Use a relative path or a sibling upstream package (`@lostgradient/markdown`, `@lostgradient/editor`) instead.\n\n',
  );
  for (const violation of allViolations) {
    process.stderr.write(
      `  ${violation.filePath}:${violation.lineNumber}\n    ${violation.line}\n`,
    );
  }
  process.exit(1);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('check-no-cycle-imports failed:', error);
    process.exit(1);
  });
}
