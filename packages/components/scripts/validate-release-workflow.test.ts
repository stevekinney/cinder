import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

import getReleasePlan from '@changesets/get-release-plan';

import {
  findIgnoredPackageChangesets,
  findMissingPublicPackageReleaseCommands,
  findMissingWorkflowDispatches,
  findOutdatedWorkflowActions,
  manualChatBootstrapHasPeerRegistryPreflight,
  manualCinderBootstrapHasMarkdownRegistryPreflight,
  manualMcpBootstrapHasCinderRegistryPreflight,
  parseChangesetPackageNames,
  publicPackagePublishOrderIsValid,
  rootPublishScriptUsesStagedPackers,
  rootValidationSeparatesSourceAndConsumerGates,
  workflowDeclaresPermission,
  workflowDispatchInputHasDefault,
  workflowExpressionContextRoots,
  workflowExpressionFunctionNames,
  workflowLevelEnvironmentLines,
  workflowRunScriptsContainActiveLine,
} from './validate-release-workflow.ts';

/**
 * The four contexts GitHub makes available to a workflow-level `env:` block.
 * Mirrors the allowlist the validator applies.
 */
const CONTEXTS_AVAILABLE_AT_WORKFLOW_LEVEL = new Set(['github', 'secrets', 'inputs', 'vars']);

/** Mirrors the validator's set of functions unavailable before a runner exists. */
const FUNCTIONS_UNAVAILABLE_AT_WORKFLOW_LEVEL = new Set([
  'hashfiles',
  'success',
  'failure',
  'cancelled',
  'always',
]);

function workflowLevelEnvironmentLineIsRejected(line: string): boolean {
  const hasUnavailableContext = workflowExpressionContextRoots(line).some(
    (root) => !CONTEXTS_AVAILABLE_AT_WORKFLOW_LEVEL.has(root),
  );
  const hasUnavailableFunction = workflowExpressionFunctionNames(line).some((name) =>
    FUNCTIONS_UNAVAILABLE_AT_WORKFLOW_LEVEL.has(name),
  );

  return hasUnavailableContext || hasUnavailableFunction;
}

describe('workflow-level env context guard', () => {
  // Regression: `TURBO_PLATFORM: ${{ runner.os }}` in a workflow-level `env:`
  // made GitHub reject unit-tests.yaml and main-green.yaml outright — every job
  // failed before starting, and the YAML parsed fine so nothing caught it.
  test.each([
    ['runner, the context that caused the outage', '  TURBO_PLATFORM: ${{ runner.os }}'],
    ['runner via bracket access', "  TURBO_PLATFORM: ${{ runner['os'] }}"],
    ['env, which is not available to itself', '  A: ${{ env.FOO }}'],
    ['jobs', '  A: ${{ jobs.some_job.outputs.value }}'],
    ['needs', '  A: ${{ needs.build.outputs.artifact }}'],
    ['matrix', '  A: ${{ matrix.chunk }}'],
    ['steps', '  A: ${{ steps.compute.outputs.value }}'],
    ['strategy', '  A: ${{ strategy.job-index }}'],
    // hashFiles needs a checked-out workspace; the status functions describe a
    // job that has not started. Neither exists before a runner is assigned.
    ['hashFiles, which needs a workspace', "  A: ${{ hashFiles('bun.lock') }}"],
    ['hashFiles regardless of casing', "  A: ${{ HASHFILES('bun.lock') }}"],
    ['the always status function', '  A: ${{ always() }}'],
    ['the success status function', '  A: ${{ success() }}'],
    // A whole context is as invalid as one of its properties, and neither the
    // dotted-root scan nor the function scan sees these on its own.
    ['a bare context with no property access', '  A: ${{ runner }}'],
    ['a bare context passed to an allowed function', '  A: ${{ toJSON(runner) }}'],
    ['a bare context inside a comparison', "  A: ${{ matrix == 'x' }}"],
  ])('rejects %s', (_label, line) => {
    expect(workflowLevelEnvironmentLineIsRejected(line)).toBe(true);
  });

  test.each([
    ['secrets', '  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}'],
    ['vars', '  TURBO_TEAM: ${{ vars.TURBO_TEAM }}'],
    ['a deep github path', '  A: ${{ github.event.pull_request.number }}'],
    ['github with bracket access mid-chain', "  A: ${{ github['event'].pull_request.number }}"],
    ['github inside an interpolated string', '  TURBO_SCM_BASE: origin/${{ github.base_ref }}'],
    ['an always-available function', "  A: ${{ format('{0}', github.sha) }}"],
    ['toJSON over an allowed context', '  A: ${{ toJSON(github.event) }}'],
    ['a bare allowed context', '  A: ${{ github }}'],
    ['a boolean literal', '  A: ${{ true }}'],
    ['a comparison against an allowed context', "  A: ${{ inputs.mode == 'full' }}"],
    ['a dotted string literal argument', "  A: ${{ format('{0}.{1}', github.a, github.b) }}"],
    [
      'a boolean expression over github',
      '  A: ${{ github.event_name && github.sha || github.ref }}',
    ],
    ['a plain value with no expression', '  BUN_VERSION: 1.3.13'],
  ])('allows %s', (_label, line) => {
    expect(workflowLevelEnvironmentLineIsRejected(line)).toBe(false);
  });

  test('reports only the root of a chain, not every segment', () => {
    expect(workflowExpressionContextRoots('  A: ${{ github.event.pull_request.number }}')).toEqual([
      'github',
    ]);
  });

  test('collects a root from each expression on one line', () => {
    expect(workflowExpressionContextRoots('  A: ${{ github.sha }}-${{ runner.os }}')).toEqual([
      'github',
      'runner',
    ]);
  });
});

