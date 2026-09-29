import { describe, expect, it } from 'bun:test';
import { checkMirrorPipeline, MIRROR_PACKAGES, type Workflow } from './check-pipeline-coverage.ts';

const directory = (name: string) =>
  `packages/${name === '@lostgradient/cinder' ? 'components' : name.slice('@lostgradient/'.length)}`;
const mirror = (): Workflow => ({
  name: 'mirror-verify',
  jobs: {
    verify: {
      steps: [
        ...MIRROR_PACKAGES.flatMap((name) => [
          { name: `build ${name}`, 'working-directory': directory(name), run: 'bun run build' },
          {
            name: `typecheck ${name}`,
            'working-directory': directory(name),
            run: 'bun run typecheck',
          },
          {
            name: `pack ${name}`,
            'working-directory': directory(name),
            run: 'bun run scripts/pack-for-publish.ts',
          },
          {
            name: `move ${name}'s packed tarball into the shared tarballs directory`,
            run: `rename lostgradient-${name.replace(/^@/, '').replace('/', '-')}.tgz`,
          },
        ]),
        {
          name: 'import 1077 specifier(s)',
          run: MIRROR_PACKAGES.map((name) => `import '${name}/entry'`).join('\n'),
        },
        {
          name: 'import 881 specifier(s) from packed tarballs under node',
          run: MIRROR_PACKAGES.map((name) => `import '${name}/entry'`).join('\n'),
        },
      ],
    },
  },
});
const release = (): Workflow => ({
  jobs: {
    'verify-mirror': { uses: './.github/workflows/mirror-verify.yaml' },
    release: {
      needs: 'verify-mirror',
      steps: [
        {
          name: 'Validate cinder-mcp package artifact',
          run: 'bun run --filter=@lostgradient/cinder-mcp validate:consumer',
        },
        {
          name: 'Publish validated cinder-mcp package artifact to npm',
          run: 'bun run --filter=@lostgradient/cinder-mcp publish:release -- --skip-validation',
        },
      ],
    },
  },
});

describe('mirror pipeline coverage', () => {
  it('accepts the parsed target topology', () =>
    expect(checkMirrorPipeline(mirror(), release()).violations).toEqual([]));
  it('rejects a wrong package directory and command', () => {
    const changed = mirror();
    const typecheckStep = changed.jobs?.['verify']?.steps?.[1];
    if (!typecheckStep) throw new Error('Fixture missing Markdown typecheck step');
    typecheckStep['working-directory'] = 'packages/wrong';
    typecheckStep.run = 'bun run build';
    expect(
      checkMirrorPipeline(changed, release()).violations.map(({ detail }) => detail),
    ).toContain('typecheck contract missing for @lostgradient/markdown');
  });
  it('rejects release linkage mutations', () => {
    const changed = release();
    changed.jobs!['release']!.needs = [];
    changed.jobs!['verify-mirror']!.uses = './.github/workflows/old.yaml';
    const details = checkMirrorPipeline(mirror(), changed).violations.map(({ detail }) => detail);
    expect(details).toContain('verify-mirror must call mirror-verify.yaml');
    expect(details).toContain('release job must need verify-mirror');
  });
  it('requires the fifth published package release contract', () => {
    const changed = release();
    changed.jobs!['release']!.steps = [];
    expect(checkMirrorPipeline(mirror(), changed).violations.map(({ detail }) => detail)).toContain(
      'cinder-mcp consumer validation missing',
    );
  });
});
