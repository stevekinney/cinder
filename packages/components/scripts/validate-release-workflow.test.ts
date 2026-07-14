import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import {
  findIgnoredPackageChangesets,
  findMissingWorkflowDispatches,
  findOutdatedWorkflowActions,
  parseChangesetPackageNames,
  workflowDeclaresPermission,
  workflowDispatchInputHasDefault,
  workflowRunScriptsContainActiveLine,
} from './validate-release-workflow.ts';

describe('validate-release-workflow changeset guards', () => {
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
        'release.yml': 'uses: actions/checkout@v4 # upgrade required\nuses: oven-sh/setup-bun@v2\n',
        'unit-tests.yaml':
          'uses: actions/cache/restore@v4\nuses: actions/cache/save@v6\nuses: actions/upload-artifact@v5\nuses: marocchino/sticky-pull-request-comment@v2\n',
      }),
    ).toEqual([
      'release.yml: actions/checkout@v4',
      'unit-tests.yaml: actions/cache/restore@v4',
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
