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
  manualChatBootstrapHasCinderRegistryPreflight,
  parseChangesetPackageNames,
  publicPackagePublishOrderIsValid,
  rootConsumerValidationIncludesPublicPackages,
  rootPublishScriptUsesStagedPackers,
  workflowDeclaresPermission,
  workflowDispatchInputHasDefault,
  workflowRunScriptsContainActiveLine,
} from './validate-release-workflow.ts';

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

  test('requires Markdown to publish before Cinder before Chat', () => {
    const workflow = (commands: string[]) => ({
      jobs: { release: { steps: commands.map((run) => ({ run })) } },
    });
    const markdown = 'bun run --filter=@lostgradient/markdown publish:release -- --skip-validation';
    const cinder = 'bun run --filter=@lostgradient/cinder publish:release -- --skip-validation';
    const chat = 'bun run --filter=@lostgradient/chat publish:release -- --skip-validation';

    expect(publicPackagePublishOrderIsValid(workflow([markdown, cinder, chat]))).toBe(true);
    expect(publicPackagePublishOrderIsValid(workflow([chat, cinder, markdown]))).toBe(false);
    expect(publicPackagePublishOrderIsValid(workflow([markdown, chat, cinder]))).toBe(false);
    expect(publicPackagePublishOrderIsValid(workflow([cinder, markdown, chat]))).toBe(false);
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
    const chat = 'bun run --filter=@lostgradient/chat publish:release';

    expect(
      rootPublishScriptUsesStagedPackers(manifest(`${markdown} && ${cinder} && ${chat}`)),
    ).toBe(true);
    expect(rootPublishScriptUsesStagedPackers(manifest('changeset publish'))).toBe(false);
    expect(
      rootPublishScriptUsesStagedPackers(manifest(`${chat} && ${cinder} && ${markdown}`)),
    ).toBe(false);
    expect(
      rootPublishScriptUsesStagedPackers(manifest(`${cinder} && ${chat}`)), // missing markdown
    ).toBe(false);
  });

  test('requires the root validation gate to exercise every packed public package', () => {
    const manifest = (validate: string, validateConsumer: string) => ({
      scripts: { validate, 'validate:consumer': validateConsumer },
    });
    const markdown = 'bun run --filter=@lostgradient/markdown validate:consumer';
    const cinder = 'bun run --filter=@lostgradient/cinder validate:consumer';
    const chat = 'bun run --filter=@lostgradient/chat validate:consumer';

    expect(
      rootConsumerValidationIncludesPublicPackages(
        manifest(
          `turbo run validate --concurrency=1 && ${chat}`,
          `${markdown} && ${cinder} && ${chat}`,
        ),
      ),
    ).toBe(true);
    expect(
      rootConsumerValidationIncludesPublicPackages(
        manifest(`turbo run validate --concurrency=1 && ${chat}`, cinder),
      ),
    ).toBe(false);
    expect(
      rootConsumerValidationIncludesPublicPackages(
        manifest('turbo run validate --concurrency=1', `${markdown} && ${cinder} && ${chat}`),
      ),
    ).toBe(false);
    expect(
      rootConsumerValidationIncludesPublicPackages(
        manifest(`bun run --filter='*' validate && ${chat}`, `${markdown} && ${cinder} && ${chat}`),
      ),
    ).toBe(false);
    // A `turbo run validate` missing `--concurrency=1` must fail: without it,
    // turbo parallelizes independent packages by default, reintroducing the
    // concurrent-load fragility the old --sequential flag guarded against
    // (the playground's dev-server-backed validate step in particular).
    expect(
      rootConsumerValidationIncludesPublicPackages(
        manifest(`turbo run validate && ${chat}`, `${cinder} && ${chat}`),
      ),
    ).toBe(false);
  });

  test('requires the manual Chat bootstrap to preflight its Cinder peer', () => {
    const workflow = (run: string) => ({
      jobs: {
        publish: {
          steps: [{ if: "inputs.package == 'chat'", run }],
        },
      },
    });
    const peerLookup = [
      'cinder_peer_range="$(jq -er \'.peerDependencies["@lostgradient/cinder"]\' packages/chat/package.json)"',
      'npm view "@lostgradient/cinder@${cinder_peer_range}" version --json',
      'echo "::error::Publish Cinder first"',
    ].join('\n');

    expect(manualChatBootstrapHasCinderRegistryPreflight(workflow(peerLookup))).toBe(true);
    expect(
      manualChatBootstrapHasCinderRegistryPreflight(
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
