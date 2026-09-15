import ts from 'typescript';
import { dynamicRecord, reportUnsupported } from './css-inventory-diagnostics';
import type { Diagnostic, Source } from './css-usage-inventory';
import type { ExtractedSource } from './css-usage-inventory-extraction';

type SurfaceParser = (
  file: string,
  source: string,
  text: string,
  offset: number,
  kind: string,
  diagnostics: Diagnostic[],
) => ExtractedSource['declarations'];
type Evidence = 'dom' | 'style' | 'invalidated-style' | 'unknown';
type Scope = { parent: Scope | null; bindings: Map<string, Evidence> };

function canonicalStyleProperty(property: string): string {
  if (property === 'cssFloat') return 'float';
  for (const prefix of ['Webkit', 'Moz', 'O'])
    if (
      property.startsWith(prefix) &&
      property[prefix.length]?.toUpperCase() === property[prefix.length]
    )
      return `-${prefix.toLowerCase()}-${property
        .slice(prefix.length)
        .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
        .replace(/^-/, '')}`;
  if (property.startsWith('ms') && property[2]?.toUpperCase() === property[2])
    return `-ms-${property
      .slice(2)
      .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
      .replace(/^-/, '')}`;
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function annotationIsDom(type: ts.TypeNode | undefined): boolean {
  const text = type?.getText();
  return (
    text !== undefined && /^(?:HTMLElement|Element|SVGElement|HTML[A-Za-z]+Element)$/.test(text)
  );
}

function declarationNames(node: ts.Node): string[] {
  const names: string[] = [];
  const collect = (name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) names.push(name.text);
    else
      for (const element of name.elements) if (ts.isBindingElement(element)) collect(element.name);
  };
  if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node))
    collect(node.name);
  return names;
}

function predeclare(scope: Scope, node: ts.Node): void {
  const add = (child: ts.Node): void => {
    for (const name of declarationNames(child)) scope.bindings.set(name, 'unknown');
  };
  if (ts.isVariableStatement(node))
    for (const declaration of node.declarationList.declarations) add(declaration);
  else if (ts.isFunctionDeclaration(node) && node.name)
    scope.bindings.set(node.name.text, 'unknown');
  else if (ts.isClassDeclaration(node) && node.name) scope.bindings.set(node.name.text, 'unknown');
}

function lookup(scope: Scope, name: string): Evidence {
  for (let current: Scope | null = scope; current; current = current.parent)
    if (current.bindings.has(name)) return current.bindings.get(name)!;
  return 'unknown';
}

function setBinding(scope: Scope, name: string, evidence: Evidence): void {
  for (let current: Scope | null = scope; current; current = current.parent)
    if (current.bindings.has(name)) {
      current.bindings.set(name, evidence);
      return;
    }
  scope.bindings.set(name, evidence);
}

