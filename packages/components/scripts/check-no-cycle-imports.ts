/**
 * Cycle-prevention guard for the four `@cinder/*` workspace packages
 * (`markdown`, `editor`, `commentary`, `diff`).
 *
 * The `cinder` package re-exports each upstream package's public surface
 * under `cinder/<pkg>/<subpath>`. If any of the four upstream packages were
 * to import `cinder` or `cinder/<subpath>`, that would create a runtime
 * resolution cycle (`cinder` → `@cinder/<pkg>` → `cinder`), a type-emission
 * cycle (the published `.d.ts` would reference an unresolved `cinder`), and
 * an init-order hazard.
 *
 * This script walks `packages/{markdown,editor,commentary,diff}/src/**` and
 * fails on any source file that imports `cinder` or `cinder/...`. Run as
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

/** Workspace packages whose `src/` must never import `cinder` or `cinder/*`. */
const RESTRICTED_PACKAGES = ['markdown', 'editor', 'commentary', 'diff'] as const;

/**
 * Matches `from 'cinder'` and `from 'cinder/...'` (single or double quoted),
 * dynamic `import('cinder')` calls, and bare-side-effect `import 'cinder'`.
 * Deliberately does NOT match `@cinder/*` — those are the upstream packages
 * importing each other, which is allowed.
 */
const FORBIDDEN_IMPORT_PATTERN = /(?:from\s*|import\s*\(\s*|import\s+)(['"])cinder(?:\/[^'"]*)?\1/g;

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
        'no `cinder`/`cinder/*` imports).\n',
    );
    return;
  }

  process.stderr.write(
    'check-no-cycle-imports — forbidden imports detected.\n' +
      'The four upstream `@cinder/*` packages must NEVER import `cinder` or `cinder/*` — ' +
      'doing so creates a resolution cycle (cinder → @cinder/<pkg> → cinder). ' +
      'Use a relative path or `@cinder/<other>` instead.\n\n',
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
