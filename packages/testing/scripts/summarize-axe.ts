import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');

type Impact = 'critical' | 'serious' | 'moderate' | 'minor';

type AxeViolation = {
  id: string;
  impact: Impact | null;
  help: string;
  nodes: unknown[];
};

type AxeResult = {
  key: { slug: string; theme: 'light' | 'dark'; viewport: string };
  buckets: Record<Impact, AxeViolation[]>;
  totals: Record<Impact, number>;
};

type RuleStat = {
  ruleId: string;
  count: number;
  help: string;
};

type ComponentStat = {
  slug: string;
  count: number;
};

type AxeSummary = {
  totalViolations: number;
  byImpact: Record<Impact, number>;
  topRules: RuleStat[];
  topComponents: ComponentStat[];
  perComponentByTheme: Record<string, { light: number; dark: number }>;
};

async function collectJsonFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(directory, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(resolve(entry.parentPath, entry.name));
      }
    }
  } catch {
    // Directory does not exist, so there are no results yet.
  }
  return files;
}

async function main(): Promise<void> {
  const axeResultsDir = resolve(packageRoot, 'test-results', 'axe');
  const jsonFiles = await collectJsonFiles(axeResultsDir);

  if (jsonFiles.length === 0) {
    console.log('No axe result files found. The browser test suite has not run yet.');
    const summaryPath = resolve(packageRoot, 'test-results', 'axe-summary.json');
    const emptySummary: AxeSummary = {
      totalViolations: 0,
      byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 },
      topRules: [],
      topComponents: [],
      perComponentByTheme: {},
    };
    await mkdir(dirname(summaryPath), { recursive: true });
    await writeFile(summaryPath, JSON.stringify(emptySummary, null, 2) + '\n');
    return;
  }

  let totalViolations = 0;
  const byImpact: Record<Impact, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const ruleCounts = new Map<string, { count: number; help: string }>();
  const componentCounts = new Map<string, number>();
  const perComponentByTheme: Record<string, { light: number; dark: number }> = {};

  const IMPACTS: Impact[] = ['critical', 'serious', 'moderate', 'minor'];

  for (const file of jsonFiles) {
    const content = await readFile(file, 'utf-8');
    const result = JSON.parse(content) as AxeResult;
    const slug = result.key.slug;
    const theme = result.key.theme;

    for (const impact of IMPACTS) {
      const violations = result.buckets[impact];
      for (const violation of violations) {
        totalViolations++;
        byImpact[impact]++;

        const existing = ruleCounts.get(violation.id);
        if (existing === undefined) {
          ruleCounts.set(violation.id, { count: 1, help: violation.help });
        } else {
          existing.count++;
        }

        componentCounts.set(slug, (componentCounts.get(slug) ?? 0) + 1);

        perComponentByTheme[slug] ??= { light: 0, dark: 0 };
        const themeCounts = perComponentByTheme[slug];
        if (themeCounts !== undefined) {
          themeCounts[theme]++;
        }
      }
    }
  }

  const topRules: RuleStat[] = [...ruleCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([ruleId, { count, help }]) => ({ ruleId, count, help }));

  const topComponents: ComponentStat[] = [...componentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([slug, count]) => ({ slug, count }));

  const summary: AxeSummary = {
    totalViolations,
    byImpact,
    topRules,
    topComponents,
    perComponentByTheme,
  };

  const summaryPath = resolve(packageRoot, 'test-results', 'axe-summary.json');
  await mkdir(dirname(summaryPath), { recursive: true });
  await writeFile(summaryPath, JSON.stringify(summary, null, 2) + '\n');

  console.log(`Axe summary: ${totalViolations} total violations across ${jsonFiles.length} result files`);
  console.log(
    `  By impact: critical=${byImpact.critical}, serious=${byImpact.serious}, moderate=${byImpact.moderate}, minor=${byImpact.minor}`,
  );
  if (topRules.length > 0) {
    console.log(`  Top rules: ${topRules.map((rule) => `${rule.ruleId}(${rule.count})`).join(', ')}`);
  }
}

main().catch((error: unknown) => {
  console.error('summarize-axe failed:', error);
  process.exit(1);
});
