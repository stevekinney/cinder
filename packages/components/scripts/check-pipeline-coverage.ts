/**
 * Validation-pipeline coverage map.
 *
 * The streamlining batch that preceded this script fixed "the same expensive
 * check running four times, hooks taking forever" — but nothing stopped that
 * disease from coming back, and nothing catches its opposite, a gate silently
 * missing from every layer it needs to run in (the `components:check`-in-no-
 * workflow bug, issue #411). This script is the guardrail: a declarative table
 * says which layers a named validation command is SUPPOSED to run in, then the
 * script parses the actual sources — the components-package AND workspace-root
 * `package.json` script chains, the GitHub Actions workflow YAML files, and
 * (best-effort) the two husky hook scripts — to discover which layers a
 * command ACTUALLY runs in, and fails on any mismatch in either direction.
 *
 * Layers:
 *   - `pre-commit` / `pre-push` — local git hooks (packages/components/scripts/husky/*.ts).
 *   - `unit-tests` / `browser-tests` / `main-green` / `release` / `changeset-guard`
 *     — GitHub Actions workflows under `.github/workflows/`.
 *
 * Discovery resolves package.json script chains TRANSITIVELY: a command
 * doesn't have to be a literal workflow step to run in that layer — it can be
 * reached by following `&&`-joined `bun run <script>` chains from whatever the
 * layer's real entry points are (e.g. `main-green.yaml`'s `bun run lint`
 * reaches the root `lint` script, which in turn runs every package `lint`
 * script plus `stylelint`). A naive text search over the raw YAML would miss
 * those transitive gates and the map would be decorative, not real.
 *
 * Command matching is token-aware, not substring-aware: searching for `lint`
 * inside a hook script must not match `lint-staged`, and `test` must not match
 * `test:changed` or `test:coverage`. Every declared `package.json`-script
 * command name is matched against `bun run <name>`, `--filter=<pkg> <name>`, or
 * a bare script invocation, anchored so distinct-but-overlapping names never
 * conflate. `stylelint` is the one declared command that is NOT a
 * `package.json` script — it's an external binary, matched by a whole-word
 * token search plus resolution through either script manifest's `bun run
 * <entry>` chains (see {@link EXTERNAL_BINARY_COMMANDS}).
 *
 * Husky hook sources are being edited concurrently by another task, so the
 * hook layers are intentionally best-effort: if a hook file can't be read or
 * its script chain can't be confidently resolved, this script WARNS for those
 * two layers only rather than failing the whole run.
 */

import { load as loadYaml } from 'js-yaml';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseJsonFile } from './lib/read-json-file.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const repoRoot = resolve(packageRoot, '..', '..');
const workflowsDirectory = join(repoRoot, '.github', 'workflows');
const componentsPackageName = '@lostgradient/cinder';

export const LAYERS = [
  'pre-commit',
  'pre-push',
  'unit-tests',
  'browser-tests',
  'main-green',
  'release',
  'changeset-guard',
] as const;

export type Layer = (typeof LAYERS)[number];

/** Layers discovered from hook sources are advisory — a parse failure warns, not fails. */
const HOOK_LAYERS = new Set<Layer>(['pre-commit', 'pre-push']);

export type DeclarationRow = {
  /** Layers this command is declared to run in. */
  layers: readonly Layer[];
  /** Why this command belongs (or doesn't belong) in each declared layer. */
  reason: string;
};

/**
 * The declarative table: for every named validation command in
 * `packages/components/package.json`, which layers it is INTENDED to run in.
 * Populated from the current actual state of the tree (verified by reading
 * every workflow, every package.json script chain, and both hook scripts) —
 * so today's tree is the intended tree, and drift from here forward is the
 * thing this script exists to catch.
 */
