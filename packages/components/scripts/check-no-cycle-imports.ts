/**
 * Cycle-prevention guard for the upstream workspace packages
 * (`markdown`, `commentary`).
 *
 * The `@lostgradient/cinder` package re-exports each upstream package's public surface
 * under `@lostgradient/cinder/<pkg>/<subpath>`. If either upstream package were
 * to import `@lostgradient/cinder` or `@lostgradient/cinder/<subpath>`, that would create a runtime
 * resolution cycle (`@lostgradient/cinder` → `@lostgradient/markdown` or `@cinder/commentary` → `@lostgradient/cinder`), a type-emission
 * cycle (the published `.d.ts` would reference an unresolved `@lostgradient/cinder`), and
 * an init-order hazard.
 *
 * This script walks `packages/{markdown,commentary}/src/**` and
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
const RESTRICTED_PACKAGES = ['markdown', 'commentary'] as const;

/**
 * Matches `from '@lostgradient/cinder'` and `from '@lostgradient/cinder/...'` (single or double quoted),
 * dynamic `import('@lostgradient/cinder')` calls, and bare-side-effect `import '@lostgradient/cinder'`.
 * Deliberately does NOT match the upstream packages themselves
 * (`@lostgradient/markdown`, `@cinder/commentary`) — those importing each
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

async function scanPackage(packageName: string): Promise<Violation[]> {
  const sourceRoot = join(workspaceRoot, 'packages', packageName, 'src');
  const violations: Violation[] = [];
  const glob = new Glob('**/*.{ts,tsx,svelte,mts,cts}');
  for await (const relative of glob.scan({ cwd: sourceRoot })) {
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
      'Use a relative path or a sibling upstream package (`@lostgradient/markdown`, `@cinder/commentary`) instead.\n\n',
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
