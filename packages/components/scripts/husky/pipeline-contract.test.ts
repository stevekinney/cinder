import { describe, expect, it } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { REPO_ROOT } from './utilities.ts';

/**
 * Pins the shape of the validation pipeline described in
 * `docs/validation-topology.md`: pre-commit stays cheap (lockfile + formatting
 * only), pre-push stays a fast, fail-open sanity check with no
 * expensive gate of its own (PR CI + branch protection own that job now), and
 * the package-level scripts compose the way pre-commit assumes. Every
 * assertion below explains, in its failure message, WHY the invariant exists —
 * so a change that regresses the topology fails loudly instead of quietly
 * reintroducing a fixed problem (slow commits, a resurrected local gate lock,
 * a `rm -rf dist` race, or a gate silently missing from a layer it needs to
 * run in).
 *
 * `pre-commit.ts` and `pre-push.ts` are entry scripts (top-level
 * `process.exit`, stdin reads) and must never be imported from a test process
 * — assertions that need their structure read the source text instead and are
 * noted as source-based, in contrast to the behavior-based assertions that
 * import and call real exported functions.
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
  it('pre-commit.ts dispatches no install, lint, typecheck, or test job', async () => {
    const source = stripComments(await Bun.file(join(huskyDirectory, 'pre-commit.ts')).text());
    // Required PR CI and main-green own source lint, typecheck, and tests. A
    // hook dispatch duplicates those gates locally and makes concurrent
    // worktrees contend before CI can run them in isolated jobs.
    expect(source).not.toMatch(/\bbun\s+run\s+(lint|typecheck|test)\b/);
    expect(source).not.toMatch(/\bturbo\s+run\b/);
    expect(source).not.toMatch(/script:\s*'(lint|typecheck|test)'/);
    expect(source).not.toMatch(/'test:changed'/);
    expect(source).not.toMatch(/runWithConcurrencyPool/);
    expect(source).not.toMatch(/runHookCommand\(\s*['"]bun['"]\s*,\s*\[\s*['"]install['"]/);
    expect(source).not.toContain('$`bun install');
  });

  it('lint-staged runs formatters only', async () => {
    const manifest = await readPackageJson(join(REPO_ROOT, 'package.json'));
    const lintStaged = manifest['lint-staged'];
    expect(lintStaged).toBeDefined();
    expect(typeof lintStaged).toBe('object');

    const commands = Object.values(lintStaged as Record<string, unknown>).flatMap((entry) => {
      if (typeof entry === 'string') return [entry];
      return Array.isArray(entry)
        ? entry.filter((command): command is string => typeof command === 'string')
        : [];
    });

    expect(commands.some((command) => command.startsWith('prettier '))).toBe(true);
    expect(commands).toContain('sort-package-json');
    for (const command of commands) {
      expect(command).not.toMatch(/\b(?:oxlint|stylelint|typecheck|test(?::[\w-]+)?|turbo)\b/);
    }
  });
});

describe('pipeline contract: push stays thin and fails open (source-based: entry script, never imported)', () => {
  it('pre-push.ts dispatches no lint/typecheck/test job', async () => {
    const source = stripComments(await Bun.file(join(huskyDirectory, 'pre-push.ts')).text());
    // The scoped/full lint+typecheck+test dispatch (and the package builds that
    // fed it) moved to CI entirely. Re-adding a job dispatch here would
    // reintroduce the multi-minute local gate that serialized concurrent
    // worktree pushes behind a shared lock. See docs/validation-topology.md.
    //
    // Covers every real invocation shape a re-added dispatch could plausibly
    // take, not just the two literal fragments the original scoped dispatch
    // used — a bare `bun run lint`/`bun run typecheck`, a `turbo run <task>`
    // call (filtered or not; this hook has no reason to shell out to turbo at
    // all), and the two original fragments (`bun run --filter`,
    // `'test:changed'`) from the removed scoped-dispatch implementation.
    expect(source).not.toMatch(/\bbun\s+run\s+(lint|typecheck|test)\b/);
    expect(source).not.toMatch(/\bturbo\s+run\b/);
    expect(source).not.toMatch(/bun run --filter/);
    expect(source).not.toMatch(/'test:changed'/);
    expect(source).not.toMatch(/runWithConcurrencyPool/);
  });

  it('pre-push.ts never acquires the local validation gate lock', async () => {
    const source = stripComments(await Bun.file(join(huskyDirectory, 'pre-push.ts')).text());
    // With no expensive critical section left to serialize, pre-push must not
    // reach for withGateLock/withLocalValidationGateLock — that lock still
    // protects the OTHER scripts that do heavy local work standalone
    // (test-changed.ts, generate-component-artifacts.ts, validate-consumers.ts),
    // but pre-push queuing behind it would resurrect exactly the cross-worktree
    // serialization this change removes.
    expect(source).not.toMatch(/GateLock/);
  });

  it('pre-push.ts fails open: every exit path is 0', async () => {
    const source = stripComments(await Bun.file(join(huskyDirectory, 'pre-push.ts')).text());
    // The old hook failed safe to a full validation run on any ambiguity; this
    // hook fails OPEN instead — warn and let the push through — because PR CI
    // and required branch-protection status checks are the real backstop now.
    expect(source).not.toMatch(/process\.exit\(1\)/);
  });
});

describe('pipeline contract: removed pre-push helpers stay removed', () => {
  it('does not retain dead digest helpers or their old dependency-closure story', async () => {
    const source = await Bun.file(join(huskyDirectory, 'utilities.ts')).text();

    for (const removedName of [
      'GateFailure',
      'summarizeFailures',
      'inferFailureScope',
      'formatFailureSummary',
      'writePrePushLog',
      'preBuildDependencyClosure',
      'pre-push-gate',
      'pre-push gate',
    ]) {
      expect(source).not.toContain(removedName);
    }
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
    // into it would make ordinary explicit lint runs pay for checks that belong
    // in the slower `lint:invariants` chain.
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

  it("components' source validate chain excludes packed-consumer release checks", async () => {
    const manifest = await readPackageJson(join(componentsPackageRoot, 'package.json'));
    const scripts = scriptsOf(manifest);
    const validate = scripts['validate'];
    expect(validate).toBeDefined();
    // Packed-consumer installation and package-weight checks belong to the
    // explicit release workflow. Keeping them out of the source gate prevents
    // every ordinary CI validation from repeating artifact work.
    expect(chainIncludesScript(validate ?? '', 'lint')).toBe(true);
    expect(chainIncludesScript(validate ?? '', 'lint:invariants')).toBe(true);
    expect(chainIncludesScript(validate ?? '', 'validate:consumer')).toBe(false);
    expect(chainIncludesScript(validate ?? '', 'package:weight:check')).toBe(false);
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

// The buildable packages, in dependency order: `@lostgradient/markdown` has no
// internal workspace dependencies (it absorbed `@cinder/diff` in Phase 2 — see
// docs/decisions/package-boundaries.md), `@cinder/commentary` depends on
// `@lostgradient/markdown` (dissolved `@cinder/editor` — Phase 1 — dropped out
// of this chain entirely, #793), and `@lostgradient/cinder` (components)
// depends on both. Inlined here (not imported from utilities.ts) because no
// hook derives a build closure from this list locally anymore — CI's
// `--filter` build steps do the equivalent hash-skip check independently, so
// this is purely a fixture for the assertion below.
const BUILDABLE_PACKAGES_IN_DEPENDENCY_ORDER = [
  '@lostgradient/markdown',
  '@cinder/commentary',
  '@lostgradient/cinder',
] as const;

/** Map a buildable package name to its `packages/<dir>` directory name. */
const PACKAGE_DIRECTORY_BY_NAME: Record<
  (typeof BUILDABLE_PACKAGES_IN_DEPENDENCY_ORDER)[number],
  string
> = {
  '@lostgradient/markdown': 'markdown',
  '@cinder/commentary': 'commentary',
  '@lostgradient/cinder': 'components',
};

describe('pipeline contract: builds stay skippable (source-based: reads each build.ts)', () => {
  for (const packageName of BUILDABLE_PACKAGES_IN_DEPENDENCY_ORDER) {
    it(`${packageName}/scripts/build.ts imports from lib/build-cache`, async () => {
      const packageDirectory = PACKAGE_DIRECTORY_BY_NAME[packageName];
      const buildScriptPath = join(REPO_ROOT, 'packages', packageDirectory, 'scripts/build.ts');
      const source = await Bun.file(buildScriptPath).text();
      // build-cache.ts's content-hash skip is what keeps every CI job's inline
      // `bun run --filter=<dep> build` step cheap: without it, every job would
      // pay a full rebuild of the entire buildable chain instead of
      // hash-skipping unchanged packages.
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
