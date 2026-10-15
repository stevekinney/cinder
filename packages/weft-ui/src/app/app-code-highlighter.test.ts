/**
 * The app root publishes the UI's curated code highlighter.
 *
 * Cinder's `CodeBlock` imports no highlighter of its own: a block highlights
 * with its `highlighter` prop or with the one an ancestor publishes through
 * `setCodeHighlighterContext`. The UI's root therefore publishes
 * `codeHighlighter` (JSON and TypeScript only) for its whole tree during
 * initialization. The root's boot sequence (runtime config, principal probe)
 * is too heavy to mount for this one fact, so this reads the component source
 * as the sibling source-contract tests do.
 */
import { describe, expect, test } from 'bun:test';
import { parse } from 'svelte/compiler';

const APP_PATH = new URL('./app.svelte', import.meta.url).pathname;
const ast = parse(await Bun.file(APP_PATH).text(), { filename: APP_PATH, modern: true });
const statements = ast.instance?.content.body ?? [];

describe('app root code highlighter', () => {
  test('imports the curated highlighter and the context setter', () => {
    const imports = new Map<string, string[]>();
    for (const statement of statements) {
      if (statement.type !== 'ImportDeclaration' || typeof statement.source.value !== 'string') {
        continue;
      }
      imports.set(
        statement.source.value,
        statement.specifiers.map((specifier) => specifier.local.name),
      );
    }
    expect(imports.get('../lib/code-highlighter.ts')).toEqual(['codeHighlighter']);
    expect(imports.get('@lostgradient/cinder')).toContain('setCodeHighlighterContext');
  });

  test('publishes it during initialization, at the top level of the instance script', () => {
    const publications = statements.filter(
      (statement) =>
        statement.type === 'ExpressionStatement' &&
        statement.expression.type === 'CallExpression' &&
        statement.expression.callee.type === 'Identifier' &&
        statement.expression.callee.name === 'setCodeHighlighterContext',
    );
    expect(publications).toHaveLength(1);
    const [publication] = publications;
    if (publication?.type !== 'ExpressionStatement') throw new Error('Expected one publication.');
    if (publication.expression.type !== 'CallExpression') throw new Error('Expected a call.');
    expect(publication.expression.arguments).toMatchObject([
      { type: 'Identifier', name: 'codeHighlighter' },
    ]);
  });
});
