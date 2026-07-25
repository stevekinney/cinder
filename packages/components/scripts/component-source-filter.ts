import { basename } from 'node:path';

export function isExcludedComponentSource(filePath: string): boolean {
  const fileName = basename(filePath);
  return (
    fileName.includes('fixture') ||
    fileName.endsWith('.type-test.svelte') ||
    (fileName.startsWith('_') && fileName.endsWith('-test-harness.svelte'))
  );
}
