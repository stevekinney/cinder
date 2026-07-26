import { Glob } from 'bun';
import { relative, resolve } from 'node:path';

type PrimitiveCompositionViolation = {
  filePath: string;
  message: string;
};

type FindViolations = (
  source: string,
  filePath: string,
  companionSource?: string | readonly string[],
) => PrimitiveCompositionViolation[];

const workspaceRoot = resolve(import.meta.dir, '../../..');

export const primitiveCompositionSourceRoots = [
  {
    absoluteRoot: resolve(workspaceRoot, 'packages/components/src/components'),
    relativePrefix: '',
  },
  {
    absoluteRoot: resolve(workspaceRoot, 'packages/components/src/styles/components'),
    relativePrefix: 'styles/components',
  },
] as const;

export async function runPrimitiveCompositionCheck(
  shouldCheckSource: (filePath: string) => boolean,
  findViolations: FindViolations,
  missingMigrationRecordPaths: (existingPaths: ReadonlySet<string>) => string[],
): Promise<void> {
  const violations: PrimitiveCompositionViolation[] = [];
  const existingPaths = new Set<string>();
  const glob = new Glob('**/*.{svelte,css}');
  const componentSources: Array<{
    absolutePath: string;
    relativePath: string;
    source: string;
  }> = [];

  for (const { absoluteRoot, relativePrefix } of primitiveCompositionSourceRoots) {
    for await (const absolutePath of glob.scan({ cwd: absoluteRoot, absolute: true })) {
      const localPath = relative(absoluteRoot, absolutePath).replaceAll('\\', '/');
      const relativePath = relativePrefix ? `${relativePrefix}/${localPath}` : localPath;
      if (!shouldCheckSource(relativePath)) continue;
      existingPaths.add(relativePath);
      componentSources.push({
        absolutePath,
        relativePath,
        source: await Bun.file(absolutePath).text(),
      });
    }
  }

  const svelteSources = componentSources.filter(({ relativePath }) =>
    relativePath.endsWith('.svelte'),
  );
  for (const { absolutePath, relativePath, source } of componentSources) {
    const styledFamily = relativePath.split('/')[0] ?? '';
    const companionSources = absolutePath.endsWith('.css')
      ? svelteSources
          .filter(({ relativePath: candidatePath }) => {
            const candidateFamily = candidatePath.split('/')[0] ?? '';
            return candidateFamily === styledFamily;
          })
          .map(({ source: candidateSource }) => candidateSource)
      : [];
    violations.push(...findViolations(source, relativePath, companionSources));
  }

  for (const filePath of missingMigrationRecordPaths(existingPaths))
    violations.push({
      filePath,
      message: 'Remove the stale primitive-composition migration record for this missing file.',
    });

  if (violations.length === 0) {
    process.stdout.write(
      'check-primitive-composition — OK (known primitive copies are explicitly tracked).\n',
    );
    return;
  }

  process.stderr.write(
    'check-primitive-composition — untracked hand-rolled primitives detected.\n\n',
  );
  for (const violation of violations)
    process.stderr.write(`  ${violation.filePath}\n    ${violation.message}\n`);
  process.exitCode = 1;
}
