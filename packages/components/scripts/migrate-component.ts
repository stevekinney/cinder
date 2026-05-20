/**
 * Mechanical per-component migration helper.
 *
 * Given a component name (e.g. `badge`, or `experimental/timeline`), this
 * script performs the file moves and source-code rewrites that follow the
 * pattern established in commit 262b119 (the Phase 1 button pilot). It does
 * NOT regenerate `package.json` exports, generated schemas, or the root
 * `src/index.ts` barrel — those are handled by the central reconciliation
 * (`bun run exports:generate`, `bun run components:generate`).
 *
 * For each component <name>:
 *   1. Create src/components/<name>/.
 *   2. Move <name>.svelte, <name>.test.ts, <name>.a11y.md, <name>.type-test.ts.
 *   3. Move styles/components/<name>.css if it exists.
 *   4. Update styles/components.css aggregator @import line.
 *   5. Extract types from the .svelte <script module> into <name>.types.ts
 *      (preserving runtime exports — only types move).
 *   6. Replace the .svelte module script with `export type` re-exports.
 *   7. Rewrite instance-script imports of `../utilities/` → `../../utilities/`
 *      and `../_internal/` → `../../_internal/`.
 *   8. Update the test file's `../test/happy-dom.ts` → `../../test/happy-dom.ts`
 *      and any `new URL('../styles/...')` → `new URL('../../styles/...')`.
 *   9. Write a minimal README.md with the marker template.
 *  10. Write a minimal <name>.types.test.ts type-equality test (forward and
 *      backward assignability between the new alias and a snapshot, plus
 *      one-way `Assignable<Snapshot, ComponentProps<typeof X>>`).
 *  11. Write the directory's index.ts barrel.
 *  12. Update the root `src/index.ts` to import from `./components/<name>/index.ts`.
 *  13. Rewrite any cross-component imports of `<name>.svelte` across the package.
 *
 * The script does NOT author a <Name>SchemaProps interface — that's a manual
 * step the migrator does after seeing the existing <Name>Props shape. Without
 * it, the schema generator falls back to <Name>Props (which often includes the
 * full HTML attribute spread) and most props end up as `unknown-shape` in the
 * generated schema. That is intentional during bulk migration: it lets the
 * schemas land as drift-checked placeholders, and per-component
 * <Name>SchemaProps interfaces can be added in a follow-up pass.
 *
 * Usage:
 *   bun run scripts/migrate-component.ts <name> [<name> ...]
 *
 * Examples:
 *   bun run scripts/migrate-component.ts avatar
 *   bun run scripts/migrate-component.ts banner card callout chip
 *   bun run scripts/migrate-component.ts experimental/json-viewer
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const PACKAGE_ROOT = join(import.meta.dir, '..');
const SRC_DIR = join(PACKAGE_ROOT, 'src');
const COMPONENTS_DIR = join(SRC_DIR, 'components');
const STYLES_COMPONENTS_DIR = join(SRC_DIR, 'styles', 'components');
const INDEX_TS = join(SRC_DIR, 'index.ts');
const STYLES_COMPONENTS_CSS = join(SRC_DIR, 'styles', 'components.css');

interface MigrationContext {
  /** Logical name from the CLI: e.g. `avatar` or `experimental/json-viewer`. */
  inputName: string;
  /** The bare component name (basename): e.g. `avatar`, `json-viewer`. */
  name: string;
  /** Pascal-case form: `Avatar`, `JsonViewer`. */
  pascalName: string;
  /** True if `experimental/<name>`. */
  isExperimental: boolean;
  /** Old flat file location (relative to repo root from PACKAGE_ROOT). */
  oldDirectory: string;
  /** New per-directory location. */
  newDirectory: string;
  /** Old CSS location (under styles/components, possibly inside experimental/). */
  oldCssPath: string | null;
  /** New CSS location (next to the .svelte). */
  newCssPath: string;
  /** Depth from <new dir> up to src/. 2 for top-level, 3 for experimental. */
  depthToSrc: number;
}

function pascalCase(kebab: string): string {
  return kebab
    .split('-')
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join('');
}