export const DECLARATION_TABLE: Record<string, DeclarationRow> = {
  lint: {
    layers: ['pre-push', 'unit-tests', 'main-green'],
    reason:
      'oxlint. pre-commit runs lint-staged (oxlint invoked directly on staged files, not the ' +
      '`lint` script by name) so it is NOT counted here. The package-level `lint` script itself is ' +
      "invoked by pre-push (scoped), unit-tests.yaml (`--filter='*' lint`, unconditional), " +
      'and main-green (`bun run lint`). Release deliberately does not rerun source lint.',
  },
  'lint:invariants': {
    layers: ['unit-tests', 'main-green'],
    reason:
      "cinder's custom tree-walk invariant checks. Explicitly called out in unit-tests.yaml " +
      'and main-green (not folded into the `lint` sweep). ' +
      'Not run at commit/push time by name — pre-commit/pre-push scope to typecheck/test, not this chain.',
  },
  typecheck: {
    layers: ['pre-commit', 'pre-push', 'browser-tests', 'main-green'],
    reason:
      'Per-package typecheck. pre-commit escalates to full workspace typecheck on root-config ' +
      'changes (else scoped per touched package); pre-push includes it in the scoped/full job set; ' +
      'browser-tests.yaml has a dedicated `typecheck` job running `bun run typecheck` against a ' +
      'fresh checkout (independent of the scope decision); main-green runs the workspace typecheck. ' +
      'unit-tests.yaml deliberately does NOT run typecheck (that ' +
      'job is lint + aggregator + components:check + test).',
  },
  stylelint: {
    layers: ['pre-push', 'unit-tests', 'main-green'],
    reason:
      'External binary, not a `bun run <name>` package.json script. unit-tests.yaml runs it ' +
      'directly (`bunx stylelint`, unconditional, over all package CSS/Svelte sources); main-green ' +
      'reaches it through the ROOT `lint` script (`bun run --filter=\'*\' lint && stylelint "…"`) — ' +
      'NOT the components-package `lint` (plain oxlint), a distinct resolution scope from every ' +
      "other row in this table; pre-push's `runStylelint` invokes the resolved local binary over the " +
      'changed CSS/Svelte file list. Deliberately excludes pre-commit for the same reason `lint` ' +
      "does: pre-commit's lint-staged runs `stylelint --fix` directly on staged files, not through " +
      'either named `lint` script, so it is not counted as a layer here (same editorial policy as ' +
      "the `lint` row above). NOT run by release (root `validate` only fans into each package's own " +
      '`validate`, none of which invoke stylelint) or browser-tests/changeset-guard.',
  },
  'check:no-cycle-imports': {
    layers: ['unit-tests', 'main-green'],
    reason: 'Member of lint:invariants — same layer set.',
  },
  'check:consumer-boundaries': {
    layers: ['unit-tests', 'main-green'],
    reason: 'Member of lint:invariants — same layer set.',
  },
  'check:no-bare-console-warn': {
    layers: ['unit-tests', 'main-green'],
    reason: 'Member of lint:invariants — same layer set.',
  },
  'check:no-inline-match-media': {
    layers: ['unit-tests', 'main-green'],
    reason: 'Member of lint:invariants — same layer set.',
  },
  'check:svelte-ts-runtime-types': {
    layers: ['unit-tests', 'main-green'],
    reason: 'Member of lint:invariants — same layer set.',
  },
  'check:data-cinder-boolean-attributes': {
    layers: ['unit-tests', 'main-green'],
    reason: 'Member of lint:invariants — same layer set.',
  },
  'check:test-cleanup': {
    layers: ['unit-tests', 'main-green'],
    reason: 'Member of lint:invariants — same layer set.',
  },
  'tokens:literals': {
    layers: ['unit-tests', 'main-green'],
    reason: 'Member of lint:invariants (invoked with `-- --strict`) — same layer set.',
  },
  'check:pipeline-coverage': {
    layers: ['unit-tests', 'main-green'],
    reason: 'This script. Appended to lint:invariants so it runs everywhere the invariants run.',
  },
  'check:changeset-prerelease-bumps': {
    layers: ['changeset-guard', 'main-green', 'release'],
    reason:
      'Direct step in changeset-guard.yaml (fast PR gate for changeset-only edits), in main-green ' +
      'source audits, and in release before Changesets opens/updates the Version Packages PR. ' +
      'NOT a member of lint:invariants and NOT run by unit-tests.yaml (that workflow excludes ' +
      '`.changeset/**` from its path filters by design).',
  },
  'check:placeholder-docs': {
    layers: ['main-green'],
    reason: 'Source audit owned by main-green; release validates only the publish artifact.',
  },
  'platform:audit': {
    layers: ['main-green'],
    reason: 'Source audit owned by main-green; release validates only the publish artifact.',
  },
  'colors:audit': {
    layers: ['main-green'],
    reason: 'Source audit owned by main-green; release validates only the publish artifact.',
  },
  'tokens:audit': {
    layers: ['main-green'],
    reason: 'Source audit owned by main-green; release validates only the publish artifact.',
  },
  'aggregator:check': {
    layers: ['unit-tests', 'main-green'],
    reason:
      'Direct step in unit-tests.yaml (unconditional whole-repo invariant — a CSS-only change can ' +
      'desync the aggregator without touching the checker itself, so scoped test:changed would ' +
      'miss it) and in main-green so the release-blocking source gate covers generated styles.',
  },
  'components:check': {
    layers: ['unit-tests', 'main-green'],
    reason:
      'Direct step in unit-tests.yaml (unconditional — a *.example.svelte edit can desync a ' +
      'committed manifest without the generator itself changing). This is the exact command whose ' +
      'CI-layer absence was issue #411. Also runs in main-green so the release-blocking source ' +
      'gate covers generated component metadata.',
  },
  'validate:workflow': {
    layers: ['main-green'],
    reason: 'Source audit owned by main-green; release runs the release-workflow guard directly.',
  },
  'validate:release-workflow': {
    layers: ['release'],
    reason:
      'Called directly in release so the tokenless OIDC publish path plus ignored-package ' +
      'changeset guard are checked on every push. main-green owns the broader `validate:workflow` contract.',
  },
  'validate:svelte-peer': {
    layers: ['main-green'],
    reason: 'Source/package metadata audit owned by main-green; release validates the tarball.',
  },
  'validate:consumer': {
    layers: ['release'],
    reason:
      'Direct release artifact gate. It builds the staged tarball and installs it into consumer ' +
      'fixtures immediately before package weight and publish.',
  },
  'package:weight:check': {
    layers: ['release'],
    reason:
      'Direct release artifact gate after `validate:consumer`, invoked with `-- --existing-tarball` ' +
      'on the publish and dry-run paths.',
  },
  test: {
    layers: ['pre-push'],
    reason:
      'The component package test suite. NOT run at commit time by design — pre-commit.ts is ' +
      'explicit that tests are deferred to pre-push (which owns a scoped, dependency-closure-aware ' +
      'run). main-green must NOT call this bare full-suite script because it serializes the whole ' +
      'workspace test graph into one timeout-prone step; it runs the chunkable `test:changed` full ' +
      'suite instead. main-green reaches coverage via `test:coverage`, and unit-tests.yaml runs the ' +
      'scoped `test:changed` variant, not this literal script name.',
  },
  'test:changed': {
    layers: ['pre-push', 'unit-tests', 'main-green'],
    reason:
      'The dependency-closure-scoped test runner. pre-push always calls it via `prePushPackageScript` ' +
      'for the components package; unit-tests.yaml calls it directly in "Run component unit tests (scoped)"; ' +
      'main-green calls it with CINDER_TEST_MODE=full and a four-way chunk matrix so the full component ' +
      'suite stays authoritative without reintroducing a single long-running workspace test step.',
  },
  'test:coverage': {
    layers: ['main-green'],
    reason:
      'Full-suite coverage + ratchet. Runs as its own main-green job so coverage remains a source ' +
      'gate without making release rerun the entire validation suite before publish.',
  },
};

