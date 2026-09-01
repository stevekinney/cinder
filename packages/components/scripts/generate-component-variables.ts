/**
 * Extracts CSS custom-property declarations (`--cinder-*`) for a single
 * component directory and emits both a JSON list and a TypeScript module.
 *
 * Uses `postcss` to walk the AST so comments and `var(--x, fallback)`
 * consumption are correctly excluded.
 */

import { basename, join } from 'node:path';

import { readFile, readdir } from 'node:fs/promises';
import { parse, type AtRule, type Declaration } from 'postcss';

const PREFIX = '--cinder-';

type RegistryEntry = { component?: unknown; cssProperty?: unknown; public?: unknown };

/**
 * Corpus-owned tokens are emitted by the shared `:root` stylesheet, so they
 * no longer appear as declarations in a component's CSS. Keep them in the
 * component variable entrypoint nevertheless: the variables subpath is the
 * public discovery surface consumed by the CLI, MCP, and generated README.
 */
async function readCorpusVariables(
  componentDirectory: string,
  componentName: string,
): Promise<Set<string>> {
  const registryPath = join(
    componentDirectory,
    '..',
    '..',
    '..',
    'src',
    'tokens',
    'registry.generated.json',
  );
  const parsed: unknown = JSON.parse(await readFile(registryPath, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || !('entries' in parsed)) return new Set();
  if (!Array.isArray(parsed.entries)) return new Set();

  return new Set(
    parsed.entries
      .filter((entry): entry is RegistryEntry => typeof entry === 'object' && entry !== null)
      .filter((entry) => entry.component === componentName && entry.public === true)
      .map((entry) => entry.cssProperty)
      .filter(
        (property): property is string =>
          typeof property === 'string' && property.startsWith(PREFIX),
      ),
  );
}

export interface VariablesResult {
  variables: readonly string[];
  variablesJson: string;
  variablesModule: string;
}

export interface GenerateVariablesOptions {
  /** Absolute path to the component directory containing `<name>.css`. */
  componentDirectory: string;
  /** The component's directory name (used to derive sibling .css files). */
  componentName: string;
}

/**
 * Extract declared CSS custom properties (`--cinder-*`) from every `.css` file
 * in the component directory. Includes `@property --cinder-*` at-rules.
 * Excludes declarations explicitly marked `@runtime-state`, consumption via
 * `var(--cinder-*, fallback)`, comments, and declarations on the right-hand
 * side of another declaration.
 */
export async function generateVariablesForComponent(
  options: GenerateVariablesOptions,
): Promise<VariablesResult> {
  const { componentDirectory } = options;
  const entries = await readdir(componentDirectory);
  const cssFiles = entries.filter((name) => name.endsWith('.css')).toSorted();

  const collected = await readCorpusVariables(componentDirectory, options.componentName);

  for (const cssFile of cssFiles) {
    const filePath = join(componentDirectory, cssFile);
    const source = await Bun.file(filePath).text();
    const root = parse(source, { from: filePath });

    root.walkDecls((decl: Declaration) => {
      if (decl.prop.startsWith(PREFIX) && !isRuntimeStateDeclaration(decl)) {
        collected.add(decl.prop);
      }
    });

    root.walkAtRules('property', (atRule: AtRule) => {
      const params = atRule.params.trim();
      if (params.startsWith(PREFIX)) collected.add(params);
    });
  }

  const variables = [...collected].toSorted();
  const variablesJson = JSON.stringify(variables, null, 2) + '\n';
  const variablesModule = renderVariablesModule(variables);

  return { variables, variablesJson, variablesModule };
}

/** Runtime-state variables are implementation details, not theme overrides. */
function isRuntimeStateDeclaration(declaration: Declaration): boolean {
  const previous = declaration.prev();
  return previous?.type === 'comment' && previous.text.trim() === '@runtime-state';
}

function renderVariablesModule(variables: readonly string[]): string {
  const literal = JSON.stringify(variables, null, 2);
  return [
    `const variables: readonly string[] = ${literal};`,
    ``,
    `export default variables;`,
    ``,
  ].join('\n');
}

if (import.meta.main) {
  const dir = process.argv[2];
  if (!dir) {
    process.stderr.write('Usage: generate-component-variables.ts <component-dir>\n');
    process.exit(1);
  }
  const componentName = basename(dir);
  const result = await generateVariablesForComponent({
    componentDirectory: dir,
    componentName,
  });
  await Bun.write(join(dir, `${componentName}.variables.json`), result.variablesJson);
  await Bun.write(join(dir, `${componentName}.variables.ts`), result.variablesModule);
  process.stdout.write(`wrote ${componentName}.variables.{json,ts}\n`);
}
