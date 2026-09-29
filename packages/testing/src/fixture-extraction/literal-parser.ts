import ts from 'typescript';

export type LiteralResult = { value: unknown } | { violation: string };

function position(sourceFile: ts.SourceFile, node: ts.Node): string {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.pos);
  return `${line + 1}:${character + 1}`;
}

function nonLiteral(
  node: ts.Node,
  componentName: string,
  sourceFile: ts.SourceFile,
): LiteralResult {
  return {
    violation: `[${componentName}] non-literal expression at ${position(sourceFile, node)}: ${ts.SyntaxKind[node.kind]}`,
  };
}

function extractArray(
  node: ts.ArrayLiteralExpression,
  importedNames: ReadonlySet<string>,
  componentName: string,
  sourceFile: ts.SourceFile,
): LiteralResult {
  const items: unknown[] = [];
  for (const element of node.elements) {
    if (ts.isSpreadElement(element)) {
      return { violation: `[${componentName}] spread element at ${position(sourceFile, element)}` };
    }
    const result = extractLiteralValue(element, importedNames, componentName, sourceFile);
    if ('violation' in result) return result;
    items.push(result.value);
  }
  return { value: items };
}

function propertyKey(
  property: ts.PropertyAssignment,
  componentName: string,
  sourceFile: ts.SourceFile,
): { key: string } | { violation: string } {
  if (ts.isComputedPropertyName(property.name)) {
    return {
      violation: `[${componentName}] computed property name at ${position(sourceFile, property.name)}`,
    };
  }
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) {
    return { key: property.name.text };
  }
  return {
    violation: `[${componentName}] non-literal property name at ${position(sourceFile, property.name)}: ${ts.SyntaxKind[property.name.kind]}`,
  };
}

function extractObject(
  node: ts.ObjectLiteralExpression,
  importedNames: ReadonlySet<string>,
  componentName: string,
  sourceFile: ts.SourceFile,
): LiteralResult {
  const object: Record<string, unknown> = {};
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) {
      return {
        violation: `[${componentName}] spread element at ${position(sourceFile, property)}`,
      };
    }
    if (!ts.isPropertyAssignment(property)) {
      return {
        violation: `[${componentName}] non-literal expression at ${position(sourceFile, property)}: ${ts.SyntaxKind[property.kind]}`,
      };
    }
    const keyResult = propertyKey(property, componentName, sourceFile);
    if ('violation' in keyResult) return keyResult;
    const result = extractLiteralValue(
      property.initializer,
      importedNames,
      componentName,
      sourceFile,
    );
    if ('violation' in result) return result;
    object[keyResult.key] = result.value;
  }
  return { value: object };
}

function extractIdentifier(
  node: ts.Identifier,
  importedNames: ReadonlySet<string>,
  componentName: string,
  sourceFile: ts.SourceFile,
): LiteralResult {
  if (importedNames.has(node.text)) {
    return {
      violation: `[${componentName}] imported identifier '${node.text}' used in fixture at ${position(sourceFile, node)}`,
    };
  }
  return nonLiteral(node, componentName, sourceFile);
}

function extractPrimitive(node: ts.Expression): LiteralResult | undefined {
  if (ts.isStringLiteral(node)) return { value: node.text };
  if (ts.isNumericLiteral(node)) return { value: Number(node.text) };
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return { value: -Number(node.operand.text) };
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) return { value: true };
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { value: false };
  if (node.kind === ts.SyntaxKind.NullKeyword) return { value: null };
  return undefined;
}

export function extractLiteralValue(
  node: ts.Expression,
  importedNames: ReadonlySet<string>,
  componentName: string,
  sourceFile: ts.SourceFile,
): LiteralResult {
  const primitive = extractPrimitive(node);
  if (primitive !== undefined) return primitive;
  if (ts.isArrayLiteralExpression(node))
    return extractArray(node, importedNames, componentName, sourceFile);
  if (ts.isObjectLiteralExpression(node))
    return extractObject(node, importedNames, componentName, sourceFile);
  if (ts.isIdentifier(node))
    return extractIdentifier(node, importedNames, componentName, sourceFile);
  return nonLiteral(node, componentName, sourceFile);
}
