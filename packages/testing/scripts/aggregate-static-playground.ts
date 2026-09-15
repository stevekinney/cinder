import { aggregateShardEvidence } from './static-playground-evidence.ts';

function valueFor(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const values = args.flatMap((argument, index) =>
    argument === flag
      ? args[index + 1] && !args[index + 1]!.startsWith('--')
        ? [args[index + 1]!]
        : []
      : argument.startsWith(`${flag}=`)
        ? [argument.slice(flag.length + 1)]
        : [],
  );
  if (values.length > 1) throw new Error(`[static-playground] duplicate aggregate flag ${flag}`);
  if (args.includes(flag) && values.length === 0)
    throw new Error(`[static-playground] aggregate flag ${flag} requires a value`);
  return values[0];
}

async function main(): Promise<void> {
  const known = new Set(['--report', '--evidence-directory', '--shards', '--output']);
  const argumentsList = process.argv.slice(2);
  for (let index = 0; index < argumentsList.length; index++) {
    const argument = argumentsList[index]!;
    if (known.has(argument)) {
      if (!argumentsList[index + 1] || argumentsList[index + 1]!.startsWith('--'))
        throw new Error(`[static-playground] aggregate flag ${argument} requires a value`);
      index++;
      continue;
    }
    if (![...known].some((flag) => argument.startsWith(`${flag}=`)))
      throw new Error(`[static-playground] unknown aggregate flag ${argument}`);
  }
  const report = valueFor('--report');
  const evidenceDirectory = valueFor('--evidence-directory');
  const shardsValue = valueFor('--shards');
  const output = valueFor('--output');
  if (!report || !evidenceDirectory || !shardsValue || !output || !/^\d+$/.test(shardsValue))
    throw new Error(
      'usage: aggregate-static-playground.ts --report <producer-report> --evidence-directory <directory> --shards <total> --output <aggregate-json>',
    );
  const shards = Number(shardsValue);
  if (!Number.isSafeInteger(shards) || shards < 1)
    throw new Error('[static-playground] shard total is invalid');
  const result = await aggregateShardEvidence({
    producerReport: report,
    evidenceDirectory,
    shards,
    output,
  });
  console.log(
    `[static-playground] aggregated ${result.cases} cases across ${result.shards} shards`,
  );
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
