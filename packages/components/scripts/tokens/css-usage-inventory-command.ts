import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { inventoryFromSources, loadRepositorySources } from './css-usage-inventory';

const root = resolve(import.meta.dir, '../../../..');
const outputIndex = process.argv.indexOf('--output');
if (outputIndex < 0 || !process.argv[outputIndex + 1])
  throw new Error(
    'Usage: bun run packages/components/scripts/tokens/css-usage-inventory-command.ts --output <report-json>',
  );
const outputArgument = process.argv[outputIndex + 1];
if (!outputArgument) throw new Error('Missing output path');
const output = resolve(root, outputArgument);
const parsed: unknown = JSON.parse(
  await Bun.file(resolve(root, 'packages/components/src/tokens/registry.generated.json')).text(),
);
if (
  !parsed ||
  typeof parsed !== 'object' ||
  !('entries' in parsed) ||
  !Array.isArray(parsed.entries)
)
  throw new Error('Invalid token registry');
const properties = new Set(
  parsed.entries.flatMap((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !('public' in entry) ||
      entry.public !== true ||
      !('cssProperty' in entry) ||
      typeof entry.cssProperty !== 'string'
    )
      return [];
    return [entry.cssProperty];
  }),
);
const report = inventoryFromSources(await loadRepositorySources(root), properties);
await mkdir(dirname(output), { recursive: true });
await Bun.write(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({
    uses: report.uses.length,
    dynamic: report.dynamic.length,
    diagnostics: report.diagnostics.length,
    sourceFiles: report.sourceFiles.length,
  }),
);