/** Commands whose layer set is intentionally NOT verified (meta-scripts with no fixed home). */
const IGNORED_COMMANDS = new Set<string>([]);

/**
 * Commands that are external binaries, not `bun run <name>` package.json
 * scripts — `stylelint` is invoked as `bunx stylelint <glob>` (unit-tests.yaml,
 * root `lint`) or via a resolved local binary path (`pre-push.ts`'s
 * `runStylelint`), never through a named script this script's `bun run <name>`
 * chain resolution can see. These are matched by a plain whole-word text
 * search over both workflow `run:` bodies and hook source, independent of the
 * package.json script-chain machinery used for everything else.
 */
const EXTERNAL_BINARY_COMMANDS = new Set<string>(['stylelint']);

/** Whole-word text search — no `bun run` anchoring, no script-chain resolution. */
function invokesExternalBinaryToken(text: string, command: string): boolean {
  const escaped = escapeRegExp(command);
  const pattern = new RegExp(`\\b${escaped}\\b`, 'u');
  return pattern.test(text);
}

/**
 * Does `layerText` invoke the external-binary `command` (see
 * {@link EXTERNAL_BINARY_COMMANDS}) — directly as a literal token, or via a
 * `bun run <entry>` chain resolved against EITHER the components-package or
 * the workspace-root script manifest? Checking both manifests is what lets
 * `main-green`'s unqualified `bun run lint` (the ROOT script, which chains to
 * `stylelint`) register as covering it, even though every other declared
 * command in this file resolves only against the components-package chain.
 */
