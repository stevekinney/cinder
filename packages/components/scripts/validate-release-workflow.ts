/**
 * validate-release-workflow.ts
 *
 * Guards the primary release workflow against reintroducing long-lived npm tokens
 * on the Trusted Publishing publish path. Fails loudly if NODE_AUTH_TOKEN or
 * NPM_TOKEN appear anywhere in .github/workflows/release.yaml (outside comments).
 *
 * What this checks:
 *   - The file .github/workflows/release.yaml is present.
 *   - The file has `id-token: write` (the OIDC permission required for Trusted
 *     Publishing) somewhere in its permissions declarations.
 *   - The release workflow can dispatch every validation workflow required by
 *     a Changesets-created pull request, whose GITHUB_TOKEN-originated events
 *     otherwise require manual approval.
 *   - Manual playground dispatches default to preview, so release validation
 *     cannot accidentally deploy a version branch to production.
 *   - Workflow actions use Node 24-compatible majors instead of deprecated
 *     Node 20 action runtimes.
 *   - The primary publish step (the `run: bun run --filter=@lostgradient/cinder publish:release`
 *     step) does NOT have NODE_AUTH_TOKEN or NPM_TOKEN in its `env:` block
 *     (precise, well-messaged check).
 *   - NODE_AUTH_TOKEN / NPM_TOKEN do NOT appear anywhere else in release.yaml
 *     either — a token in a JOB-level or WORKFLOW-level `env:` block would be
 *     inherited by the publish step without appearing in the step's own lines,
 *     so the whole-file check closes that evasion path. Comment lines are
 *     allowed (they document the OIDC rationale).
 *   - release-manual.yaml is NOT checked — that file intentionally uses a token
 *     as a documented break-glass fallback.
 *   - Pending changeset files do NOT target packages listed in
 *     `.changeset/config.json` `ignore`. Ignored-package changesets are never
 *     consumed by `changeset version`, but `changesets/action` still treats them
 *     as pending release work and tries to open another release pull request.
 *
 * What this does NOT check:
 *   - Whether the npm registry has a Trusted Publisher configured (that is a
 *     manual registry-side action; see CONTRIBUTING.md § Publishing to npm).
 *   - Whether npm >= 11.5.1 is installed at runtime (validated by the workflow
 *     itself via the "Upgrade npm" step; this script only inspects YAML structure).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { load as loadYaml } from 'js-yaml';

import { isObjectRecord } from './validation-utilities.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(packageRoot, '../..');
const workflowsDirectoryPath = join(workspaceRoot, '.github/workflows');
const releaseWorkflowPath = join(workspaceRoot, '.github/workflows/release.yaml');
const deployPlaygroundWorkflowPath = join(
  workspaceRoot,
  '.github/workflows/deploy-playground.yaml',
);
const changesetsConfigurationPath = join(workspaceRoot, '.changeset/config.json');
const changesetDirectoryPath = join(workspaceRoot, '.changeset');

export type IgnoredPackageChangeset = {
  filePath: string;
  packages: string[];
};

function fail(message: string): never {
  process.stderr.write(`[validate-release-workflow] FAIL: ${message}\n`);
  process.exit(1);
}

function pass(message: string): void {
  process.stdout.write(`[validate-release-workflow] PASS: ${message}\n`);
}

/**
 * Whether a YAML line is a comment. We treat any line whose first non-whitespace
 * character is `#` as a comment so that documentation (e.g. the explanatory note
 * about setup-node's _authToken, or a `# id-token: write` example) can never
 * satisfy OR defeat a guard. This intentionally does not handle inline trailing
 * `#` comments after real YAML — none of the patterns we scan for legitimately
 * appear mid-line after a value, and a real `id-token: write` or `- name:` is
 * never written as a trailing comment.
 */
