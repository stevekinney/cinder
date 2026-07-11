import { describe, expect, it } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  BUILDABLE_PACKAGES_IN_DEPENDENCY_ORDER,
  phaseMaxConcurrency,
  prePushPackageScript,
  REPO_ROOT,
  type GateScript,
} from './utilities.ts';

/**
 * Pins the shape of the validation pipeline described in
 * `docs/validation-topology.md`: pre-commit stays cheap (lockfile + lint-staged
 * + typecheck only), pre-push runs a parallel, scoped lint/typecheck/test, and
 * the package-level scripts compose the way both hooks assume. Every assertion
 * below explains, in its failure message, WHY the invariant exists — so a
 * change that regresses the topology fails loudly instead of quietly
 * reintroducing a fixed problem (slow commits, a serialized test phase, a
 * `rm -rf dist` race, or a gate silently missing from a layer it needs to run
 * in).
 *
 * `pre-commit.ts` and `pre-push.ts` are entry scripts (top-level
 * `process.exit`, stdin reads, lock acquisition) and must never be imported
 * from a test process — assertions that need their structure read the source
 * text instead and are noted as source-based, in contrast to the
 * behavior-based assertions that import and call real exported functions.
 */

const huskyDirectory = join(REPO_ROOT, 'packages/components/scripts/husky');
const componentsPackageRoot = join(REPO_ROOT, 'packages/components');

/** Strip line comments and block comments so source-text assertions aren't fooled by commentary. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

async function readPackageJson(path: string): Promise<Record<string, unknown>> {
  const raw: unknown = await Bun.file(path).json();
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Expected an object at ${path}`);
  }
  return raw as Record<string, unknown>;
}

function scriptsOf(manifest: Record<string, unknown>): Record<string, string> {
  const scripts = manifest['scripts'];
  if (typeof scripts !== 'object' || scripts === null) return {};
  const entries = Object.entries(scripts as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return Object.fromEntries(entries);
}

/** Split a `&&`-joined script chain into its individual `bun run <name>` segments. */
function chainSegments(script: string): string[] {
  return script
    .split('&&')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function chainIncludesScript(script: string, name: string): boolean {
  return chainSegments(script).some(
    (segment) => segment === `bun run ${name}` || segment.startsWith(`bun run ${name} `),
  );
}

describe('pipeline contract: commit stays cheap', () => {
  it('pre-commit.ts dispatches no test job (source-based: entry script, never imported)', async () => {
    const source = stripComments(await Bun.file(join(huskyDirectory, 'pre-commit.ts')).text());
    // Tests are guaranteed at pre-push (scoped, dependency-closure aware) and in
    // CI, so re-adding a test dispatch to pre-commit would regress commit time
    // from seconds to minutes for every developer on every commit. See
    // docs/validation-topology.md.
    expect(source).not.toMatch(/script:\s*'test'/);
    expect(source).not.toMatch(/'test:changed'/);
    // The only literal job `script` pre-commit constructs is 'typecheck'.
    expect(source).toMatch(/script:\s*'typecheck'/);
  });
});

describe('pipeline contract: push stays parallel and scoped', () => {
  it('phaseMaxConcurrency treats every gate script identically (behavior-based)', () => {
    // Equality across phases is the invariant with teeth: issue #364 was fixed by
    // pre-building the dependency closure before the test phase, specifically so
    // the test phase no longer needs `if (script === 'test') return 1`-style
    // serialization. Re-introducing a per-script special case here would
    // silently reopen that regression. See docs/validation-topology.md.
    const scripts: readonly GateScript[] = ['lint', 'typecheck', 'test'];
    const concurrencies = scripts.map((script) => phaseMaxConcurrency(script));
    expect(new Set(concurrencies).size).toBe(1);

    // `>1` only holds on a multi-core box; asserting it unconditionally would
    // flake on a single-core CI runner. Guard on the actual hardware value so
    // the assertion still catches an accidental `return 1` on real developer
    // machines without becoming environment-flaky.
    const hardwareConcurrency = navigator.hardwareConcurrency;
    if (hardwareConcurrency > 1) {
      expect(concurrencies[0]).toBeGreaterThan(1);
    } else {
      expect(concurrencies[0]).toBe(1);
    }
  });

  it("prePushPackageScript maps @lostgradient/cinder's test to test:changed (behavior-based)", () => {
    // @lostgradient/cinder's full `test` script is slow; pre-push must run the
    // scoped `test:changed` variant instead, or every push touching cinder pays
    // for the full component suite. See docs/validation-topology.md.
    expect(prePushPackageScript('@lostgradient/cinder', 'test')).toBe('test:changed');
    // Every other package's test script is unmodified.
    expect(prePushPackageScript('@cinder/diff', 'test')).toBe('test');
    expect(prePushPackageScript('@lostgradient/cinder', 'lint')).toBe('lint');
    expect(prePushPackageScript('@lostgradient/cinder', 'typecheck')).toBe('typecheck');
  });

  it('BUILDABLE_PACKAGES_IN_DEPENDENCY_ORDER is exactly the diff→markdown→editor→commentary→components chain (behavior-based)', () => {
    // preBuildDependencyClosure (pre-push.ts) walks this list as a prefix, not a
    // graph, to decide what must build before the test phase runs (the actual
    // #364 fix). If a future package reorders its dependencies against this
    // list, the forward-closure prefix logic silently under-builds instead of
    // failing — so this list must stay pinned to the exact topological order.
    expect(BUILDABLE_PACKAGES_IN_DEPENDENCY_ORDER).toEqual([
      '@cinder/diff',
      '@cinder/markdown',
      '@cinder/editor',
      '@cinder/commentary',
      '@lostgradient/cinder',
    ]);
  });
});

describe('pipeline contract: package script composition (source-based: reads packages/*/package.json)', () => {
  const KNOWN_LINT_INVARIANTS_CHECKS = [
    'check:no-cycle-imports',
    'check:consumer-boundaries',
    'check:no-bare-console-warn',
    'check:no-inline-match-media',
    'check:svelte-ts-runtime-types',
    'check:data-cinder-boolean-attributes',
    'check:test-cleanup',
    'tokens:literals',
  ] as const;

  it("components' lint script is oxlint-only and contains no check:* script", async () => {
    const manifest = await readPackageJson(join(componentsPackageRoot, 'package.json'));
    const scripts = scriptsOf(manifest);
    const lint = scripts['lint'];
    expect(lint).toBeDefined();
    // `lint` must stay a single fast oxlint pass. Folding a `check:*` invariant
    // into it would make every lint-staged run (pre-commit) pay for checks that
    // belong in the slower, explicitly-scoped `lint:invariants` chain — the same
    // "cheap commit" guarantee assertion 1 protects, from the other direction.
    expect(lint).toContain('oxlint');
    const checkScriptNames = Object.keys(scripts).filter((name) => name.startsWith('check:'));
    for (const checkName of checkScriptNames) {
      expect(chainIncludesScript(lint ?? '', checkName)).toBe(false);
    }
  });

  it("components' lint:invariants chain contains every known check", async () => {
    const manifest = await readPackageJson(join(componentsPackageRoot, 'package.json'));
    const scripts = scriptsOf(manifest);
    const lintInvariants = scripts['lint:invariants'];
    expect(lintInvariants).toBeDefined();
    // Containment, not equality: another task may append `check:pipeline-coverage`
    // to this chain concurrently with this change. Any known check going
    // missing is the real regression this pins — losing one silently drops an
    // entire class of guardrail (cycle imports, consumer boundaries,
    // console.warn hygiene, inline matchMedia, Svelte/TS runtime type drift,
    // boolean attribute conventions, test cleanup, or design-token literal usage).
    for (const checkName of KNOWN_LINT_INVARIANTS_CHECKS) {
      expect(chainIncludesScript(lintInvariants ?? '', checkName)).toBe(true);
    }
  });

  it("components' validate chain includes both lint and lint:invariants", async () => {
    const manifest = await readPackageJson(join(componentsPackageRoot, 'package.json'));
    const scripts = scriptsOf(manifest);
    const validate = scripts['validate'];
    expect(validate).toBeDefined();
    // `validate` is the full pre-publish/CI gate; dropping either segment would
    // let a published release ship past a lint or invariant regression that
    // pre-commit/pre-push only check in scoped form.
    expect(chainIncludesScript(validate ?? '', 'lint')).toBe(true);
    expect(chainIncludesScript(validate ?? '', 'lint:invariants')).toBe(true);
  });

  it('no package script contains an inline `rm -rf dist` outside the dedicated `clean` script', async () => {
    // Issue #364 was an inline `rm -rf dist` inside a *build/test* script racing
    // concurrent invocations that shared the same dist/ directory. The fix
    // (build-cache.ts's content-hash skip) only works if no script other than
    // the deliberately-destructive, never-run-mid-pipeline `clean` script wipes
    // dist out from under it.
    const packagesDirectory = join(REPO_ROOT, 'packages');
    const entries = await readdir(packagesDirectory, { withFileTypes: true });
    const inlineRemoveDistPattern = /rm\s+-rf\s+dist/;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(packagesDirectory, entry.name, 'package.json');
      const manifestFile = Bun.file(manifestPath);
      if (!(await manifestFile.exists())) continue;
      const manifest = await readPackageJson(manifestPath);
      const scripts = scriptsOf(manifest);
      for (const [scriptName, scriptValue] of Object.entries(scripts)) {
        if (inlineRemoveDistPattern.test(scriptValue)) {
          expect(scriptName).toBe('clean');
        }
      }
    }
  });
});

