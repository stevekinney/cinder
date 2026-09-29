import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { CinderKnowledgeError, type ManifestComponent } from './types.ts';

export async function loadArtifact(
  component: ManifestComponent,
  kind: 'schema' | 'variables' | 'examples' | 'constraints',
  packageRoot: string,
): Promise<unknown> {
  const artifactPath = component.artifacts[kind];
  const componentRoot = resolve(packageRoot, 'src', 'components');
  const localPath = artifactPath === undefined ? undefined : resolve(packageRoot, artifactPath);
  const localRelativePath =
    localPath === undefined ? undefined : relative(componentRoot, localPath);
  if (
    localPath === undefined ||
    localRelativePath === undefined ||
    localRelativePath.startsWith('..') ||
    isAbsolute(localRelativePath) ||
    !existsSync(localPath)
  ) {
    throw new CinderKnowledgeError(
      'ARTIFACT_NOT_FOUND',
      `${component.id} does not have a local ${kind} artifact.`,
      [component.id],
    );
  }
  return JSON.parse(await readFile(localPath, 'utf8'));
}
