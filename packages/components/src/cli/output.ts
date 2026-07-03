import type {
  BestPracticeSection,
  ComponentComparison,
  ComponentDetail,
  ComponentSummary,
  PackageSummary,
  SearchResult,
} from './types.ts';

export type JsonEnvelope = {
  package: PackageSummary;
  command: string;
  data: unknown;
};

export type JsonErrorEnvelope = {
  error: {
    code: string;
    message: string;
    suggestions: string[];
  };
};

export function jsonEnvelope(
  packageSummary: PackageSummary,
  command: string,
  data: unknown,
): string {
  return JSON.stringify({ package: packageSummary, command, data } satisfies JsonEnvelope, null, 2);
}

export function jsonError(code: string, message: string, suggestions: string[] = []): string {
  return JSON.stringify(
    { error: { code, message, suggestions } } satisfies JsonErrorEnvelope,
    null,
    2,
  );
}

function bulletList(items: string[], indent = '  '): string[] {
  return items.map((item) => `${indent}- ${item}`);
}

function formatAvoidWhen(component: ComponentSummary): string[] {
  if (component.avoidWhen.length === 0) return ['  Avoid when: none listed'];
  return [
    '  Avoid when:',
    ...component.avoidWhen.map(
      (entry) => `    - ${entry.reason}${entry.alternative ? ` Use ${entry.alternative}.` : ''}`,
    ),
  ];
}

export function formatList(components: ComponentSummary[]): string {
  if (components.length === 0) return 'No Cinder components matched.';
  return components
    .map(
      (component) =>
        `${component.id} (${component.category}, ${component.status})\n` +
        `  ${component.purpose}\n` +
        `  import ${component.import}`,
    )
    .join('\n\n');
}

export function formatSearch(results: SearchResult[]): string {
  if (results.length === 0) return 'No Cinder components matched.';
  return results
    .map(
      (result) =>
        `${result.id} (${result.category}, ${result.status}; score ${result.score})\n` +
        `  ${result.purpose}\n` +
        `  Use when: ${result.useWhen[0] ?? 'No guidance listed.'}\n` +
        `  Matched: ${result.matched.join(', ') || 'n/a'}`,
    )
    .join('\n\n');
}

export function formatDetail(detail: ComponentDetail): string {
  const { component, overlapFamilies } = detail;
  const lines = [
    `${component.name} (${component.id})`,
    component.purpose,
    '',
    `Import: ${component.import}`,
    `Category: ${component.category}`,
    `Status: ${component.status}`,
    `Tags: ${component.tags.join(', ') || 'none'}`,
    `Overlap families: ${overlapFamilies.join(', ') || 'none'}`,
    '',
    'Use when:',
    ...bulletList(component.useWhen),
    ...formatAvoidWhen({
      ...component,
      overlapFamilies,
    }),
    '',
    `Schema: ${component.artifacts.schema}`,
    `Variables: ${component.artifacts.variables}`,
  ];
  if (component.artifacts.examples) lines.push(`Examples: ${component.artifacts.examples}`);
  if (component.artifacts.constraints)
    lines.push(`Constraints: ${component.artifacts.constraints}`);
  return lines.join('\n');
}

export function formatComparison(comparison: ComponentComparison): string {
  const lines = ['Component comparison', ''];
  for (const component of comparison.components) {
    lines.push(`${component.id} — ${component.purpose}`);
    lines.push(`  Use when: ${component.useWhen[0] ?? 'No guidance listed.'}`);
    const avoid = component.avoidWhen[0];
    if (avoid)
      lines.push(
        `  Avoid when: ${avoid.reason}${avoid.alternative ? ` Use ${avoid.alternative}.` : ''}`,
      );
    lines.push('');
  }
  const shared = Object.entries(comparison.sharedOverlapFamilies);
  if (shared.length > 0) {
    lines.push('Shared overlap families:');
    for (const [family, members] of shared) lines.push(`  - ${family}: ${members.join(', ')}`);
    lines.push('');
  }
  lines.push('Guidance:');
  lines.push(...bulletList(comparison.guidance));
  return lines.join('\n').trimEnd();
}

export function formatBestPractices(sections: BestPracticeSection[]): string {
  return sections
    .map((section) => `${section.title}\n${bulletList(section.guidance).join('\n')}`)
    .join('\n\n');
}

export function formatHelp(): string {
  return [
    'cinder — Cinder component discovery for agents',
    '',
    'Usage:',
    '  cinder list [--category <id>] [--status <level>] [--tag <tag>] [--json]',
    '  cinder search <query> [--category <id>] [--status <level>] [--limit <n>] [--json]',
    '  cinder show <component-id> [--json]',
    '  cinder compare <component-id>... [--json]',
    '  cinder best-practices [imports|styles|metadata|overlap|all] [--json]',
    '  cinder mcp',
    '',
    'Options:',
    '  --json              Print deterministic JSON.',
    '  --category <id>     Filter by manifest category.',
    '  --status <level>    Filter by component status.',
    '  --tag <tag>         Filter by tag.',
    '  --limit <n>         Limit search results.',
    '  -h, --help          Show help.',
  ].join('\n');
}
