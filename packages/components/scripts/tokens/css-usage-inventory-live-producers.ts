import ts from 'typescript';

function unwrap(expression: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  )
    expression = expression.expression;
  return expression;
}

function createChecker(sourceFile: ts.SourceFile): ts.TypeChecker {
  const options: ts.CompilerOptions = { noLib: true, noResolve: true, skipLibCheck: true };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (name) => (name === sourceFile.fileName ? sourceFile : undefined);
  host.fileExists = (name) => name === sourceFile.fileName;
  host.readFile = (name) => (name === sourceFile.fileName ? sourceFile.text : undefined);
  return ts.createProgram([sourceFile.fileName], options, host).getTypeChecker();
}

function isFunction(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  );
}

export type LiveLiteralResult = {
  literals: Set<ts.StringLiteralLike | ts.TemplateExpression>;
  recipeUnresolved: ts.Node[];
  responseUnresolved: ts.Node[];
};

function returnsOf(functionNode: ts.FunctionLikeDeclaration): ts.Expression[] {
  if (!functionNode.body) return [];
  if (ts.isExpression(functionNode.body)) return [functionNode.body];
  const expressions: ts.Expression[] = [];
  const visit = (node: ts.Node): void => {
    if (isFunction(node)) return;
    if (ts.isReturnStatement(node) && node.expression) expressions.push(node.expression);
    ts.forEachChild(node, visit);
  };
  visit(functionNode.body);
  return expressions;
}