describe('pipeline contract: builds stay skippable (source-based: reads each build.ts)', () => {
  for (const packageName of BUILDABLE_PACKAGES_IN_DEPENDENCY_ORDER) {
    it(`${packageName}/scripts/build.ts imports from lib/build-cache`, async () => {
      const packageDirectory = packageName.startsWith('@cinder/')
        ? packageName.replace('@cinder/', '')
        : 'components';
      const buildScriptPath = join(REPO_ROOT, 'packages', packageDirectory, 'scripts/build.ts');
      const source = await Bun.file(buildScriptPath).text();
      // build-cache.ts's content-hash skip is what makes preBuildDependencyClosure
      // (pre-push.ts) cheap on a hot path: without it, every push would pay a
      // full rebuild of the entire buildable chain instead of hash-skipping
      // unchanged packages.
      expect(source).toMatch(/from ['"]\.\/lib\/build-cache\.ts['"]/);
    });
  }
});

describe('pipeline contract: global test-cleanup registration stays wired', () => {
  it('preload.ts references the register-global-cleanup module (source-based: preload runs before test files load)', async () => {
    const source = await Bun.file(join(componentsPackageRoot, 'scripts/preload.ts')).text();
    // Every component test's render() relies on ONE global afterEach(cleanup)
    // registered here, before any test file's static imports resolve. Losing
    // this wiring would silently stop unmounting components between tests,
    // reintroducing exactly the kind of cross-suite DOM leak documented in
    // register-global-cleanup.ts (and the alert-dialog leak it was built to fix).
    expect(source).toMatch(/register-global-cleanup/);
  });
});