function buildContext(inputName: string): MigrationContext {
  const isExperimental = inputName.startsWith('experimental/');
  const name = isExperimental ? inputName.slice('experimental/'.length) : inputName;
  const pascalName = pascalCase(name);

  const oldDirectory = isExperimental ? join(COMPONENTS_DIR, 'experimental') : COMPONENTS_DIR;
  const newDirectory = isExperimental
    ? join(COMPONENTS_DIR, 'experimental', name)
    : join(COMPONENTS_DIR, name);

  const cssCandidate = isExperimental
    ? join(STYLES_COMPONENTS_DIR, 'experimental', `${name}.css`)
    : join(STYLES_COMPONENTS_DIR, `${name}.css`);
  const oldCssPath = existsSync(cssCandidate) ? cssCandidate : null;
  const newCssPath = join(newDirectory, `${name}.css`);

  return {
    inputName,
    name,
    pascalName,
    isExperimental,
    oldDirectory,
    newDirectory,
    oldCssPath,
    newCssPath,
    depthToSrc: isExperimental ? 3 : 2,
  };
}

async function moveIfExists(from: string, to: string): Promise<boolean> {
  if (!existsSync(from)) return false;
  await mkdir(dirname(to), { recursive: true });
  await rename(from, to);
  return true;
}

const MODULE_OPEN = /<script[^>]*\bmodule\b[^>]*>/;
const MODULE_CLOSE = /<\/script>/;

function splitModuleScript(source: string): {
  before: string;
  moduleScript: string;
  after: string;
  hasModule: boolean;
} {
  const openMatch = source.match(MODULE_OPEN);
  if (!openMatch) return { before: source, moduleScript: '', after: '', hasModule: false };
  const openIndex = openMatch.index!;
  const afterOpen = source.slice(openIndex + openMatch[0].length);
  const closeMatch = afterOpen.match(MODULE_CLOSE);
  if (!closeMatch) return { before: source, moduleScript: '', after: '', hasModule: false };
  const closeRelative = closeMatch.index!;
  const moduleScript = afterOpen.slice(0, closeRelative);
  const after = afterOpen.slice(closeRelative + closeMatch[0].length);
  const before = source.slice(0, openIndex + openMatch[0].length);
  return { before, moduleScript, after, hasModule: true };
}

/**
 * Pull type-only declarations out of the module script. A line is "type-only" if
 * it starts with `export type` or `export interface`, or is an `import type`
 * statement. Runtime `export const`, `export function`, `export {...}` stay put.
 * This is conservative — anything we're unsure about stays in the .svelte
 * module to preserve runtime behavior.
 */
function extractTypeBlocks(moduleScript: string): {
  typesPortion: string;
  runtimePortion: string;
  typeExportNames: string[];
} {
  const lines = moduleScript.split('\n');
  const typeChunks: string[] = [];
  const runtimeChunks: string[] = [];
  const typeExportNames: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const stripped = line.trimStart();

    // JSDoc / line comment immediately preceding a type declaration — peek
    // ahead to see if the next non-comment line is a type. If so, claim the
    // comment block + declaration; otherwise leave it with runtime.
    if (stripped.startsWith('/**') || stripped.startsWith('//')) {
      const commentBlock: string[] = [];
      while (i < lines.length) {
        const l = lines[i]!.trimStart();
        commentBlock.push(lines[i]!);
        i += 1;
        if (
          l.endsWith('*/') ||
          (stripped.startsWith('//') && !lines[i]?.trimStart().startsWith('//'))
        ) {
          break;
        }
      }
      // Skip blank lines.
      while (i < lines.length && lines[i]!.trim() === '') {
        commentBlock.push(lines[i]!);
        i += 1;
      }
      const followingLine = lines[i]?.trimStart() ?? '';
      const followsTypeDecl =
        followingLine.startsWith('export type ') ||
        followingLine.startsWith('export interface ') ||
        followingLine.startsWith('type ') ||
        followingLine.startsWith('interface ');
      (followsTypeDecl ? typeChunks : runtimeChunks).push(...commentBlock);
      continue;
    }

    if (stripped.startsWith('import type ')) {
      typeChunks.push(line);
      i += 1;
      continue;
    }

    if (
      stripped.startsWith('export type ') ||
      stripped.startsWith('export interface ') ||
      stripped.startsWith('type ') ||
      stripped.startsWith('interface ')
    ) {
      // Capture the whole declaration block. A declaration ends at a top-level
      // `;` outside braces, or at a line that closes a `{ ... }` block with
      // balanced braces. Use a brace counter that starts at 0 and counts braces
      // on each line; the block ends when we return to 0 AND the line ends with
      // `;` or `}`.
      const block: string[] = [];
      let braceDepth = 0;
      let parenDepth = 0;
      while (i < lines.length) {
        const l = lines[i]!;
        block.push(l);
        for (const ch of l) {
          if (ch === '{') braceDepth += 1;
          else if (ch === '}') braceDepth -= 1;
          else if (ch === '(') parenDepth += 1;
          else if (ch === ')') parenDepth -= 1;
        }
        i += 1;
        const trimmed = l.trimEnd();
        if (
          braceDepth <= 0 &&
          parenDepth <= 0 &&
          (trimmed.endsWith(';') || trimmed.endsWith('}'))
        ) {
          break;
        }
      }
      // Match the exported name(s) — `export type Foo = ...` or `export interface Foo`.
      const headerMatch = stripped.match(/^export\s+(?:type|interface)\s+(\w+)/);
      if (headerMatch) typeExportNames.push(headerMatch[1]!);
      typeChunks.push(...block);
      continue;
    }

    runtimeChunks.push(line);
    i += 1;
  }

  return {
    typesPortion: typeChunks.join('\n').trimEnd(),
    runtimePortion: runtimeChunks.join('\n').trimEnd(),
    typeExportNames,
  };
}