export function extractLiveLiterals(sourceFile: ts.SourceFile): LiveLiteralResult {
  const result: LiveLiteralResult = {
    literals: new Set(),
    recipeUnresolved: [],
    responseUnresolved: [],
  };
  if (!/\b(?:Response|PREVIEW_RECIPES)\b/.test(sourceFile.text)) return result;
  const checker = createChecker(sourceFile);
  const declaration = (identifier: ts.Identifier): ts.Declaration | undefined => {
    const symbol = checker.getSymbolAtLocation(identifier);
    return symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  };
  const initializer = (
    expression: ts.Expression,
    seen = new Set<ts.Node>(),
  ): ts.Expression | undefined => {
    const value = unwrap(expression);
    if (seen.has(value)) return undefined;
    seen.add(value);
    if (!ts.isIdentifier(value)) return value;
    const owner = declaration(value);
    return owner && ts.isVariableDeclaration(owner) && owner.initializer
      ? initializer(owner.initializer, seen)
      : undefined;
  };
  const calledFunction = (expression: ts.Expression): ts.FunctionLikeDeclaration | undefined => {
    const value = unwrap(expression);
    if (isFunction(value)) return value;
    if (!ts.isIdentifier(value)) return undefined;
    const owner = declaration(value);
    if (owner && isFunction(owner)) return owner;
    const resolved = initializer(value);
    return resolved && isFunction(resolved) ? resolved : undefined;
  };
  const isResponse = (node: ts.Node): node is ts.NewExpression =>
    ts.isNewExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'Response' &&
    declaration(node.expression) === undefined;

  // Only this traversal marks strings as emitted. It starts at a body value,
  // never at a general call graph or an arbitrary function's return statement.
  const markValue = (
    expression: ts.Expression,
    unresolved: ts.Node[],
    active = new Set<ts.Node>(),
    awaited = false,
  ): void => {
    const value = unwrap(expression);
    if (active.has(value)) {
      unresolved.push(value);
      return;
    }
    active.add(value);
    try {
      if (ts.isStringLiteralLike(value) || ts.isTemplateExpression(value)) {
        result.literals.add(value);
        return;
      }
      if (
        ts.isNumericLiteral(value) ||
        ts.isBigIntLiteral(value) ||
        value.kind === ts.SyntaxKind.TrueKeyword ||
        value.kind === ts.SyntaxKind.FalseKeyword ||
        value.kind === ts.SyntaxKind.NullKeyword
      )
        return;
      if (ts.isAwaitExpression(value)) {
        markValue(value.expression, unresolved, active, true);
        return;
      }
      if (ts.isConditionalExpression(value)) {
        markValue(value.whenTrue, unresolved, active, awaited);
        markValue(value.whenFalse, unresolved, active, awaited);
        return;
      }
      if (ts.isIdentifier(value)) {
        const owner = declaration(value);
        if (owner && ts.isVariableDeclaration(owner) && owner.initializer) {
          markValue(owner.initializer, unresolved, active, awaited);
          return;
        }
      }
      if (ts.isCallExpression(value)) {
        const functionNode = calledFunction(value.expression);
        if (functionNode) {
          const asyncFunction = functionNode.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
          );
          const returns = returnsOf(functionNode);
          if (returns.length > 0 && (!asyncFunction || awaited)) {
            for (const returned of returns) markValue(returned, unresolved, active, awaited);
            return;
          }
        }
        if (
          ts.isPropertyAccessExpression(value.expression) &&
          value.expression.name.text === 'join' &&
          value.arguments.length <= 1
        ) {
          const receiver = initializer(value.expression.expression);
          const separator = value.arguments[0];
          const literalSeparator = separator && initializer(separator);
          if (separator && (!literalSeparator || !ts.isStringLiteralLike(literalSeparator))) {
            unresolved.push(value);
            return;
          }
          if (
            receiver &&
            ts.isArrayLiteralExpression(receiver) &&
            receiver.elements.every((element) => !ts.isSpreadElement(element))
          ) {
            for (const element of receiver.elements) markValue(element, unresolved, active);
            if (literalSeparator && receiver.elements.length > 1)
              markValue(literalSeparator, unresolved, active);
            return;
          }
          if (
            receiver &&
            ts.isCallExpression(receiver) &&
            ts.isPropertyAccessExpression(receiver.expression) &&
            receiver.expression.name.text === 'map'
          ) {
            const array = initializer(receiver.expression.expression);
            const callback = receiver.arguments[0] && calledFunction(receiver.arguments[0]);
            if (
              array &&
              ts.isArrayLiteralExpression(array) &&
              array.elements.every((element) => !ts.isSpreadElement(element)) &&
              callback
            ) {
              if (array.elements.length === 0) return;
              const returns = returnsOf(callback);
              if (returns.length > 0) {
                for (const returned of returns) markValue(returned, unresolved, active);
                if (literalSeparator && array.elements.length > 1)
                  markValue(literalSeparator, unresolved, active);
                return;
              }
            }
          }
        }
      }
      unresolved.push(value);
    } finally {
      active.delete(value);
    }
  };

  // Recipe fields are interpreted only on the declared top-level registry's
  // records, not on nested same-name objects or component props.
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const variable of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(variable.name) ||
        variable.name.text !== 'PREVIEW_RECIPES' ||
        !variable.initializer
      )
        continue;
      const registry = initializer(variable.initializer);
      if (!registry || !ts.isObjectLiteralExpression(registry)) {
        result.recipeUnresolved.push(variable.initializer);
        continue;
      }
      for (const entry of registry.properties) {
        if (!ts.isPropertyAssignment(entry)) {
          result.recipeUnresolved.push(entry);
          continue;
        }
        const recipe = initializer(entry.initializer);
        if (!recipe || !ts.isObjectLiteralExpression(recipe)) {
          result.recipeUnresolved.push(entry.initializer);
          continue;
        }
        for (const property of recipe.properties) {
          if (ts.isSpreadAssignment(property)) {
            result.recipeUnresolved.push(property);
            continue;
          }
          if (!ts.isPropertyAssignment(property)) continue;
          const name =
            ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
              ? property.name.text
              : undefined;
          if (name === 'childrenHtml' || name === 'referenceHtml')
            markValue(property.initializer, result.recipeUnresolved);
        }
      }
    }
  }

  const hasNonMarkupContentType = (response: ts.NewExpression): boolean => {
    const options = response.arguments?.[1];
    if (!options) return false;
    const optionsValue = unwrap(options);
    if (!ts.isObjectLiteralExpression(optionsValue)) return false;

    let headers: ts.Expression | undefined;
    for (const property of optionsValue.properties) {
      if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name))
        return false;
      if (property.name.text !== 'headers') continue;
      if (headers) return false;
      headers = property.initializer;
    }
    if (!headers) return false;
    const headersValue = unwrap(headers);
    if (!ts.isObjectLiteralExpression(headersValue)) return false;

    let contentType: string | undefined;
    for (const property of headersValue.properties) {
      if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name))
        return false;
      const name = property.name.text;
      if (!ts.isStringLiteralLike(property.initializer)) return false;
      if (name.toLowerCase() !== 'content-type') continue;
      if (contentType !== undefined) return false;
      contentType = property.initializer.text;
    }
    if (!contentType) return false;
    const essence = contentType.split(';', 1)[0]?.trim().toLowerCase();
    return (
      essence === 'application/json' ||
      essence === 'application/x-ndjson' ||
      essence === 'text/event-stream' ||
      essence === 'text/plain'
    );
  };

  const markResponseBody = (response: ts.NewExpression): void => {
    const body = response.arguments?.[0];
    if (body && !hasNonMarkupContentType(response)) markValue(body, result.responseUnresolved);
  };
  // Return-value traversal may discover a nested helper that returns Response.
  // Ordinary strings found here are not emission sinks and remain unmarked.
  const findReturnedResponses = (expression: ts.Expression, active = new Set<ts.Node>()): void => {
    const value = unwrap(expression);
    if (active.has(value)) return;
    active.add(value);
    try {
      if (isResponse(value)) {
        markResponseBody(value);
        return;
      }
      if (ts.isAwaitExpression(value)) {
        findReturnedResponses(value.expression, active);
        return;
      }
      if (ts.isConditionalExpression(value)) {
        findReturnedResponses(value.whenTrue, active);
        findReturnedResponses(value.whenFalse, active);
        return;
      }
      if (ts.isIdentifier(value)) {
        const resolved = initializer(value);
        if (resolved) findReturnedResponses(resolved, active);
      }
      if (ts.isCallExpression(value)) {
        const functionNode = calledFunction(value.expression);
        if (functionNode)
          for (const returned of returnsOf(functionNode)) findReturnedResponses(returned, active);
      }
    } finally {
      active.delete(value);
    }
  };
  const visitBody = (node: ts.Node): void => {
    if (isFunction(node)) return;
    if (isResponse(node)) {
      markResponseBody(node);
      return;
    }
    if (ts.isReturnStatement(node) && node.expression) findReturnedResponses(node.expression);
    ts.forEachChild(node, visitBody);
  };
  const visitModule = (node: ts.Node): void => {
    if (isFunction(node)) {
      if (node.body) {
        if (ts.isExpression(node.body)) findReturnedResponses(node.body);
        visitBody(node.body);
      }
      return;
    }
    if (isResponse(node)) {
      markResponseBody(node);
      return;
    }
    ts.forEachChild(node, visitModule);
  };
  visitModule(sourceFile);
  return result;
}