describe('workflow-level env block scanning', () => {
  test('collects entries in the top-level env block only', () => {
    const workflow = [
      'name: example',
      'env:',
      '  TOP: ${{ vars.A }}',
      'jobs:',
      '  build:',
      '    env:',
      '      JOB_LEVEL: ${{ runner.os }}',
      '    steps:',
      '      - run: echo hi',
    ].join('\n');

    // The job-level `runner.os` is legal and must NOT be collected — collecting
    // it would make the guard reject valid workflows.
    expect(workflowLevelEnvironmentLines(workflow)).toEqual(['  TOP: ${{ vars.A }}']);
  });

  // Regression: a column-0 comment used to be read as the next top-level key,
  // ending the scan and letting everything after it bypass the guard entirely.
  test('keeps scanning past a comment at column zero', () => {
    const workflow = [
      'env:',
      '  FIRST: ${{ vars.A }}',
      '# an unindented comment is legal YAML inside the block',
      '  SECOND: ${{ runner.os }}',
    ].join('\n');

    expect(workflowLevelEnvironmentLines(workflow)).toEqual([
      '  FIRST: ${{ vars.A }}',
      '  SECOND: ${{ runner.os }}',
    ]);
  });

  test('keeps scanning past a blank line inside the block', () => {
    const workflow = ['env:', '  FIRST: ${{ vars.A }}', '', '  SECOND: ${{ runner.os }}'].join(
      '\n',
    );

    expect(workflowLevelEnvironmentLines(workflow)).toEqual([
      '  FIRST: ${{ vars.A }}',
      '  SECOND: ${{ runner.os }}',
    ]);
  });

  test('stops at the next real top-level key', () => {
    const workflow = ['env:', '  FIRST: ${{ vars.A }}', 'on:', '  push: {}'].join('\n');

    expect(workflowLevelEnvironmentLines(workflow)).toEqual(['  FIRST: ${{ vars.A }}']);
  });

  test('returns nothing when there is no workflow-level env block', () => {
    expect(workflowLevelEnvironmentLines('name: example\non:\n  push: {}')).toEqual([]);
  });

  // A flow mapping lives entirely on the key's own line. A scanner that only
  // looked at indented lines would open the block, skip this line as the key,
  // then close at the next top-level key having inspected nothing.
  test('inspects an inline flow mapping', () => {
    const workflow = ['env: { TURBO_PLATFORM: "${{ runner.os }}" }', 'on:', '  push: {}'].join(
      '\n',
    );

    expect(workflowLevelEnvironmentLines(workflow)).toEqual([
      'env: { TURBO_PLATFORM: "${{ runner.os }}" }',
    ]);
  });

  test('does not treat a flow mapping as an open block', () => {
    const workflow = [
      'env: { A: ${{ vars.A }} }',
      'jobs:',
      '  build:',
      '    x: ${{ runner.os }}',
    ].join('\n');

    // The job-level line must not leak in just because a flow mapping preceded it.
    expect(workflowLevelEnvironmentLines(workflow)).toEqual(['env: { A: ${{ vars.A }} }']);
  });
});

