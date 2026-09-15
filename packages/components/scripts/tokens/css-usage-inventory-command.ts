import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { loadRepositorySources } from './css-usage-inventory';
import { loadCorpus } from './generate.ts';
import { buildInventoryForCorpus } from './prospective-token-inventory.ts';

const root = resolve(import.meta.dir, '../../../..');
const outputIndex = process.argv.indexOf('--output');
if (outputIndex < 0 || !process.argv[outputIndex + 1])
  throw new Error(
    'Usage: bun run packages/components/scripts/tokens/css-usage-inventory-command.ts --output <report-json>',
  );
const outputArgument = process.argv[outputIndex + 1];
if (!outputArgument) throw new Error('Missing output path');
const output = resolve(root, outputArgument);
const { resolver, documentsByPath } = await loadCorpus();
const { inventory: report } = await buildInventoryForCorpus(
  await loadRepositorySources(root),
  resolver,
  documentsByPath,
);
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