export function runtimeExtract(
  source: Source,
  baseOffset = 0,
  parsedContent = source.content,
  parseSurface: SurfaceParser,
): ExtractedSource {
  const result: ExtractedSource = { declarations: [], dynamic: [], diagnostics: [] };
  const file = ts.createSourceFile(
    source.path,
    parsedContent,
    ts.ScriptTarget.Latest,
    true,
    /\.tsx?$/.test(source.path) ? ts.ScriptKind.TSX : ts.ScriptKind.JSX,
  );
  const root: Scope = {
    parent: null,
    bindings: new Map(['element', 'node', 'el', '$el', 'document'].map((name) => [name, 'dom'])),
  };
  const evidenceOf = (expression: ts.Expression, scope: Scope): Evidence => {
    if (ts.isIdentifier(expression)) return lookup(scope, expression.text);
    if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'style')
      return evidenceOf(expression.expression, scope) === 'dom' ? 'style' : 'unknown';
    if (
      ts.isPropertyAccessExpression(expression) &&
      (expression.name.text === 'body' || expression.name.text === 'documentElement')
    )
      return evidenceOf(expression.expression, scope) === 'dom' ? 'dom' : 'unknown';
    return 'unknown';
  };
  const literal = (expression: ts.Expression | undefined): string | null =>
    expression && (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
      ? expression.text
      : null;
  const record = (
    node: ts.Node,
    property: string | null,
    value: string | null,
    evidence: Evidence,
  ): void => {
    const expression = parsedContent.slice(node.getStart(file), node.end);
    if (evidence === 'dom' || evidence === 'style') {
      if (value !== null)
        result.declarations.push(
          ...parseSurface(
            source.path,
            source.content,
            property === null ? value : `${property}: ${value};`,
            node.getStart(file) + baseOffset,
            'runtime-style',
            result.diagnostics,
          ),
        );
      else
        result.dynamic.push(
          dynamicRecord(
            source,
            node.getStart(file) + baseOffset,
            'runtime-style-sink',
            property,
            expression,
          ),
        );
    } else
      reportUnsupported(
        result,
        source,
        node.getStart(file) + baseOffset,
        property,
        expression,
        'Runtime style receiver lacks DOM/style evidence',
      );
  };
  const visit = (node: ts.Node, scope: Scope): void => {
    if (ts.isSourceFile(node)) {
      for (const statement of node.statements) predeclare(scope, statement);
      ts.forEachChild(node, (child) => visit(child, scope));
      return;
    }
    if (ts.isBlock(node) || ts.isModuleBlock(node)) {
      const child: Scope = { parent: scope, bindings: new Map() };
      for (const statement of node.statements) predeclare(child, statement);
      ts.forEachChild(node, (item) => visit(item, child));
      return;
    }
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      ts.isConstructorDeclaration(node)
    ) {
      const functionScope: Scope = { parent: scope, bindings: new Map() };
      for (const parameter of node.parameters)
        for (const name of declarationNames(parameter))
          functionScope.bindings.set(name, annotationIsDom(parameter.type) ? 'dom' : 'unknown');
      if (node.body) visit(node.body, functionScope);
      return;
    }
    if (ts.isCatchClause(node)) {
      const catchScope: Scope = { parent: scope, bindings: new Map() };
      if (node.variableDeclaration)
        for (const name of declarationNames(node.variableDeclaration))
          catchScope.bindings.set(name, 'unknown');
      visit(node.block, catchScope);
      return;
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      let evidence: Evidence = node.initializer ? evidenceOf(node.initializer, scope) : 'unknown';
      if (annotationIsDom(node.type)) evidence = 'dom';
      if (
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        ts.isPropertyAccessExpression(node.initializer.expression) &&
        ['querySelector', 'getElementById', 'createElement'].includes(
          node.initializer.expression.name.text,
        ) &&
        evidenceOf(node.initializer.expression.expression, scope) === 'dom'
      )
        evidence = 'dom';
      scope.bindings.set(node.name.text, evidence);
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      const evidence = evidenceOf(node.right, scope);
      const previous = lookup(scope, node.left.text);
      setBinding(
        scope,
        node.left.text,
        evidence === 'unknown' && previous === 'style' ? 'invalidated-style' : evidence,
      );
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'setProperty'
    ) {
      const evidence = evidenceOf(node.expression.expression, scope);
      const property = literal(node.arguments[0]);
      record(
        node,
        property,
        property === null ? null : literal(node.arguments[1]),
        evidence === 'style' ? 'style' : 'unknown',
      );
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left)
    ) {
      const receiver = node.left.expression;
      const evidence = evidenceOf(receiver, scope);
      if (node.left.name.text === 'cssText') {
        if (evidence === 'style') record(node, null, literal(node.right), 'style');
        else if (evidence === 'unknown' || evidence === 'invalidated-style')
          record(node, null, literal(node.right), 'unknown');
      } else if (ts.isIdentifier(receiver) && evidence === 'style')
        record(node, canonicalStyleProperty(node.left.name.text), literal(node.right), 'style');
      else if (ts.isIdentifier(receiver) && evidence === 'invalidated-style')
        record(node, canonicalStyleProperty(node.left.name.text), literal(node.right), 'unknown');
      else if (ts.isPropertyAccessExpression(receiver) && receiver.name.text === 'style')
        record(node, canonicalStyleProperty(node.left.name.text), literal(node.right), evidence);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'setAttribute' &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === 'style'
    )
      record(
        node,
        null,
        literal(node.arguments[1]),
        evidenceOf(node.expression.expression, scope) === 'dom' ? 'dom' : 'unknown',
      );
    ts.forEachChild(node, (child) => visit(child, scope));
  };
  visit(file, root);
  return result;
}