describe('validate-release-workflow changeset guards', () => {
  test('requires artifact and publish commands for every public package', () => {
    const workflow = {
      jobs: {
        release: {
          steps: [
            {
              run: [
                'bun run --filter=@lostgradient/markdown validate:consumer',
                'bun run --filter=@lostgradient/markdown package:weight:check -- --existing-tarball',
                'bun run --filter=@lostgradient/markdown publish:release -- --skip-validation',
                'bun run --filter=@lostgradient/cinder validate:consumer',
                'bun run --filter=@lostgradient/cinder package:weight:check -- --existing-tarball',
                'bun run --filter=@lostgradient/cinder publish:release -- --skip-validation',
                'bun run --filter=@lostgradient/cinder-mcp validate:consumer',
                'bun run --filter=@lostgradient/cinder-mcp package:weight:check -- --existing-tarball',
                'bun run --filter=@lostgradient/cinder-mcp publish:release -- --skip-validation',
                'bun run --filter=@lostgradient/editor validate:consumer',
                'bun run --filter=@lostgradient/editor package:weight:check -- --existing-tarball',
                'bun run --filter=@lostgradient/editor publish:release -- --skip-validation',
                'bun run --filter=@lostgradient/chat validate:consumer',
                'bun run --filter=@lostgradient/chat publish:release -- --skip-validation',
              ].join('\n'),
            },
          ],
        },
      },
    };

    expect(findMissingPublicPackageReleaseCommands(workflow)).toEqual([
      'bun run --filter=@lostgradient/chat package:weight:check',
    ]);
  });

  test('requires Markdown to publish before Cinder before cinder-mcp before Editor before Chat', () => {
    const workflow = (commands: string[]) => ({
      jobs: { release: { steps: commands.map((run) => ({ run })) } },
    });
    const markdown = 'bun run --filter=@lostgradient/markdown publish:release -- --skip-validation';
    const cinder = 'bun run --filter=@lostgradient/cinder publish:release -- --skip-validation';
    const mcp = 'bun run --filter=@lostgradient/cinder-mcp publish:release -- --skip-validation';
    const editor = 'bun run --filter=@lostgradient/editor publish:release -- --skip-validation';
    const chat = 'bun run --filter=@lostgradient/chat publish:release -- --skip-validation';

    expect(publicPackagePublishOrderIsValid(workflow([markdown, cinder, mcp, editor, chat]))).toBe(
      true,
    );
    expect(publicPackagePublishOrderIsValid(workflow([chat, editor, mcp, cinder, markdown]))).toBe(
      false,
    );
    expect(publicPackagePublishOrderIsValid(workflow([markdown, chat, cinder, mcp, editor]))).toBe(
      false,
    );
    expect(publicPackagePublishOrderIsValid(workflow([cinder, markdown, mcp, editor, chat]))).toBe(
      false,
    );
    expect(publicPackagePublishOrderIsValid(workflow([markdown, cinder, mcp, chat, editor]))).toBe(
      false,
    );
    // cinder-mcp published before cinder must fail even when every other pair is in order.
    expect(publicPackagePublishOrderIsValid(workflow([markdown, mcp, cinder, editor, chat]))).toBe(
      false,
    );
  });

  test('builds Cinder before Chat in fresh-checkout coverage workflows', () => {
    // Both workflows now build Cinder and Chat through a single `turbo run
    // build --filter=... --filter=...` invocation rather than two sequential
    // `bun run --filter=<pkg> build` commands — Cinder-before-Chat ordering
    // is enforced structurally by turbo's dependency graph (`build`
    // `dependsOn: ["^build"]`, and Chat depends on Cinder), not by which
    // `--filter` flag appears first in the command text. What this test can
    // still pin textually: a turbo build step exists covering both packages,
    // and Chat's coverage test step appears after it in the workflow file.
    const workspaceRoot = resolve(import.meta.dirname, '../../..');
    for (const workflowName of ['unit-tests.yaml', 'main-green.yaml']) {
      const workflow = readFileSync(
        join(workspaceRoot, '.github', 'workflows', workflowName),
        'utf8',
      );
      const buildStepIndex = workflow.indexOf('turbo run build');
      expect(buildStepIndex).toBeGreaterThan(-1);

      // Bound the search to the build step's OWN block — the next `- name:`
      // step (at the same indentation as a job step) or end of file —
      // instead of "anywhere later in the workflow". Without this bound, a
      // regression to a Chat-only build filter would still pass by matching
      // `--filter=@lostgradient/cinder` from an unrelated later step (e.g.
      // an audit or test step).
      const nextStepMatch = /\n {6}- name:/.exec(workflow.slice(buildStepIndex));
      const buildStepEnd =
        nextStepMatch === undefined || nextStepMatch === null
          ? workflow.length
          : buildStepIndex + nextStepMatch.index;
      const buildStepBlock = workflow.slice(buildStepIndex, buildStepEnd);

      // Both packages must be filter targets of the SAME build step — not
      // just Chat — or a regression to a Chat-only filter would still pass.
      expect(buildStepBlock).toContain('--filter=@lostgradient/cinder');
      expect(buildStepBlock).toContain('--filter=@lostgradient/chat');

      const chatCoverageIndex = workflow.indexOf(
        'turbo run test:coverage --filter=@lostgradient/chat',
      );
      expect(chatCoverageIndex).toBeGreaterThan(buildStepIndex);
    }
  });

  test('requires the root publish shortcut to use staged package artifacts in order', () => {
    const manifest = (script: string) => ({ scripts: { 'changeset:publish': script } });
    const markdown = 'bun run --filter=@lostgradient/markdown publish:release';
    const cinder = 'bun run --filter=@lostgradient/cinder publish:release';
    const mcp = 'bun run --filter=@lostgradient/cinder-mcp publish:release';
    const editor = 'bun run --filter=@lostgradient/editor publish:release';
    const chat = 'bun run --filter=@lostgradient/chat publish:release';

    expect(
      rootPublishScriptUsesStagedPackers(
        manifest(`${markdown} && ${cinder} && ${mcp} && ${editor} && ${chat}`),
      ),
    ).toBe(true);
    expect(rootPublishScriptUsesStagedPackers(manifest('changeset publish'))).toBe(false);
    expect(
      rootPublishScriptUsesStagedPackers(
        manifest(`${chat} && ${editor} && ${mcp} && ${cinder} && ${markdown}`),
      ),
    ).toBe(false);
    expect(
      rootPublishScriptUsesStagedPackers(manifest(`${cinder} && ${mcp} && ${editor} && ${chat}`)), // missing markdown
    ).toBe(false);
  });

  test('keeps root source validation separate from the packed-consumer release gate', () => {
    const manifest = (validate: string, validateConsumer: string) => ({
      scripts: { validate, 'validate:consumer': validateConsumer },
    });
    const markdown = 'bun run --filter=@lostgradient/markdown validate:consumer';
    const cinder = 'bun run --filter=@lostgradient/cinder validate:consumer';
    const mcp = 'bun run --filter=@lostgradient/cinder-mcp validate:consumer';
    const editor = 'bun run --filter=@lostgradient/editor validate:consumer';
    const chat = 'bun run --filter=@lostgradient/chat validate:consumer';

    expect(
      rootValidationSeparatesSourceAndConsumerGates(
        manifest(
          'turbo run validate --concurrency=1',
          `${markdown} && ${cinder} && ${mcp} && ${editor} && ${chat}`,
        ),
      ),
    ).toBe(true);
    expect(
      rootValidationSeparatesSourceAndConsumerGates(
        manifest(
          `turbo run validate --concurrency=1 && ${chat}`,
          `${markdown} && ${cinder} && ${mcp} && ${editor} && ${chat}`,
        ),
      ),
    ).toBe(false);
    expect(
      rootValidationSeparatesSourceAndConsumerGates(
        manifest('turbo run validate --concurrency=1', cinder),
      ),
    ).toBe(false);
    expect(
      rootValidationSeparatesSourceAndConsumerGates(
        manifest(
          `bun run --filter='*' validate && ${chat}`,
          `${markdown} && ${cinder} && ${mcp} && ${chat}`,
        ),
      ),
    ).toBe(false);
    // A `turbo run validate` missing `--concurrency=1` must fail: without it,
    // turbo parallelizes independent packages by default, reintroducing the
    // concurrent-load fragility the old --sequential flag guarded against
    // (the playground's dev-server-backed validate step in particular).
    expect(
      rootValidationSeparatesSourceAndConsumerGates(
        manifest('turbo run validate', `${markdown} && ${cinder} && ${mcp} && ${chat}`),
      ),
    ).toBe(false);
  });

  test('requires the manual Chat bootstrap to preflight its Cinder and Markdown peers', () => {
    const workflow = (run: string) => ({
      jobs: {
        publish: {
          steps: [{ if: "inputs.package == 'chat'", run }],
        },
      },
    });
    const peerLookup = [
      "for peer in '@lostgradient/cinder' '@lostgradient/markdown'; do",
      'peer_range="$(jq -er --arg peer "$peer" \'.peerDependencies[$peer]\' packages/chat/package.json)"',
      'npm view "${peer}@${peer_range}" version --json',
      'echo "::error::Publish ${peer} first"',
    ].join('\n');

    expect(manualChatBootstrapHasPeerRegistryPreflight(workflow(peerLookup))).toBe(true);
    // Rejects the old single-inline-peer shape that only checked Cinder.
    expect(
      manualChatBootstrapHasPeerRegistryPreflight(
        workflow('npm view "@lostgradient/cinder@${cinder_peer_range}" version --json'),
      ),
    ).toBe(false);
  });

  test('requires the manual Cinder bootstrap to preflight its Markdown dependency', () => {
    const workflow = (run: string) => ({
      jobs: {
        publish: {
          steps: [{ if: "inputs.package == 'cinder'", run }],
        },
      },
    });
    const markdownLookup = [
      'markdown_version="$(jq -er \'.version\' packages/markdown/package.json)"',
      'npm view "@lostgradient/markdown@^${markdown_version}" version --json',
      'echo "::error::Publish Markdown first"',
    ].join('\n');

    expect(manualCinderBootstrapHasMarkdownRegistryPreflight(workflow(markdownLookup))).toBe(true);
    expect(
      manualCinderBootstrapHasMarkdownRegistryPreflight(
        workflow('npm view "@lostgradient/markdown" version --json'),
      ),
    ).toBe(false);
  });

  test('requires the manual cinder-mcp bootstrap to preflight its Cinder dependency', () => {
    const workflow = (run: string) => ({
      jobs: {
        publish: {
          steps: [{ if: "inputs.package == 'mcp'", run }],
        },
      },
    });
    const cinderLookup = [
      'cinder_version="$(jq -er \'.version\' packages/components/package.json)"',
      'npm view "@lostgradient/cinder@^${cinder_version}" version --json',
      'echo "::error::Publish Cinder first"',
    ].join('\n');

    expect(manualMcpBootstrapHasCinderRegistryPreflight(workflow(cinderLookup))).toBe(true);
    expect(
      manualMcpBootstrapHasCinderRegistryPreflight(
        workflow('npm view "@lostgradient/cinder" version --json'),
      ),
    ).toBe(false);
  });

  test('the stock Changesets plan keeps both public releases pre-1.0 minors', async () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'cinder-release-plan-'));
    const changesetDirectory = join(temporaryDirectory, '.changeset');
    const cinderDirectory = join(temporaryDirectory, 'packages/components');
    const chatDirectory = join(temporaryDirectory, 'packages/chat');

    try {
      mkdirSync(changesetDirectory, { recursive: true });
      mkdirSync(cinderDirectory, { recursive: true });
      mkdirSync(chatDirectory, { recursive: true });
      writeFileSync(
        join(temporaryDirectory, 'package.json'),
        `${JSON.stringify(
          {
            name: 'release-plan-fixture',
            version: '0.0.0',
            private: true,
            workspaces: ['packages/*'],
          },
          null,
          2,
        )}\n`,
      );
      writeFileSync(
        join(cinderDirectory, 'package.json'),
        `${JSON.stringify({ name: '@lostgradient/cinder', version: '0.15.0' }, null, 2)}\n`,
      );
      writeFileSync(
        join(chatDirectory, 'package.json'),
        `${JSON.stringify(
          {
            name: '@lostgradient/chat',
            version: '0.0.0',
            peerDependencies: { '@lostgradient/cinder': '^0.16.0' },
          },
          null,
          2,
        )}\n`,
      );
      writeFileSync(
        join(changesetDirectory, 'config.json'),
        `${JSON.stringify(
          {
            changelog: false,
            commit: false,
            fixed: [],
            linked: [],
            access: 'public',
            baseBranch: 'main',
            updateInternalDependencies: 'patch',
            bumpVersionsWithWorkspaceProtocolOnly: true,
            ignore: [],
            privatePackages: { version: true, tag: false },
          },
          null,
          2,
        )}\n`,
      );
      writeFileSync(
        join(changesetDirectory, 'extract-chat-package.md'),
        `---
'@lostgradient/cinder': minor
'@lostgradient/chat': minor
---

Extract Chat into its own package.
`,
      );

      const releasePlan = await getReleasePlan(temporaryDirectory);
      expect(releasePlan).toMatchObject({
        releases: expect.arrayContaining([
          expect.objectContaining({
            name: '@lostgradient/cinder',
            type: 'minor',
            oldVersion: '0.15.0',
            newVersion: '0.16.0',
          }),
          expect.objectContaining({
            name: '@lostgradient/chat',
            type: 'minor',
            oldVersion: '0.0.0',
            newVersion: '0.1.0',
          }),
        ]),
      });
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test('finds permissions only in workflow or job permission blocks', () => {
    expect(
      workflowDeclaresPermission(
        {
          permissions: {
            actions: 'read',
          },
        },
        'actions',
        'read',
      ),
    ).toBe(true);

    expect(
      workflowDeclaresPermission(
        {
          jobs: {
            release: {
              permissions: {
                checks: 'read',
              },
            },
          },
        },
        'checks',
        'read',
      ),
    ).toBe(true);

    expect(
      workflowDeclaresPermission(
        {
          reactions: 'read',
          jobs: {
            release: {
              permissions: {
                contents: 'read',
              },
            },
          },
        },
        'actions',
        'read',
      ),
    ).toBe(false);
  });

  test('finds generated pull request workflows that are not explicitly dispatched', () => {
    const workflow = {
      jobs: {
        release: {
          steps: [
            {
              run: [
                '# gh workflow run unit-tests.yaml --ref "$release_branch"',
                'gh workflow run browser-tests.yaml --ref "$release_branch"',
              ].join('\n'),
            },
          ],
        },
      },
    };

    expect(
      findMissingWorkflowDispatches(workflow, [
        'unit-tests.yaml',
        'browser-tests.yaml',
        'changeset-guard.yaml',
      ]),
    ).toEqual(['unit-tests.yaml', 'changeset-guard.yaml']);
  });

  test('finds workflow actions that still target deprecated Node 20 majors', () => {
    expect(
      findOutdatedWorkflowActions({
        'release.yml':
          'uses: "actions/checkout@v6.1.0" # upgrade required\nuses: actions/setup-node@v5\nuses: oven-sh/setup-bun@v2\n',
        'unit-tests.yaml':
          'uses: actions/cache/restore@v5\nuses: actions/cache/save@v6\nuses: actions/upload-artifact@v5\nuses: marocchino/sticky-pull-request-comment@v2\n',
      }),
    ).toEqual([
      'release.yml: actions/checkout@v6.1.0',
      'release.yml: actions/setup-node@v5',
      'unit-tests.yaml: actions/cache/restore@v5',
      'unit-tests.yaml: actions/upload-artifact@v5',
      'unit-tests.yaml: marocchino/sticky-pull-request-comment@v2',
    ]);
  });

  test('requires manual deploys to default to preview', () => {
    expect(
      workflowDispatchInputHasDefault(
        {
          on: {
            workflow_dispatch: {
              inputs: {
                environment: { default: 'preview' },
              },
            },
          },
        },
        'environment',
        'preview',
      ),
    ).toBe(true);

    expect(
      workflowDispatchInputHasDefault(
        { on: { workflow_dispatch: { inputs: { environment: { default: 'production' } } } } },
        'environment',
        'preview',
      ),
    ).toBe(false);

    expect(
      workflowRunScriptsContainActiveLine(
        {
          jobs: { deploy: { steps: [{ run: "echo safe # inputs.environment == 'production'" }] } },
        },
        "inputs.environment == 'production'",
      ),
    ).toBe(false);
  });

  test('requires the production dispatch expression on an active run line', () => {
    expect(
      workflowRunScriptsContainActiveLine(
        {
          jobs: {
            deploy: {
              steps: [{ run: "# inputs.environment == 'production'" }],
            },
          },
        },
        "inputs.environment == 'production'",
      ),
    ).toBe(false);

    expect(
      workflowRunScriptsContainActiveLine(
        {
          jobs: {
            deploy: {
              steps: [{ run: 'if [ "${{ inputs.environment == \'production\' }}" = true ]; then' }],
            },
          },
        },
        "inputs.environment == 'production'",
      ),
    ).toBe(true);
  });

  test('parses package names from changeset front matter', () => {
    expect(
      parseChangesetPackageNames(`---
'@lostgradient/cinder': minor
'@cinder/playground': patch
---

Release notes.
`),
    ).toEqual(['@lostgradient/cinder', '@cinder/playground']);
  });

  test('reports malformed changeset front matter with a targeted error', () => {
    expect(() =>
      parseChangesetPackageNames(`---
'@cinder/playground': [
---

Broken release note.
`),
    ).toThrow(/changeset has invalid YAML front matter/);
  });

  test('reports pending changesets for ignored packages', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'cinder-release-workflow-'));
    const changesetDirectory = join(temporaryDirectory, '.changeset');

    try {
      mkdirSync(changesetDirectory);
      writeFileSync(join(changesetDirectory, 'README.md'), '# Changesets\n');
      writeFileSync(
        join(changesetDirectory, 'public-package.md'),
        `---
'@lostgradient/cinder': patch
---

Public package release note.
`,
      );
      writeFileSync(
        join(changesetDirectory, 'playground-only.md'),
        `---
'@cinder/playground': patch
---

Private playground note.
`,
      );

      expect(
        findIgnoredPackageChangesets(changesetDirectory, ['@cinder/playground']).map(
          (changeset) => ({
            fileName: basename(changeset.filePath),
            packages: changeset.packages,
          }),
        ),
      ).toEqual([{ fileName: 'playground-only.md', packages: ['@cinder/playground'] }]);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test('ignores normal public-package changesets', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'cinder-release-workflow-'));
    const changesetDirectory = join(temporaryDirectory, '.changeset');

    try {
      mkdirSync(changesetDirectory);
      writeFileSync(
        join(changesetDirectory, 'public-package.md'),
        `---
'@lostgradient/cinder': patch
---

Public package release note.
`,
      );

      expect(findIgnoredPackageChangesets(changesetDirectory, ['@cinder/playground'])).toEqual([]);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
