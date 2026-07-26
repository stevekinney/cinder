/**
 * Strict CSP guard for Svelte markup.
 *
 * Fully static `style="..."` attributes survive server rendering as inline
 * style attributes, so browsers reject them under `style-src 'self'`. Dynamic
 * style attributes and `style:` directives compile to CSSOM mutations and are
 * intentionally outside this check.
 */

import { Glob } from 'bun';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'svelte/compiler';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(scriptDirectory, '..', 'src');

type SvelteNode = {
  type?: string;
  name?: string;
  value?: SvelteNode | SvelteNode[];
  name_loc?: {
    start: {
      line: number;
      column: number;
    };
  };
  [key: string]: unknown;
};

export type StaticStyleAttributeViolation = {
  line: number;
  column: number;
};

function isNode(value: unknown): value is SvelteNode {
  return typeof value === 'object' && value !== null;
}

function isStaticValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0 && value.every((part) => part.type === 'Text');
  if (!isNode(value)) return false;
  if (value.type !== 'ExpressionTag') return false;
  const expression = value['expression'];
  if (!isNode(expression)) return false;
  if (
    expression.type === 'UnaryExpression' &&
    (expression['operator'] === '-' || expression['operator'] === '+') &&
    isNode(expression['argument']) &&
    expression['argument'].type === 'Literal' &&
    typeof expression['argument']['value'] === 'number'
  )
    return true;
  return (
    (expression.type === 'Literal' &&
      (typeof expression['value'] === 'string' || typeof expression['value'] === 'number')) ||
    (expression.type === 'TemplateLiteral' &&
      Array.isArray(expression['expressions']) &&
      expression['expressions'].length === 0)
  );
}

export function findStaticStyleAttributes(source: string): StaticStyleAttributeViolation[] {
  const violations: StaticStyleAttributeViolation[] = [];
  const ast = parse(source, { modern: true });

  function visit(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    if (!isNode(value)) return;

    if (
      ((value.type === 'Attribute' && value.name === 'style') || value.type === 'StyleDirective') &&
      isStaticValue(value.value)
    ) {
      violations.push({
        line: value.name_loc?.start.line ?? 1,
        column: (value.name_loc?.start.column ?? 0) + 1,
      });
    }

    for (const [key, child] of Object.entries(value)) {
      if (key !== 'metadata') visit(child);
    }
  }

  visit(ast['fragment']);
  return violations;
}

async function scan(): Promise<Array<StaticStyleAttributeViolation & { filePath: string }>> {
  const violations: Array<StaticStyleAttributeViolation & { filePath: string }> = [];
  const glob = new Glob('**/*.svelte');

  for await (const relativePath of glob.scan({ cwd: sourceRoot })) {
    const absolutePath = resolve(sourceRoot, relativePath);
    const source = await Bun.file(absolutePath).text();

    for (const violation of findStaticStyleAttributes(source)) {
      violations.push({
        filePath: relative(resolve(sourceRoot, '..', '..', '..'), absolutePath),
        ...violation,
      });
    }
  }

  return violations;
}

async function main(): Promise<void> {
  const violations = await scan();
  if (violations.length === 0) {
    process.stdout.write(
      'check-no-static-style-attributes — OK (Svelte source emits no static inline styles).\n',
    );
    return;
  }

  process.stderr.write(
    'check-no-static-style-attributes — static style attributes violate strict style-src CSP. Move static declarations to CSS; use a style: directive only for genuinely dynamic values.\n\n',
  );
  for (const violation of violations) {
    process.stderr.write(`  ${violation.filePath}:${violation.line}:${violation.column}\n`);
  }
  process.exit(1);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('check-no-static-style-attributes failed:', error);
    process.exit(1);
  });
}
