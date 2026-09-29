import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import babelPlugin from 'prettier/plugins/babel';
import estreePlugin from 'prettier/plugins/estree';
import postcssPlugin from 'prettier/plugins/postcss';
import { tokenRoot } from './load.ts';
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(scriptDirectory, '..', '..');
export const tokensBaseCssPath = join(packageRoot, 'src', 'styles', 'tokens-base.css');
export const resolvedDirectory = join(tokenRoot, 'resolved');
export const registryJsonPath = join(tokenRoot, 'registry.generated.json');
export const registryModulePath = join(tokenRoot, 'registry.generated.ts');
export const tokenIndexPath = join(tokenRoot, 'index.json');
export const tokensDocPath = join(packageRoot, 'documentation', 'tokens.md');
export const REGENERATE_COMMAND = 'bun run --filter=@lostgradient/cinder tokens:generate';
export const PRETTIER_OPTIONS = {
  singleQuote: true,
  tabWidth: 2,
  printWidth: 100,
  endOfLine: 'lf',
} as const;
export const JSON_PLUGINS = [babelPlugin, estreePlugin];
export const CSS_PLUGINS = [postcssPlugin];
