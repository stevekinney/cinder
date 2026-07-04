#!/usr/bin/env node
import { parseArgs } from 'node:util';

import { loadCinderKnowledge } from './knowledge.ts';
import {
  formatBestPractices,
  formatComparison,
  formatDetail,
  formatHelp,
  formatList,
  formatSearch,
  jsonEnvelope,
  jsonError,
} from './output.ts';
import {
  CinderKnowledgeError,
  type BestPracticeTopic,
  type ListOptions,
  type PackageSummary,
  type SearchOptions,
} from './types.ts';

type ParsedCommand = {
  command: string;
  positionals: string[];
  json: boolean;
  listOptions: ListOptions;
  searchOptions: SearchOptions;
  help: boolean;
};

const bestPracticeTopics = new Set<string>(['imports', 'styles', 'metadata', 'overlap', 'all']);

function isBestPracticeTopic(value: string): value is BestPracticeTopic {
  return bestPracticeTopics.has(value);
}

function parseLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new CinderKnowledgeError('BAD_LIMIT', '--limit must be a positive integer.');
  }
  return parsed;
}

function setListOption(
  target: ListOptions,
  key: keyof ListOptions,
  value: string | undefined,
): void {
  if (value !== undefined) target[key] = value;
}

export function parseCommand(argv: string[]): ParsedCommand {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      category: { type: 'string' },
      status: { type: 'string' },
      tag: { type: 'string' },
      limit: { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command = 'help', ...positionals] = parsed.positionals;
  const listOptions: ListOptions = {};
  setListOption(listOptions, 'category', parsed.values.category);
  setListOption(listOptions, 'status', parsed.values.status);
  setListOption(listOptions, 'tag', parsed.values.tag);
  const searchOptions: SearchOptions = { ...listOptions };
  const limit = parseLimit(parsed.values.limit);
  if (limit !== undefined) searchOptions.limit = limit;
  return {
    command,
    positionals,
    json: parsed.values.json === true,
    listOptions,
    searchOptions,
    help: parsed.values.help === true,
  };
}

type CommandResult = {
  command: string;
  data: unknown;
  text: string;
  package?: PackageSummary;
};

async function runParsedCommand(parsed: ParsedCommand): Promise<CommandResult> {
  if (parsed.help || parsed.command === 'help' || parsed.command === '--help') {
    const text = formatHelp();
    if (parsed.json) {
      const knowledge = await loadCinderKnowledge();
      return { command: 'help', data: { usage: text }, text, package: knowledge.package };
    }
    return { command: 'help', data: { usage: text }, text };
  }

  if (parsed.command === 'mcp') {
    const { runMcpServer } = await import('./mcp.ts');
    await runMcpServer();
    return { command: 'mcp', data: null, text: '' };
  }

  const knowledge = await loadCinderKnowledge();
  switch (parsed.command) {
    case 'list': {
      const data = knowledge.list(parsed.listOptions);
      return { command: 'list', data, text: formatList(data), package: knowledge.package };
    }
    case 'search': {
      const query = parsed.positionals.join(' ');
      const data = knowledge.search(query, parsed.searchOptions);
      return { command: 'search', data, text: formatSearch(data), package: knowledge.package };
    }
    case 'show': {
      const id = parsed.positionals[0];
      if (!id) throw new CinderKnowledgeError('MISSING_COMPONENT', 'show requires a component id.');
      const data = await knowledge.show(id);
      return { command: 'show', data, text: formatDetail(data), package: knowledge.package };
    }
    case 'compare': {
      const data = knowledge.compare(parsed.positionals);
      return { command: 'compare', data, text: formatComparison(data), package: knowledge.package };
    }
    case 'best-practices': {
      const topic = parsed.positionals[0] ?? 'all';
      if (!isBestPracticeTopic(topic)) {
        throw new CinderKnowledgeError('BAD_TOPIC', `Unknown best-practices topic "${topic}".`, [
          'imports',
          'styles',
          'metadata',
          'overlap',
          'all',
        ]);
      }
      const data = knowledge.bestPractices(topic);
      return {
        command: 'best-practices',
        data,
        text: formatBestPractices(data),
        package: knowledge.package,
      };
    }
    default:
      throw new CinderKnowledgeError('UNKNOWN_COMMAND', `Unknown command "${parsed.command}".`, [
        'list',
        'search',
        'show',
        'compare',
        'best-practices',
        'mcp',
      ]);
  }
}

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  let parsed: ParsedCommand;
  try {
    parsed = parseCommand(argv);
    const result = await runParsedCommand(parsed);
    if (result.text.length > 0) {
      let output = result.text;
      if (parsed.json) {
        if (!result.package) {
          throw new CinderKnowledgeError(
            'PACKAGE_UNAVAILABLE',
            'Package metadata was not available for JSON output.',
          );
        }
        output = jsonEnvelope(result.package, result.command, result.data);
      }
      process.stdout.write(`${output}\n`);
    }
    return 0;
  } catch (error: unknown) {
    const isJson = argv.includes('--json');
    const code = error instanceof CinderKnowledgeError ? error.code : 'UNEXPECTED_ERROR';
    const message = error instanceof Error ? error.message : String(error);
    const suggestions = error instanceof CinderKnowledgeError ? error.suggestions : [];
    if (isJson) {
      process.stdout.write(`${jsonError(code, message, suggestions)}\n`);
    } else {
      process.stderr.write(`${message}\n`);
      if (suggestions.length > 0) process.stderr.write(`Suggestions: ${suggestions.join(', ')}\n`);
    }
    return 1;
  }
}

if (import.meta.main) {
  const exitCode = await runCli();
  process.exit(exitCode);
}