function layerInvokesExternalBinary(
  layerText: string,
  command: string,
  packageScripts: Record<string, string>,
  rootScripts: Record<string, string>,
): boolean {
  if (invokesExternalBinaryToken(layerText, command)) return true;

  for (const invocation of extractBunRunInvocations(layerText)) {
    const scope = scopeForWorkflowInvocation(invocation);
    if (scope === undefined) continue;
    const chains = resolveScriptChainsAcrossScopes(
      invocation.name,
      scope,
      packageScripts,
      rootScripts,
    );

    for (const scriptName of chains.packageScripts) {
      if (invokesExternalBinaryToken(packageScripts[scriptName] ?? '', command)) return true;
    }

    for (const scriptName of chains.rootScripts) {
      if (invokesExternalBinaryToken(rootScripts[scriptName] ?? '', command)) return true;
    }
  }

  return false;
}

type ParsedSources = {
  /** name -> resolved script body, packages/components/package.json scripts. */
  packageScripts: Record<string, string>;
  /**
   * name -> resolved script body, the workspace ROOT package.json scripts.
   * Workflow `bun run <name>` entry points resolve through this root scope
   * unless they explicitly cross into a package with `--filter`.
   */
  rootScripts: Record<string, string>;
  /**
   * layer -> concatenated `run:` step bodies extracted from the workflow YAML
   * (undefined if the layer has no workflow file). Deliberately excludes
   * comments, workflow descriptions, and any other YAML prose — only the
   * shell text GitHub Actions actually executes.
   */
  workflowText: Partial<Record<Layer, string>>;
  /** layer -> raw hook script text (undefined if unreadable/missing). Hook layers only. */
  hookText: Partial<Record<Layer, string>>;
};

export type Violation = {
  command: string;
  kind: 'undeclared' | 'missing';
  layer: Layer;
  detail: string;
};

export type CheckResult = {
  violations: Violation[];
  warnings: string[];
};

/**
 * Expand a package.json script body into the set of `bun run <name>` script
 * names it invokes, transitively. Stops recursing into names not defined in
 * `packageScripts` (external binaries like `oxlint`, `tsc`, `stylelint`).
 */
export function resolveScriptChain(
  scriptName: string,
  packageScripts: Record<string, string>,
  seen: Set<string> = new Set(),
): Set<string> {
  if (seen.has(scriptName)) return seen;
  seen.add(scriptName);

  const body = packageScripts[scriptName];
  if (body === undefined) return seen;

  for (const invoked of extractInvokedScriptNames(body, packageScripts)) {
    resolveScriptChain(invoked, packageScripts, seen);
  }
  return seen;
}

type ScriptScope = 'package' | 'root';

type BunRunInvocation = {
  filter: string | undefined;
  name: string;
};

