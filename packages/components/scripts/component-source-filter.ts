import { basename } from 'node:path';

export function isExcludedComponentSource(filePath: string): boolean {
  const normalizedPath = filePath.replaceAll('\\', '/');
  const fileName = basename(normalizedPath);
  return (
    normalizedPath.split('/').includes('__test-helpers__') ||
    fileName.includes('fixture') ||
    fileName.endsWith('.type-test.svelte') ||
    fileName.endsWith('-harness.svelte')
  );
}
