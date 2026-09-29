/** Structural guard for the public mirror and release workflow contract. */
import { load as loadYaml } from 'js-yaml';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const workflows = join(root, '.github', 'workflows');
export const MIRROR_VERIFY_WORKFLOW = 'mirror-verify.yaml';
export const MCP_VERIFY_WORKFLOW = 'mcp-verify.yaml';
export const RELEASE_WORKFLOW = 'release.yaml';
export const MIRROR_PACKAGES = [
  '@lostgradient/markdown',
  '@lostgradient/cinder',
  '@lostgradient/chat',
  '@lostgradient/editor',
] as const;
export const PUBLISHED_PACKAGES = [...MIRROR_PACKAGES, '@lostgradient/cinder-mcp'] as const;

type Step = {
  name?: string | undefined;
  run?: string | undefined;
  uses?: string | undefined;
  'working-directory'?: string | undefined;
};
type Job = {
  uses?: string | undefined;
  needs?: string | string[] | undefined;
  steps?: Step[] | undefined;
};
const workflowSchema = z.object({
  name: z.string().optional(),
  on: z.record(z.string(), z.unknown()).optional(),
  jobs: z
    .record(
      z.string(),
      z.object({
        uses: z.string().optional(),
        needs: z.union([z.string(), z.array(z.string())]).optional(),
        steps: z
          .array(
            z.object({
              name: z.string().optional(),
              run: z.string().optional(),
              uses: z.string().optional(),
              'working-directory': z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});
export type Workflow = z.infer<typeof workflowSchema>;
export type PipelineViolation = { workflow: string; detail: string };
export type PipelineCheckResult = { violations: PipelineViolation[] };

const stem = (name: string) => name.replace(/^@/, '').replace('/', '-');
const stepNamed = (job: Job | undefined, name: string) =>
  job?.steps?.find((step) => step.name === name);
const hasNeed = (job: Job | undefined, need: string) =>
  Array.isArray(job?.needs) ? job.needs.includes(need) : job?.needs === need;
const add = (violations: PipelineViolation[], workflow: string, detail: string) =>
  violations.push({ workflow, detail });

function checkMirror(mirror: Workflow, violations: PipelineViolation[]): void {
  if (mirror.name !== 'mirror-verify')
    add(violations, MIRROR_VERIFY_WORKFLOW, 'workflow name must be mirror-verify');
  const job = mirror.jobs?.['verify'];
  if (!job) {
    add(violations, MIRROR_VERIFY_WORKFLOW, 'missing verify job');
    return;
  }
  for (const packageName of MIRROR_PACKAGES) {
    const directory = `packages/${packageName === '@lostgradient/cinder' ? 'components' : packageName.slice('@lostgradient/'.length)}`;
    for (const action of ['build', 'typecheck'] as const) {
      const step = stepNamed(job, `${action} ${packageName}`);
      if (
        !step ||
        step['working-directory'] !== directory ||
        step.run?.trim() !== `bun run ${action}`
      )
        add(violations, MIRROR_VERIFY_WORKFLOW, `${action} contract missing for ${packageName}`);
    }
    const pack = stepNamed(job, `pack ${packageName}`);
    if (
      !pack ||
      pack['working-directory'] !== directory ||
      pack.run?.trim() !== 'bun run scripts/pack-for-publish.ts'
    )
      add(violations, MIRROR_VERIFY_WORKFLOW, `pack contract missing for ${packageName}`);
    const artifact = stepNamed(
      job,
      `move ${packageName}'s packed tarball into the shared tarballs directory`,
    );
    if (!artifact || !artifact.run?.includes(`${stem(packageName)}.tgz`))
      add(
        violations,
        MIRROR_VERIFY_WORKFLOW,
        `packed artifact contract missing for ${packageName}`,
      );
  }
  const executableSteps = job.steps?.filter((step) => step.run) ?? [];
  for (const packageName of MIRROR_PACKAGES)
    if (!executableSteps.some((step) => step.run?.includes(packageName)))
      add(violations, MIRROR_VERIFY_WORKFLOW, `consumer import missing for ${packageName}`);
  if (!job.steps?.some((step) => step.name?.includes('under node')))
    add(violations, MIRROR_VERIFY_WORKFLOW, 'Node consumer import smoke test missing');
}

function checkMcp(mcp: Workflow, violations: PipelineViolation[]): void {
  if (
    mcp.name !== 'verify-cinder-mcp' ||
    !('pull_request' in (mcp.on ?? {})) ||
    !('merge_group' in (mcp.on ?? {}))
  )
    add(violations, MCP_VERIFY_WORKFLOW, 'cinder-mcp pull request triggers missing');
  const steps = mcp.jobs?.['verify-mcp']?.steps;
  for (const [name, command] of [
    ['Validate packed cinder-mcp consumer', 'validate:consumer'],
    ['Lint cinder-mcp', 'lint'],
    ['Typecheck cinder-mcp', 'typecheck'],
    ['Test cinder-mcp', 'test'],
  ]) {
    if (
      !steps?.some(
        (step) =>
          step.name === name &&
          step.run?.trim() === `bun run --filter=@lostgradient/cinder-mcp ${command}`,
      )
    )
      add(
        violations,
        MCP_VERIFY_WORKFLOW,
        `cinder-mcp pull request ${command === 'validate:consumer' ? 'consumer validation' : command} missing`,
      );
  }
}

export function checkMirrorPipeline(
  mirror: Workflow,
  release: Workflow,
  mcp: Workflow,
): PipelineCheckResult {
  const violations: PipelineViolation[] = [];
  checkMirror(mirror, violations);
  checkMcp(mcp, violations);
  const verify = release.jobs?.['verify-mirror'];
  if (verify?.uses !== `./.github/workflows/${MIRROR_VERIFY_WORKFLOW}`)
    add(violations, RELEASE_WORKFLOW, 'verify-mirror must call mirror-verify.yaml');
  if (!hasNeed(release.jobs?.['release'], 'verify-mirror'))
    add(violations, RELEASE_WORKFLOW, 'release job must need verify-mirror');
  const releaseJob = release.jobs?.['release'];
  if (
    stepNamed(releaseJob, 'Validate cinder-mcp package artifact')?.run?.trim() !==
    'bun run --filter=@lostgradient/cinder-mcp validate:consumer'
  )
    add(violations, RELEASE_WORKFLOW, 'cinder-mcp consumer validation missing');
  if (
    stepNamed(releaseJob, 'Publish validated cinder-mcp package artifact to npm')?.run?.trim() !==
    'bun run --filter=@lostgradient/cinder-mcp publish:release -- --skip-validation'
  )
    add(violations, RELEASE_WORKFLOW, 'cinder-mcp publish contract missing');
  return { violations };
}
async function readWorkflow(name: string): Promise<Workflow> {
  const parsed: unknown = loadYaml(await Bun.file(join(workflows, name)).text());
  return workflowSchema.parse(parsed);
}
async function main(): Promise<void> {
  const result = checkMirrorPipeline(
    await readWorkflow(MIRROR_VERIFY_WORKFLOW),
    await readWorkflow(RELEASE_WORKFLOW),
    await readWorkflow(MCP_VERIFY_WORKFLOW),
  );
  if (result.violations.length) {
    for (const violation of result.violations)
      process.stderr.write(`[${violation.workflow}] ${violation.detail}\n`);
    process.exit(1);
  }
  process.stdout.write(`mirror pipeline coverage — OK (${PUBLISHED_PACKAGES.length} packages).\n`);
}
if (import.meta.main)
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