function isComment(line: string): boolean {
  return line.trimStart().startsWith('#');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function errorMessageFrom(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : String(error);
}

function loadIgnoredChangesetPackages(configurationPath: string): string[] {
  let rawConfiguration: string;
  try {
    rawConfiguration = readFileSync(configurationPath, 'utf8');
  } catch {
    fail(`changesets configuration not found at ${configurationPath}`);
  }

  let parsedConfiguration: unknown;
  try {
    parsedConfiguration = JSON.parse(rawConfiguration);
  } catch {
    fail(`changesets configuration at ${configurationPath} is not valid JSON`);
  }

  if (!isObjectRecord(parsedConfiguration)) {
    fail(`changesets configuration at ${configurationPath} is not a JSON object`);
  }

  const ignoredPackages = parsedConfiguration['ignore'];
  if (ignoredPackages === undefined) return [];
  if (!isStringArray(ignoredPackages)) {
    fail('changesets configuration `ignore` must be an array of package names');
  }
  return ignoredPackages;
}

export function parseChangesetPackageNames(
  markdown: string,
  changesetLabel = 'changeset',
): string[] {
  const frontmatterMatch = /^---\r?\n(?<frontmatter>[\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  const frontmatter = frontmatterMatch?.groups?.['frontmatter'];
  if (frontmatter === undefined) return [];

  let parsedFrontmatter: unknown;
  try {
    parsedFrontmatter = loadYaml(frontmatter);
  } catch (error) {
    throw new Error(`${changesetLabel} has invalid YAML front matter: ${errorMessageFrom(error)}`, {
      cause: error,
    });
  }

  if (!isObjectRecord(parsedFrontmatter)) return [];

  return Object.entries(parsedFrontmatter)
    .filter(([, releaseType]) => typeof releaseType === 'string')
    .map(([packageName]) => packageName);
}

export function findIgnoredPackageChangesets(
  changesetDirectory: string,
  ignoredPackages: readonly string[],
): IgnoredPackageChangeset[] {
  const ignoredPackageSet = new Set(ignoredPackages);
  if (ignoredPackageSet.size === 0 || !existsSync(changesetDirectory)) return [];

  return readdirSync(changesetDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
    .flatMap((entry) => {
      const filePath = join(changesetDirectory, entry.name);
      const ignoredChangesetPackages = parseChangesetPackageNames(
        readFileSync(filePath, 'utf8'),
        filePath,
      ).filter((packageName) => ignoredPackageSet.has(packageName));

      return ignoredChangesetPackages.length > 0
        ? [{ filePath, packages: ignoredChangesetPackages }]
        : [];
    });
}

function permissionsDeclare(
  permissions: unknown,
  permissionName: string,
  expectedAccess: string,
): boolean {
  return isObjectRecord(permissions) && permissions[permissionName] === expectedAccess;
}

export function workflowDeclaresPermission(
  workflow: unknown,
  permissionName: string,
  expectedAccess: string,
): boolean {
  if (!isObjectRecord(workflow)) return false;

  if (permissionsDeclare(workflow['permissions'], permissionName, expectedAccess)) return true;

  const jobs = workflow['jobs'];
  if (!isObjectRecord(jobs)) return false;

  return Object.values(jobs).some(
    (job) =>
      isObjectRecord(job) && permissionsDeclare(job['permissions'], permissionName, expectedAccess),
  );
}

function workflowRunScripts(workflow: unknown): string[] {
  if (!isObjectRecord(workflow) || !isObjectRecord(workflow['jobs'])) return [];

  return Object.values(workflow['jobs']).flatMap((job) => {
    if (!isObjectRecord(job) || !Array.isArray(job['steps'])) return [];
    return job['steps'].flatMap((step) =>
      isObjectRecord(step) && typeof step['run'] === 'string' ? [step['run']] : [],
    );
  });
}

export function findMissingWorkflowDispatches(
  workflow: unknown,
  requiredWorkflows: readonly string[],
): string[] {
  const runScripts = workflowRunScripts(workflow);
  return requiredWorkflows.filter(
    (requiredWorkflow) =>
      !runScripts.some((script) =>
        script.split('\n').some((line) => {
          const command = line.trim();
          return (
            !command.startsWith('#') &&
            command.startsWith(`gh workflow run ${requiredWorkflow} `) &&
            command.includes('--ref')
          );
        }),
      ),
  );
}

export function findOutdatedWorkflowActions(
  workflowContents: Readonly<Record<string, string>>,
): string[] {
  const outdatedActionPattern =
    /^\s*uses:\s*(actions\/checkout@v[1-4]|actions\/cache(?:\/restore|\/save)?@v[1-4]|oven-sh\/setup-bun@v1)(?:\s+#.*)?\s*$/gm;

  return Object.entries(workflowContents).flatMap(([workflowName, content]) =>
    [...content.matchAll(outdatedActionPattern)].map(
      (match) => `${workflowName}: ${match[1] ?? 'unknown action'}`,
    ),
  );
}

export function workflowDispatchInputHasDefault(
  workflow: unknown,
  inputName: string,
  expectedDefault: string,
): boolean {
  if (!isObjectRecord(workflow) || !isObjectRecord(workflow['on'])) return false;
  const workflowDispatch = workflow['on']['workflow_dispatch'];
  if (!isObjectRecord(workflowDispatch) || !isObjectRecord(workflowDispatch['inputs']))
    return false;
  const input = workflowDispatch['inputs'][inputName];
  return isObjectRecord(input) && input['default'] === expectedDefault;
}

function runValidation(): void {
  const workflowContent = (() => {
    try {
      return readFileSync(releaseWorkflowPath, 'utf8');
    } catch {
      fail(`release workflow not found at ${releaseWorkflowPath}`);
    }
  })();

  const lines = workflowContent.split('\n');
  let parsedWorkflow: unknown;
  try {
    parsedWorkflow = loadYaml(workflowContent);
  } catch (error) {
    fail(`release.yaml is not valid YAML: ${errorMessageFrom(error)}`);
  }

  // ── Guard 1: id-token: write must be present ────────────────────────────────
  if (!workflowDeclaresPermission(parsedWorkflow, 'id-token', 'write')) {
    fail(
      'release.yaml is missing `id-token: write`. The primary publish path requires this ' +
        'OIDC permission for npm Trusted Publishing.',
    );
  }
  pass('id-token: write is present');

  if (!workflowDeclaresPermission(parsedWorkflow, 'actions', 'write')) {
    fail(
      'release.yaml is missing `actions: write`. The version path must dispatch validation ' +
        'for Changesets-created pull requests, and the publish path must inspect main-green.',
    );
  }
  pass('actions: write is present');

  if (!workflowDeclaresPermission(parsedWorkflow, 'checks', 'read')) {
    fail(
      'release.yaml is missing `checks: read`. `gh run watch` needs read access to follow ' +
        'the same-SHA main-green workflow run before publishing.',
    );
  }
  pass('checks: read is present');

  const hasMainGreenPublishGate =
    workflowContent.includes('Wait for main-green source validation') &&
    workflowContent.includes("steps.changesets.outputs.hasChangesets == 'false'") &&
    workflowContent.includes('--workflow main-green.yaml') &&
    workflowContent.includes('gh run watch "$main_green_run_id" --exit-status');

  if (!hasMainGreenPublishGate) {
    fail(
      'release.yaml must wait for the same-SHA main-green run before publishing. ' +
        'Keep source validation centralized in main-green, but do not let release publish ' +
        'when that source gate is absent, pending forever, or failed.',
    );
  }
  pass('Publish path waits for same-SHA main-green source validation');

  const requiredVersionPullRequestWorkflows = [
    'unit-tests.yaml',
    'browser-tests.yaml',
    'changeset-guard.yaml',
    'deploy-playground.yaml',
  ];
  const missingWorkflowDispatches = findMissingWorkflowDispatches(
    parsedWorkflow,
    requiredVersionPullRequestWorkflows,
  );
  if (missingWorkflowDispatches.length > 0) {
    fail(
      'release.yaml does not dispatch all validation workflows for the Changesets-created ' +
        `pull request: ${missingWorkflowDispatches.join(', ')}. GITHUB_TOKEN-created pull request ` +
        'events require approval, so these explicit dispatches keep release validation automatic.',
    );
  }
  if (!workflowContent.includes('steps.changesets.outputs.pullRequestNumber')) {
    fail('release.yaml must gate version pull request validation on `pullRequestNumber`.');
  }
  pass('Version pull requests explicitly dispatch all validation workflows');

  let deployPlaygroundWorkflowContent: string;
  try {
    deployPlaygroundWorkflowContent = readFileSync(deployPlaygroundWorkflowPath, 'utf8');
  } catch {
    fail(`playground deploy workflow not found at ${deployPlaygroundWorkflowPath}`);
  }
  let parsedDeployPlaygroundWorkflow: unknown;
  try {
    parsedDeployPlaygroundWorkflow = loadYaml(deployPlaygroundWorkflowContent);
  } catch (error) {
    fail(`deploy-playground.yaml is not valid YAML: ${errorMessageFrom(error)}`);
  }
  if (
    !workflowDispatchInputHasDefault(parsedDeployPlaygroundWorkflow, 'environment', 'preview') ||
    !deployPlaygroundWorkflowContent.includes("inputs.environment == 'production'")
  ) {
    fail(
      'deploy-playground.yaml must default manual dispatches to preview and require an explicit ' +
        '`environment=production` input for production deploys.',
    );
  }
  pass('Manual playground deploys default to preview');

  const workflowContents = Object.fromEntries(
    readdirSync(workflowsDirectoryPath)
      .filter((fileName) => /\.ya?ml$/.test(fileName))
      .map((fileName) => [fileName, readFileSync(join(workflowsDirectoryPath, fileName), 'utf8')]),
  );
  const outdatedWorkflowActions = findOutdatedWorkflowActions(workflowContents);
  if (outdatedWorkflowActions.length > 0) {
    fail(
      'GitHub workflows still use action majors that target deprecated Node runtimes:\n' +
        outdatedWorkflowActions.map((action) => `  - ${action}`).join('\n'),
    );
  }
  pass('GitHub workflows use current Node 24 action majors');

  // ── Guard 2: locate the primary publish step ────────────────────────────────
  // The primary publish step is identified by the run: command that calls publish:release.
  // We scan for the step boundary and extract its env: block, then check for tokens.
  //
  // Strategy: find the line index of the publish:release `run:` command, then walk
  // upward to the `- name:` that opens this step and downward to the next `- name:`
  // or end of file. Within that range, assert no env key matches the token names.

  // Match the publish step's actual `run:` command, not a comment that mentions it.
  // `^\s*run:` anchors to a real YAML key so a `# ... bun run ... publish:release`
  // note can't be mistaken for the step.
  const publishRunPattern = /^\s*run\s*:.*bun run --filter=@lostgradient\/cinder publish:release/;
  const publishRunLineIndex = lines.findIndex(
    (line) => !isComment(line) && publishRunPattern.test(line),
  );

  if (publishRunLineIndex === -1) {
    fail(
      'Could not locate the primary publish step in release.yaml. ' +
        'Expected a step with `run: bun run --filter=@lostgradient/cinder publish:release`.',
    );
  }

  // Walk backward to find the `- name:` opening of this step (skipping comments).
  let stepStartIndex = publishRunLineIndex;
  for (let index = publishRunLineIndex - 1; index >= 0; index--) {
    if (!isComment(lines[index]!) && /^\s+-\s+name\s*:/.test(lines[index]!)) {
      stepStartIndex = index;
      break;
    }
  }

  // Walk forward to find the next `- name:` opening (start of the next step) or EOF.
  let stepEndIndex = lines.length;
  for (let index = publishRunLineIndex + 1; index < lines.length; index++) {
    if (!isComment(lines[index]!) && /^\s+-\s+name\s*:/.test(lines[index]!)) {
      stepEndIndex = index;
      break;
    }
  }

  const publishStepLines = lines.slice(stepStartIndex, stepEndIndex);

  // ── Guard 3: no token env vars in the publish step ──────────────────────────
  const forbiddenPatterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /NODE_AUTH_TOKEN\s*:/, label: 'NODE_AUTH_TOKEN' },
    { pattern: /NPM_TOKEN\s*:/, label: 'NPM_TOKEN' },
  ];

  for (const { pattern, label } of forbiddenPatterns) {
    const offendingLine = publishStepLines.find((line) => !isComment(line) && pattern.test(line));
    if (offendingLine !== undefined) {
      fail(
        `release.yaml's primary publish step contains ${label}:\n` +
          `  ${offendingLine.trim()}\n\n` +
          'The primary publish path must use npm Trusted Publishing (OIDC), not a long-lived token.\n' +
          'Remove the token env var from this step.\n' +
          'For break-glass token publishing, use release-manual.yaml instead.',
      );
    }
  }

  pass('No NODE_AUTH_TOKEN or NPM_TOKEN in the primary publish step');

  // ── Guard 4: no token env vars ANYWHERE in release.yaml ─────────────────────
  // The step-scoped check above is precise, but a token placed in a `env:` block
  // at the JOB level or the WORKFLOW level would be inherited by the publish step
  // without appearing inside the step's own lines — a real evasion path. Because
  // the entire OIDC release path is tokenless (the only legitimate token use lives
  // in release-manual.yaml's break-glass flow), the correct, evasion-proof
  // invariant is simply: these token names appear NOWHERE in release.yaml — not in
  // a step env, not in a job env, not in a workflow env. We allow them inside
  // comment lines (e.g. the explanatory note about setup-node's _authToken) but
  // reject any real `KEY:` assignment.
  for (const { pattern, label } of forbiddenPatterns) {
    const offendingLine = lines.find((line) => !isComment(line) && pattern.test(line));
    if (offendingLine !== undefined) {
      fail(
        `release.yaml references ${label} outside a comment:\n` +
          `  ${offendingLine.trim()}\n\n` +
          'The OIDC release path must be fully tokenless. A token in a job-level or\n' +
          'workflow-level `env:` block would be inherited by the publish step and\n' +
          'silently re-enable token publishing. Remove it.\n' +
          'For break-glass token publishing, use release-manual.yaml instead.',
      );
    }
  }

  pass('No NODE_AUTH_TOKEN or NPM_TOKEN anywhere in release.yaml (job/workflow env safe)');

  let ignoredPackageChangesets: IgnoredPackageChangeset[];
  try {
    ignoredPackageChangesets = findIgnoredPackageChangesets(
      changesetDirectoryPath,
      loadIgnoredChangesetPackages(changesetsConfigurationPath),
    );
  } catch (error) {
    fail(errorMessageFrom(error));
  }

  if (ignoredPackageChangesets.length > 0) {
    const formattedChangesets = ignoredPackageChangesets
      .map((changeset) => {
        const relativePath = relative(workspaceRoot, changeset.filePath);
        return `  - ${relativePath}: ${changeset.packages.join(', ')}`;
      })
      .join('\n');

    fail(
      'Ignored-package changesets are pending:\n' +
        `${formattedChangesets}\n\n` +
        'changesets/action treats these files as pending release work, but `changeset version` ' +
        'does not consume ignored packages. Remove the changeset files, or retarget them to ' +
        '@lostgradient/cinder if the public package should release.',
    );
  }

  pass('No pending changesets target ignored packages');
  pass('release.yaml is correctly configured for npm Trusted Publishing');
}

if (import.meta.main) {
  runValidation();
}
