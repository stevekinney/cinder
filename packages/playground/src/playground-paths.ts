import { dirname, join, relative, sep } from 'node:path';

export const PLAYGROUND_ROOT = dirname(import.meta.dirname);
export const PLAYGROUND_TEMP_ROOT = join(PLAYGROUND_ROOT, '.tmp');

export function relativeImportSpecifier(fromDirectory: string, targetPath: string): string {
  const relativePath = relative(fromDirectory, targetPath).replaceAll(sep, '/');
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}