function normalizeFilter(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.replace(/^['"]|['"]$/gu, '');
}

function filterTargetsComponentsPackage(filter: string | undefined): boolean {
  if (filter === undefined) return false;
  return filter === componentsPackageName || filter === '*';
}

function extractBunRunInvocations(body: string): BunRunInvocation[] {
  const found: BunRunInvocation[] = [];
  const pattern =
    /\bbun\s+run\s+(?:(?:--filter(?:=|\s+)(?:"([^"]+)"|'([^']+)'|(\S+)))\s+)?([A-Za-z0-9:_.-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const name = match[4];
    if (name === undefined) continue;
    found.push({ filter: normalizeFilter(match[1] ?? match[2] ?? match[3]), name });
  }
  return found;
}

function scopeForWorkflowInvocation(invocation: BunRunInvocation): ScriptScope | undefined {
  if (invocation.filter === undefined) return 'root';
  if (filterTargetsComponentsPackage(invocation.filter)) return 'package';
  return undefined;
}

function scopeForNestedInvocation(
  invocation: BunRunInvocation,
  currentScope: ScriptScope,
): ScriptScope | undefined {
  if (invocation.filter === undefined) return currentScope;
  if (filterTargetsComponentsPackage(invocation.filter)) return 'package';
  return undefined;
}

function resolveScriptChainsAcrossScopes(
  scriptName: string,
  initialScope: ScriptScope,
  packageScripts: Record<string, string>,
  rootScripts: Record<string, string>,
  seen: Set<string> = new Set(),
): { packageScripts: Set<string>; rootScripts: Set<string> } {
  const packageChain = new Set<string>();
  const rootChain = new Set<string>();

  function visit(name: string, scope: ScriptScope): void {
    const key = `${scope}:${name}`;
    if (seen.has(key)) return;
    seen.add(key);

    const scripts = scope === 'package' ? packageScripts : rootScripts;
    const body = scripts[name];
    if (body === undefined) return;

    if (scope === 'package') {
      packageChain.add(name);
    } else {
      rootChain.add(name);
    }

    for (const invocation of extractBunRunInvocations(body)) {
      const nextScope = scopeForNestedInvocation(invocation, scope);
      if (nextScope === undefined) continue;
      visit(invocation.name, nextScope);
    }
  }

  visit(scriptName, initialScope);

  return { packageScripts: packageChain, rootScripts: rootChain };
}

/**
 * Extract every `bun run <name>` (optionally `--filter=<pkg> <name>`) token
 * from a script body that corresponds to a KNOWN script name in the given
 * scope. Token-anchored: a name is only matched when it appears as a whole
 * script-name token immediately after `run` (and an optional `--filter=...`),
 * never as a substring of a longer name.
 */
function extractInvokedScriptNames(body: string, packageScripts: Record<string, string>): string[] {
  const found: string[] = [];
  for (const invocation of extractBunRunInvocations(body)) {
    if (Object.hasOwn(packageScripts, invocation.name)) found.push(invocation.name);
  }
  return found;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * A named script whose body is exactly `bun run scripts/<file>.ts` (with
 * nothing else) can also be invoked directly by path — `bun
 * packages/components/scripts/<file>.ts` — bypassing `bun run <name>`
 * entirely (e.g. changeset-guard.yaml's direct invocation of
 * check-changeset-prerelease-bumps.ts). Returns the script-relative path
 * (e.g. `scripts/check-changeset-prerelease-bumps.ts`) if the command's body
 * matches that shape, else `undefined`.
 */
function directScriptPath(
  command: string,
  packageScripts: Record<string, string>,
): string | undefined {
  const body = packageScripts[command];
  if (body === undefined) return undefined;
  const match = /^bun run (scripts\/[A-Za-z0-9/_.-]+\.ts)$/u.exec(body.trim());
  return match?.[1];
}

/**
 * Does `text` invoke `command` by its direct script path (`bun
 * <anything>/<path>` or `bun run <path>`), independent of the named
 * `bun run <command>` form?
 */
function invokesDirectScriptPath(
  text: string,
  command: string,
  packageScripts: Record<string, string>,
): boolean {
  const relativePath = directScriptPath(command, packageScripts);
  if (relativePath === undefined) return false;
  const escaped = escapeRegExp(relativePath);
  const pattern = new RegExp(`\\bbun\\s+(?:run\\s+)?(?:\\S*/)?${escaped}(?:\\s|$)`, 'u');
  return pattern.test(text);
}

/**
 * Does `layer` (via its workflow `run:` text, or via a package.json script
 * chain reachable from a step in that workflow) invoke `command`? Resolves
 * every `bun run <name>` entry point found literally in the workflow text into
 * its transitive script-chain leaf set before matching, so a command three
 * links deep in a chain (e.g. `components:check` reached only via
 * `bun run validate`) still counts as covered. Also checks the direct
 * `bun <path>.ts` invocation shape for commands whose script body is a bare
 * `bun run scripts/<file>.ts`.
 */
function layerInvokesCommand(
  layerText: string,
  command: string,
  packageScripts: Record<string, string>,
  rootScripts: Record<string, string>,
): boolean {
  if (invokesDirectScriptPath(layerText, command, packageScripts)) return true;

  // Resolve every `bun run <name>` entry point in the workflow text into its
  // transitive chain and check membership.
  for (const invocation of extractBunRunInvocations(layerText)) {
    const scope = scopeForWorkflowInvocation(invocation);
    if (scope === undefined) continue;
    const chain = resolveScriptChainsAcrossScopes(
      invocation.name,
      scope,
      packageScripts,
      rootScripts,
    );
    if (chain.packageScripts.has(command)) return true;
  }

  return false;
}

async function readIfExists(path: string): Promise<string | undefined> {
  const file = Bun.file(path);
  if (!(await file.exists())) return undefined;
  return file.text();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Extract every `run:` step body from a parsed workflow document, concatenated
 * with newlines. This is the only text considered "what the layer executes" —
 * job names, `if:` conditions, step `name:` fields, and `#` comments in the
 * raw YAML are excluded by construction, since `js-yaml` only returns
 * document structure (comments are never part of the parsed value, and
 * non-`run` fields are never read). Walks the parsed value with runtime type
 * guards rather than type assertions, since this is untrusted-shape YAML, not
 * a pipeline-owned JSON artifact.
 */
export function extractRunStepBodies(workflowYaml: string): string {
  const document: unknown = loadYaml(workflowYaml);
  if (!isRecord(document)) return '';
  const jobs = document['jobs'];
  if (!isRecord(jobs)) return '';

  const runBodies: string[] = [];
  for (const job of Object.values(jobs)) {
    if (!isRecord(job)) continue;
    const steps = job['steps'];
    if (!Array.isArray(steps)) continue;
    for (const step of steps) {
      if (!isRecord(step)) continue;
      const run = step['run'];
      if (typeof run === 'string') runBodies.push(run);
    }
  }
  return runBodies.join('\n');
}

const WORKFLOW_FILE_BY_LAYER: Partial<Record<Layer, string>> = {
  'unit-tests': 'unit-tests.yaml',
  'browser-tests': 'browser-tests.yaml',
  'main-green': 'main-green.yaml',
  release: 'release.yaml',
  'changeset-guard': 'changeset-guard.yaml',
};

async function loadWorkflowText(): Promise<Partial<Record<Layer, string>>> {
  const result: Partial<Record<Layer, string>> = {};
  for (const layer of LAYERS) {
    const fileName = WORKFLOW_FILE_BY_LAYER[layer];
    if (fileName === undefined) continue;
    const rawYaml = await readIfExists(join(workflowsDirectory, fileName));
    if (rawYaml !== undefined) result[layer] = extractRunStepBodies(rawYaml);
  }
  return result;
}

async function loadHookText(): Promise<Partial<Record<Layer, string>>> {
  const huskyDirectory = join(packageRoot, 'scripts', 'husky');
  const result: Partial<Record<Layer, string>> = {};
  const preCommit = await readIfExists(join(huskyDirectory, 'pre-commit.ts'));
  if (preCommit !== undefined) result['pre-commit'] = preCommit;
  const prePush = await readIfExists(join(huskyDirectory, 'pre-push.ts'));
  if (prePush !== undefined) result['pre-push'] = prePush;
  return result;
}

type PackageManifestScripts = { scripts?: Record<string, string> };

async function loadManifestScripts(manifestPath: string): Promise<Record<string, string>> {
  const manifest = parseJsonFile<PackageManifestScripts>(await Bun.file(manifestPath).text());
  return manifest.scripts ?? {};
}

async function loadPackageScripts(): Promise<Record<string, string>> {
  return loadManifestScripts(join(packageRoot, 'package.json'));
}

/**
 * The workspace ROOT `package.json` scripts. A workflow step's `bun run lint`
 * (unqualified, no `--filter`) invokes the ROOT `lint` script — `bun run
 * --filter='*' lint && stylelint "…"` — not the components-package `lint`
 * (plain `oxlint`). The two manifests define distinct scripts under the same
 * name, so workflow-layer script resolution starts in this root scope and
 * crosses into the components-package scope only at `--filter` boundaries.
 */
async function loadRootScripts(): Promise<Record<string, string>> {
  return loadManifestScripts(join(repoRoot, 'package.json'));
}

export async function loadParsedSources(): Promise<ParsedSources> {
  const [packageScripts, rootScripts, workflowText, hookText] = await Promise.all([
    loadPackageScripts(),
    loadRootScripts(),
    loadWorkflowText(),
    loadHookText(),
  ]);
  return { packageScripts, rootScripts, workflowText, hookText };
}

/**
 * Simple token search for hook layers: hooks invoke scripts via
 * `runHookCommand('bun', ['run', script])` array arguments and helper
 * functions (`prePushPackageScript(...)`), never as a `bun run <name>` shell
 * string — so the workflow-oriented {@link layerInvokesCommand} structurally
 * cannot see them. Per the task's tolerance policy for these two
 * concurrently-edited files, this is deliberately a plain substring/word-
 * boundary search for the script name as a quoted string literal, not an AST
 * walk — good enough to catch `'typecheck'` / `'test:changed'` appearing as a
 * hook job's script argument, without hard-failing on hook-internal shape
 * changes.
 */
function hookInvokesCommand(hookText: string, command: string): boolean {
  const escaped = escapeRegExp(command);
  // Matches the command name inside a single- or double-quoted string
  // literal, e.g. `'typecheck'`, `"test:changed"`, `['run', 'typecheck']`.
  const pattern = new RegExp(`(['"])${escaped}\\1`, 'u');
  return pattern.test(hookText);
}

/**
 * Compare the declaration table against parsed sources and return violations
 * (declared-vs-actual mismatches for workflow/package.json layers — hard
 * failures) plus warnings (hook-layer parse uncertainty or hook-layer
 * mismatches — soft, per the concurrent-edit tolerance policy).
 */
export function checkPipelineCoverage(
  declarationTable: Record<string, DeclarationRow>,
  sources: ParsedSources,
): CheckResult {
  const violations: Violation[] = [];
  const warnings: string[] = [];

  for (const [command, row] of Object.entries(declarationTable)) {
    if (IGNORED_COMMANDS.has(command)) continue;
    const declared = new Set(row.layers);

    for (const layer of LAYERS) {
      const isHookLayer = HOOK_LAYERS.has(layer);
      const layerText = isHookLayer ? sources.hookText[layer] : sources.workflowText[layer];

      if (layerText === undefined) {
        if (isHookLayer) {
          warnings.push(
            `${layer} hook script could not be read; skipping coverage check for "${command}" in that layer.`,
          );
          continue;
        }
        violations.push({
          command,
          kind: declared.has(layer) ? 'missing' : 'undeclared',
          layer,
          detail: `workflow file for layer "${layer}" could not be read.`,
        });
        continue;
      }

      const isExternalBinary = EXTERNAL_BINARY_COMMANDS.has(command);
      const actuallyRuns = isExternalBinary
        ? isHookLayer
          ? invokesExternalBinaryToken(layerText, command)
          : layerInvokesExternalBinary(
              layerText,
              command,
              sources.packageScripts,
              sources.rootScripts,
            )
        : isHookLayer
          ? hookInvokesCommand(layerText, command)
          : layerInvokesCommand(layerText, command, sources.packageScripts, sources.rootScripts);
      const isDeclared = declared.has(layer);

      if (actuallyRuns && !isDeclared) {
        const message = `"${command}" actually runs in layer "${layer}" but is not declared there.`;
        if (isHookLayer) {
          warnings.push(`${message} (hook layer — advisory only)`);
        } else {
          violations.push({ command, kind: 'undeclared', layer, detail: message });
        }
      }

      if (!actuallyRuns && isDeclared) {
        const message = `"${command}" is declared to run in layer "${layer}" but does not appear to.`;
        if (isHookLayer) {
          warnings.push(`${message} (hook layer — advisory only)`);
        } else {
          violations.push({ command, kind: 'missing', layer, detail: message });
        }
      }
    }
  }

  return { violations, warnings };
}

function formatViolation(violation: Violation): string {
  const label = violation.kind === 'undeclared' ? 'UNDECLARED DUPLICATION' : 'MISSING GATE';
  return `  [${label}] ${violation.command} / ${violation.layer} — ${violation.detail}`;
}

async function main(): Promise<void> {
  const sources = await loadParsedSources();
  const { violations, warnings } = checkPipelineCoverage(DECLARATION_TABLE, sources);

  for (const warning of warnings) {
    process.stderr.write(`check-pipeline-coverage — warning: ${warning}\n`);
  }

  if (violations.length === 0) {
    process.stdout.write(
      `check-pipeline-coverage — OK (${Object.keys(DECLARATION_TABLE).length} commands, ` +
        `${LAYERS.length} layers, ${warnings.length} warning(s)).\n`,
    );
    return;
  }

  process.stderr.write(
    'check-pipeline-coverage — pipeline coverage mismatch(es) detected.\n' +
      'Either the declaration table in check-pipeline-coverage.ts is stale, or a validation ' +
      'command was added to / removed from a layer without updating it. Silent duplication ' +
      'wastes CI minutes; a silently dropped gate is how issue #411 happened.\n\n',
  );
  for (const violation of violations) {
    process.stderr.write(`${formatViolation(violation)}\n`);
  }
  process.exit(1);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('check-pipeline-coverage failed:', error);
    process.exit(1);
  });
}
