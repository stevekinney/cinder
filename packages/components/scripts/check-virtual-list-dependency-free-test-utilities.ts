import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export async function withTemporaryFileTree(
  files: Readonly<Record<string, string>>,
  assert: (root: string) => Promise<void>,
): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'check-virtual-list-dependency-free-'));
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const filePath = join(root, relativePath);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, content);
    }
    await assert(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
