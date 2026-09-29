import { expect, test } from 'bun:test';
import { join } from 'node:path';
import ts from 'typescript';

import { discoverComponents } from '../../scripts/lib/discover-components.ts';

function importsSidecar(source: string, componentName: string): boolean {
  const parsed = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
  return parsed.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      !statement.importClause &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === `./${componentName}.css`,
  );
}

test('every component source entry imports its co-located stylesheet', async () => {
  const componentRoot = join(import.meta.dir, '..', 'components');
  const missing: string[] = [];
  let sidecarCount = 0;
  for (const component of await discoverComponents()) {
    if (!component.hasCss) continue;
    sidecarCount++;
    const directory = component.isExperimental
      ? join(componentRoot, 'experimental', component.name)
      : join(componentRoot, component.name);
    const entry = join(directory, 'index.ts');
    if (!importsSidecar(await Bun.file(entry).text(), component.name)) {
      missing.push(entry);
    }
  }
  expect(sidecarCount).toBeGreaterThan(0);
  expect(missing).toEqual([]);
});

test('comments and strings cannot satisfy the stylesheet import contract', () => {
  expect(importsSidecar("// import './button.css';", 'button')).toBe(false);
  expect(importsSidecar('const sample = "import \'./button.css\';";', 'button')).toBe(false);
  expect(importsSidecar("import './other.css';", 'button')).toBe(false);
  expect(importsSidecar("import './button.css';", 'button')).toBe(true);
  expect(importsSidecar('import "./button.css";', 'button')).toBe(true);
});