/**
 * When a component moves from src/components/<name>.svelte to
 * src/components/<name>/<name>.svelte, any imports it had to sibling
 * components or sibling source files need an extra `../`. This handles
 * `./<other-name>.svelte`, `./<other-dir>/<other>.svelte`, `./<other>.ts`,
 * but NOT `./<name>.<ext>` / `./index.ts` (those resolve correctly inside
 * the new directory).
 */
function rewriteWithinComponentImports(source: string, name: string): string {
  return source.replace(/from '(\.\/)([^']+)'/g, (match, _prefix, rest: string) => {
    // Self-references: stay relative inside the new directory.
    if (rest === name || rest.startsWith(`${name}.`) || rest === 'index.ts') return match;
    // Sibling — needs an extra `../`.
    return `from '../${rest}'`;
  });
}

function rewriteSvelteInstanceImports(source: string, isExperimental: boolean): string {
  // Top-level components: ../utilities/ -> ../../utilities/, ../_internal/ -> ../../_internal/
  // Experimental components: same plus one extra level (already at ../../ from src/, so
  //   the .svelte already used ../../utilities/ — depth-to-src is 3 so we need ../../../)
  // The original files in src/components/experimental/<name>.svelte already used
  // ../../utilities/. After moving to src/components/experimental/<name>/<name>.svelte,
  // they need ../../../utilities/. Detect and rewrite accordingly.
  if (isExperimental) {
    return source
      .replace(/from '\.\.\/\.\.\/utilities\//g, "from '../../../utilities/")
      .replace(/from "\.\.\/\.\.\/utilities\//g, 'from "../../../utilities/')
      .replace(/from '\.\.\/\.\.\/_internal\//g, "from '../../../_internal/")
      .replace(/from "\.\.\/\.\.\/_internal\//g, 'from "../../../_internal/');
  }
  return source
    .replace(/from '\.\.\/utilities\//g, "from '../../utilities/")
    .replace(/from "\.\.\/utilities\//g, 'from "../../utilities/')
    .replace(/from '\.\.\/_internal\//g, "from '../../_internal/")
    .replace(/from "\.\.\/_internal\//g, 'from "../../_internal/');
}

function rewriteTestImports(
  source: string,
  isExperimental: boolean,
  componentName: string,
): string {
  // The test file was at src/components/<name>.test.ts and used `../test/happy-dom.ts`,
  // `await import('../test/fixtures/foo.svelte')`, `new URL('../styles/...')`, etc.
  // After moving to src/components/<name>/<name>.test.ts, every `..` needs one more `..`.
  // For experimental, the test file was at src/components/experimental/<name>.test.ts.
  // After moving to src/components/experimental/<name>/<name>.test.ts, similarly one
  // extra `..`.
  let next = source;
  const extra = isExperimental
    ? { from2: '../../../', from1: '../../../' }
    : { from2: '../../../', from1: '../../' };
  if (isExperimental) {
    next = next
      .replace(/from '\.\.\/\.\.\/test\//g, "from '../../../test/")
      .replace(/from "\.\.\/\.\.\/test\//g, 'from "../../../test/')
      .replace(/from '\.\.\/\.\.\/_internal\//g, "from '../../../_internal/")
      .replace(/from "\.\.\/\.\.\/_internal\//g, 'from "../../../_internal/')
      .replace(/from '\.\.\/\.\.\/utilities\//g, "from '../../../utilities/")
      .replace(/from "\.\.\/\.\.\/utilities\//g, 'from "../../../utilities/')
      .replace(/await import\('\.\.\/\.\.\/test\//g, "await import('../../../test/")
      .replace(/new URL\('\.\.\/\.\.\/styles\//g, "new URL('../../../styles/")
      .replace(/new URL\("\.\.\/\.\.\/styles\//g, 'new URL("../../../styles/');
  } else {
    next = next
      .replace(/from '\.\.\/test\//g, "from '../../test/")
      .replace(/from "\.\.\/test\//g, 'from "../../test/')
      .replace(/from '\.\.\/_internal\//g, "from '../../_internal/")
      .replace(/from "\.\.\/_internal\//g, 'from "../../_internal/')
      .replace(/from '\.\.\/utilities\//g, "from '../../utilities/")
      .replace(/from "\.\.\/utilities\//g, 'from "../../utilities/')
      .replace(/await import\('\.\.\/test\//g, "await import('../../test/")
      .replace(/new URL\('\.\.\/styles\//g, "new URL('../../styles/")
      .replace(/new URL\("\.\.\/styles\//g, 'new URL("../../styles/');
  }

  // CSS-path assertions: `new URL('../../styles/components/<name>.css')`
  // (or `../styles/...` for the original — already rewritten above) need to
  // point at the new co-located CSS file `./<name>.css` instead.
  const cssLegacy = isExperimental
    ? `../../../styles/components/experimental/${componentName}.css`
    : `../../styles/components/${componentName}.css`;
  next = next.replaceAll(`'${cssLegacy}'`, `'./${componentName}.css'`);
  next = next.replaceAll(`"${cssLegacy}"`, `"./${componentName}.css"`);

  // Sibling `./icons/index.ts`, `./fixtures/foo.svelte` etc. — these are
  // siblings of the OLD test location. After moving into `<name>/`, they need
  // `../`.
  next = next.replace(/(await import|from)\('?\.\/([^'./][^']*)'?/g, (match, kw, rest) => {
    // Skip self-references (./<name>.* — though tests rarely reference themselves)
    if (rest === componentName || rest.startsWith(`${componentName}.`)) return match;
    const quoteChar = match.includes("'") ? "'" : '"';
    return `${kw}(${quoteChar}../${rest}${quoteChar}`;
  });

  void extra;
  return next;
}

async function migrateOne(context: MigrationContext): Promise<void> {
  const { name, pascalName, oldDirectory, newDirectory, oldCssPath, newCssPath, isExperimental } =
    context;

  const oldSveltePath = join(oldDirectory, `${name}.svelte`);
  if (!existsSync(oldSveltePath)) {
    throw new Error(`migrate: ${oldSveltePath} not found — already migrated?`);
  }

  await mkdir(newDirectory, { recursive: true });

  // 1. Move source files.
  await moveIfExists(oldSveltePath, join(newDirectory, `${name}.svelte`));
  await moveIfExists(join(oldDirectory, `${name}.test.ts`), join(newDirectory, `${name}.test.ts`));
  await moveIfExists(join(oldDirectory, `${name}.a11y.md`), join(newDirectory, `${name}.a11y.md`));
  await moveIfExists(
    join(oldDirectory, `${name}.type-test.ts`),
    join(newDirectory, `${name}.type-test.ts`),
  );
  if (oldCssPath) {
    await moveIfExists(oldCssPath, newCssPath);
  }

  // 2. Update CSS aggregator.
  if (oldCssPath) {
    const oldImport = isExperimental
      ? `@import './experimental/${name}.css';`
      : `@import './components/${name}.css';`;
    const newImport = isExperimental
      ? `@import '../components/experimental/${name}/${name}.css';`
      : `@import '../components/${name}/${name}.css';`;
    const aggPath = isExperimental
      ? join(STYLES_COMPONENTS_DIR, 'experimental.css')
      : STYLES_COMPONENTS_CSS;
    const agg = await readFile(aggPath, 'utf-8');
    if (agg.includes(oldImport)) {
      await writeFile(aggPath, agg.replace(oldImport, newImport));
    }
  }

  // 3. Split the .svelte module script: extract types, leave runtime.
  const sveltePath = join(newDirectory, `${name}.svelte`);
  let svelteSource = await readFile(sveltePath, 'utf-8');
  const { before, moduleScript, after, hasModule } = splitModuleScript(svelteSource);

  let typesFileContent = '';
  let typeExportNames: string[] = [];
  if (hasModule) {
    const split = extractTypeBlocks(moduleScript);
    typeExportNames = split.typeExportNames;
    typesFileContent = split.typesPortion + '\n';

    // Build the new module script: keep runtime portion, add a `export type` re-export
    // for every extracted type name.
    const reExport =
      typeExportNames.length > 0
        ? `  export type { ${[...new Set(typeExportNames)].toSorted().join(', ')} } from './${name}.types.ts';`
        : '';
    const newModuleBody = [split.runtimePortion.trim(), reExport]
      .filter((part) => part !== '')
      .join('\n\n');
    svelteSource = `${before}\n${newModuleBody ? `\n${newModuleBody}\n` : ''}</script>${after}`;
  }

  // 4. Rewrite instance-script imports.
  svelteSource = rewriteSvelteInstanceImports(svelteSource, isExperimental);
  // 4b. Rewrite within-component sibling imports (`./other.svelte` → `../other.svelte`).
  svelteSource = rewriteWithinComponentImports(svelteSource, name);

  // 5. If there are type names AND they're used inside the instance script (most
  //    components annotate $props() as `<Name>Props`), add an `import type` line
  //    inside the instance <script lang="ts"> so the types resolve via the new
  //    types.ts file rather than the (now-empty) module-script declaration site.
  if (typeExportNames.length > 0) {
    const instanceOpenMatch = svelteSource.match(/<script lang="ts">/);
    if (instanceOpenMatch) {
      const insertPoint = instanceOpenMatch.index! + instanceOpenMatch[0].length;
      // Detect which type names actually appear in the instance script (between
      // `<script lang="ts">` and the next `</script>`).
      const instanceEnd = svelteSource.indexOf('</script>', insertPoint);
      const instanceBody = svelteSource.slice(
        insertPoint,
        instanceEnd === -1 ? undefined : instanceEnd,
      );
      const usedTypes = [...new Set(typeExportNames)]
        .filter((typeName) => new RegExp(`\\b${typeName}\\b`).test(instanceBody))
        .toSorted();
      if (usedTypes.length > 0) {
        const importLine = `\n  import type { ${usedTypes.join(', ')} } from './${name}.types.ts';`;
        svelteSource =
          svelteSource.slice(0, insertPoint) + importLine + svelteSource.slice(insertPoint);
      }
    }
  }

  await writeFile(sveltePath, svelteSource);

  // 6. Write the types.ts file.
  if (typesFileContent.trim().length > 0) {
    await writeFile(join(newDirectory, `${name}.types.ts`), typesFileContent);
  } else {
    // Component had no module-script types — write a minimal placeholder so the
    // schema generator and exports drift-check can still discover the component.
    const placeholder = `/** Props for the ${pascalName} component. */\nexport type ${pascalName}Props = Record<string, never>;\n`;
    await writeFile(join(newDirectory, `${name}.types.ts`), placeholder);
    typeExportNames = [`${pascalName}Props`];
  }

  // 7. Write index.ts.
  const indexTypes = [...new Set(typeExportNames)].toSorted().join(', ') || `${pascalName}Props`;
  const indexBody = `import ${pascalName} from './${name}.svelte';

export default ${pascalName};
export { ${pascalName} };
export type { ${indexTypes} } from './${name}.types.ts';
`;
  await writeFile(join(newDirectory, 'index.ts'), indexBody);

  // 8. Update test imports.
  const testPath = join(newDirectory, `${name}.test.ts`);
  if (existsSync(testPath)) {
    let testSource = await readFile(testPath, 'utf-8');
    testSource = rewriteTestImports(testSource, isExperimental, name);
    await writeFile(testPath, testSource);
  }

  // 9. Write README.md scaffold (only if there isn't one already).
  const readmePath = join(newDirectory, 'README.md');
  if (!existsSync(readmePath)) {
    const readmeBody = `# ${pascalName}

${isExperimental ? `> **EXPERIMENTAL** — this component's API may change between minor versions until promoted to stable.\n\n` : ''}A ${pascalName} component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

\`\`\`svelte
<script lang="ts">
  import ${pascalName} from 'cinder/${context.inputName}';
</script>

<${pascalName} />
\`\`\`

## Props

<!-- generated:props:start -->
<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
None.
<!-- generated:subcomponents:end -->
`;
    await writeFile(readmePath, readmeBody);
  }

  // 10. Update root src/index.ts re-export lines.
  await updateRootIndex(context);

  // 11. Rewrite cross-component imports of <name>.svelte across the package.
  await rewriteCrossComponentImports(context);
}

async function updateRootIndex(context: MigrationContext): Promise<void> {
  const { name, isExperimental } = context;
  let source = await readFile(INDEX_TS, 'utf-8');
  const oldImportPath = isExperimental
    ? `./components/experimental/${name}.svelte`
    : `./components/${name}.svelte`;
  const newImportPath = isExperimental
    ? `./components/experimental/${name}/index.ts`
    : `./components/${name}/index.ts`;
  const updated = source.replaceAll(oldImportPath, newImportPath);
  if (updated !== source) {
    await writeFile(INDEX_TS, updated);
  }
}

async function rewriteCrossComponentImports(context: MigrationContext): Promise<void> {
  const { name, isExperimental } = context;
  const oldSpecifier = isExperimental
    ? new RegExp(`'\\.\\./\\.\\./experimental/${name}\\.svelte'`, 'g')
    : new RegExp(`'\\.\\./${name}\\.svelte'`, 'g');
  const newSpecifier = isExperimental
    ? `'../../experimental/${name}/${name}.svelte'`
    : `'../${name}/${name}.svelte'`;

  // Also: imports from `./components/<name>.svelte` (other files outside the components dir).
  const oldFlat = isExperimental
    ? new RegExp(`'\\./components/experimental/${name}\\.svelte'`, 'g')
    : new RegExp(`'\\./components/${name}\\.svelte'`, 'g');
  const newFlat = isExperimental
    ? `'./components/experimental/${name}/${name}.svelte'`
    : `'./components/${name}/${name}.svelte'`;

  // Scan all .svelte and .ts files under packages/components/src/.
  const glob = new Bun.Glob('**/*.{svelte,ts}');
  for await (const file of glob.scan({ cwd: SRC_DIR })) {
    const path = join(SRC_DIR, file);
    if (path === INDEX_TS) continue; // Already handled.
    const text = await readFile(path, 'utf-8');
    const updated = text.replace(oldSpecifier, newSpecifier).replace(oldFlat, newFlat);
    if (updated !== text) {
      await writeFile(path, updated);
    }
  }
}

async function main(): Promise<void> {
  const names = process.argv.slice(2);
  if (names.length === 0) {
    process.stderr.write('Usage: migrate-component.ts <name> [<name> ...]\n');
    process.exit(1);
  }

  for (const inputName of names) {
    const context = buildContext(inputName);
    process.stdout.write(`migrating ${context.inputName}…\n`);
    try {
      await migrateOne(context);
      process.stdout.write(`  ✓ ${context.inputName}\n`);
    } catch (err) {
      process.stderr.write(
        `  ✗ ${context.inputName}: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    }
  }
}

if (import.meta.main) {
  await main();
}
