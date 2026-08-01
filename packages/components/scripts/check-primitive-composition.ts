/** Reject new hand-rolled primitives while migration maps track existing copies. */

import { parse as parseCss } from 'postcss';
import { parse as parseSvelte } from 'svelte/compiler';

import { isExcludedComponentSource } from './component-source-filter.ts';
import {
  cssPrimitiveCounts,
  declarationMap,
  gridDefinitionProperties,
  type CssPrimitiveCounts,
  type SharedFloatingTarget,
} from './primitive-composition-css.ts';
import { fieldWrapperCount } from './primitive-composition-field.ts';
import {
  allowedFieldWrapperCounts,
  allowedFloatingCounts,
  allowedGridCounts,
  allowedRawControlCounts,
  allowedRawControlSignatures,
  missingMigrationRecordPaths,
} from './primitive-composition-migrations.ts';
import { runPrimitiveCompositionCheck } from './primitive-composition-runner.ts';
import { styleObjectDeclarationBranches } from './primitive-composition-style-object.ts';

export type PrimitiveCompositionViolation = {
  filePath: string;
  message: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isStaticallyTrueExpression(value: unknown): boolean {
  return isRecord(value) && value['type'] === 'Literal' && value['value'] === true;
}

function literalTruthiness(value: unknown): boolean | undefined {
  if (!isRecord(value) || value['type'] !== 'Literal') return undefined;
  return Boolean(value['value']);
}

function unconditionallyAbruptStatement(statement: unknown): boolean {
  if (!isRecord(statement)) return false;
  if (
    statement['type'] === 'BreakStatement' ||
    statement['type'] === 'ReturnStatement' ||
    statement['type'] === 'ThrowStatement'
  )
    return true;
  if (statement['type'] !== 'BlockStatement' || !Array.isArray(statement['body'])) return false;
  for (const child of statement['body']) if (unconditionallyAbruptStatement(child)) return true;
  return false;
}

function isDefinitelyUndefinedExpression(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value['type'] === 'Identifier') return value['name'] === 'undefined';
  return value['type'] === 'UnaryExpression' && value['operator'] === 'void';
}

function isDefinitelyNonUndefinedExpression(value: unknown): boolean {
  return isRecord(value) && value['type'] === 'Literal';
}

function walkAst(node: unknown, visit: (record: UnknownRecord) => void): void {
  if (!isRecord(node)) return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) walkAst(child, visit);
    } else if (isRecord(value)) {
      walkAst(value, visit);
    }
  }
}

function parseSvelteFragment(source: string): UnknownRecord | undefined {
  const root: unknown = parseSvelte(source, { modern: true });
  if (!isRecord(root) || !isRecord(root['fragment'])) return undefined;
  return root['fragment'];
}

function staticStringFromExpression(
  expression: unknown,
  bindings: ReadonlyMap<string, string>,
): string | undefined {
  if (!isRecord(expression)) return undefined;
  if (expression['type'] === 'Literal' && typeof expression['value'] === 'string')
    return expression['value'];
  if (
    expression['type'] === 'TemplateLiteral' &&
    Array.isArray(expression['expressions']) &&
    expression['expressions'].length === 0 &&
    Array.isArray(expression['quasis']) &&
    isRecord(expression['quasis'][0])
  ) {
    const value = expression['quasis'][0]['value'];
    return isRecord(value) && typeof value['cooked'] === 'string' ? value['cooked'] : undefined;
  }
  if (expression['type'] === 'Identifier' && typeof expression['name'] === 'string')
    return bindings.get(expression['name']);
  if (
    expression['type'] === 'TSAsExpression' ||
    expression['type'] === 'TSSatisfiesExpression' ||
    expression['type'] === 'TSNonNullExpression'
  )
    return staticStringFromExpression(expression['expression'], bindings);
  return undefined;
}

function possibleStaticStringsFromExpression(
  expression: unknown,
  bindings: ReadonlyMap<string, string>,
): Set<string> {
  const directValue = staticStringFromExpression(expression, bindings);
  if (directValue !== undefined) return new Set([directValue]);
  if (!isRecord(expression)) return new Set();
  if (expression['type'] === 'ConditionalExpression')
    return new Set([
      ...possibleStaticStringsFromExpression(expression['consequent'], bindings),
      ...possibleStaticStringsFromExpression(expression['alternate'], bindings),
    ]);
  if (expression['type'] === 'LogicalExpression')
    return new Set([
      ...possibleStaticStringsFromExpression(expression['left'], bindings),
      ...possibleStaticStringsFromExpression(expression['right'], bindings),
    ]);
  return new Set();
}

function staticStringBindings(source: string): Map<string, string> {
  const root: unknown = parseSvelte(source, { modern: true });
  const bindings = new Map<string, string>();
  if (!isRecord(root) || !isRecord(root['instance']) || !isRecord(root['instance']['content']))
    return bindings;
  const body = root['instance']['content']['body'];
  if (!Array.isArray(body)) return bindings;
  for (const statement of body) {
    if (
      !isRecord(statement) ||
      statement['type'] !== 'VariableDeclaration' ||
      statement['kind'] !== 'const'
    )
      continue;
    const declarations = statement['declarations'];
    if (!Array.isArray(declarations)) continue;
    for (const declaration of declarations) {
      if (
        !isRecord(declaration) ||
        !isRecord(declaration['id']) ||
        declaration['id']['type'] !== 'Identifier' ||
        typeof declaration['id']['name'] !== 'string'
      )
        continue;
      const value = staticStringFromExpression(declaration['init'], bindings);
      if (value !== undefined) bindings.set(declaration['id']['name'], value);
      else if (
        isRecord(declaration['init']) &&
        declaration['init']['type'] === 'Literal' &&
        typeof declaration['init']['value'] === 'boolean'
      )
        bindings.set(declaration['id']['name'], String(declaration['init']['value']));
    }
  }
  return bindings;
}

function bindingPatternIncludesName(pattern: unknown, bindingName: string): boolean {
  if (!isRecord(pattern)) return false;
  if (pattern['type'] === 'Identifier') return pattern['name'] === bindingName;
  if (pattern['type'] === 'RestElement') {
    return bindingPatternIncludesName(pattern['argument'], bindingName);
  }
  if (pattern['type'] === 'AssignmentPattern') {
    return bindingPatternIncludesName(pattern['left'], bindingName);
  }
  if (pattern['type'] === 'ArrayPattern' && Array.isArray(pattern['elements'])) {
    return pattern['elements'].some((element) => bindingPatternIncludesName(element, bindingName));
  }
  if (pattern['type'] === 'ObjectPattern' && Array.isArray(pattern['properties'])) {
    return pattern['properties'].some((property) => {
      if (!isRecord(property)) return false;
      if (property['type'] === 'RestElement') {
        return bindingPatternIncludesName(property['argument'], bindingName);
      }
      return bindingPatternIncludesName(property['value'], bindingName);
    });
  }
  return false;
}

// `var` is function-scoped: a `var tag` anywhere inside a function (including
// nested blocks) shadows the whole function body, regardless of which block
// it lexically sits in. Nested function/arrow bodies are separate scopes with
// their own shadowing handled independently by the caller's recursion; don't
// descend into them here or a same-named local in a nested function would
// falsely shadow the outer binding.
function declaresVarBindingWithinFunctionScope(node: unknown, bindingName: string): boolean {
  if (!isRecord(node)) return false;
  if (
    node['type'] === 'FunctionDeclaration' ||
    node['type'] === 'FunctionExpression' ||
    node['type'] === 'ArrowFunctionExpression'
  )
    return false;
  if (
    node['type'] === 'VariableDeclaration' &&
    node['kind'] === 'var' &&
    Array.isArray(node['declarations']) &&
    node['declarations'].some(
      (declarator) =>
        isRecord(declarator) && bindingPatternIncludesName(declarator['id'], bindingName),
    )
  )
    return true;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      if (value.some((item) => declaresVarBindingWithinFunctionScope(item, bindingName)))
        return true;
    } else if (isRecord(value) && declaresVarBindingWithinFunctionScope(value, bindingName)) {
      return true;
    }
  }
  return false;
}

// `let`/`const` are block-scoped: only a direct child of THIS block that
// declares the binding shadows references within this block. A block nested
// deeper inside (an `if`/`for`/bare `{}`) has its own, independently
// evaluated scope and must not leak its shadowing back out to sibling
// statements once that block ends.
function declaresLexicalBindingDirectlyInBlock(block: UnknownRecord, bindingName: string): boolean {
  const body = block['body'];
  if (!Array.isArray(body)) return false;
  return body.some(
    (statement) =>
      isRecord(statement) &&
      statement['type'] === 'VariableDeclaration' &&
      (statement['kind'] === 'let' || statement['kind'] === 'const') &&
      Array.isArray(statement['declarations']) &&
      statement['declarations'].some(
        (declarator) =>
          isRecord(declarator) && bindingPatternIncludesName(declarator['id'], bindingName),
      ),
  );
}

function possibleMutableControlNames(
  source: string,
  expression: unknown,
  onReachableValues?: (values: ReadonlySet<string>) => void,
): Set<string> {
  if (
    !isRecord(expression) ||
    expression['type'] !== 'Identifier' ||
    typeof expression['name'] !== 'string'
  )
    return new Set();
  const bindingName = expression['name'];
  const root: unknown = parseSvelte(source, { modern: true });
  if (!isRecord(root)) return new Set();
  const instanceContent =
    isRecord(root['instance']) && isRecord(root['instance']['content'])
      ? root['instance']['content']
      : undefined;
  if (instanceContent === undefined && !isRecord(root['fragment'])) return new Set();
  const possibleControls = new Set<string>();
  const bindings = staticStringBindings(source);
  const isDefinitelyUnshadowedUndefined = (value: unknown, shadowed = false): boolean =>
    isDefinitelyUndefinedExpression(value) &&
    !(
      isRecord(value) &&
      value['type'] === 'Identifier' &&
      value['name'] === 'undefined' &&
      shadowed
    );
  const mutableValues = new Set<string>();
  const recordControls = (values: Iterable<string>): void => {
    onReachableValues?.(new Set(values));
    for (const candidateValue of values) {
      const normalizedValue = candidateValue.toLowerCase();
      if (
        normalizedValue === 'input' ||
        normalizedValue === 'select' ||
        normalizedValue === 'textarea'
      )
        possibleControls.add(normalizedValue);
    }
  };
  const snapshotMutableValues = (): Set<string> => new Set(mutableValues);
  const restoreMutableValues = (values: Iterable<string>): void => {
    mutableValues.clear();
    for (const value of values) mutableValues.add(value);
  };
  const breakTargets: Array<{ label: string | undefined; states: Set<string>[] }> = [];
  const continueTargets: Array<{ label: string | undefined; states: Set<string>[] }> = [];
  const returnTargets: Set<string>[][] = [];
  const explicitWrites: boolean[] = [];
  const localAliasFrames: Map<string, string>[] = [];
  const undefinedShadowFrames: boolean[] = [];
  const undefinedIsShadowed = (): boolean => undefinedShadowFrames.some(Boolean);
  let suppressPublication = false;
  const visibleBindings = (): Map<string, string> => {
    const visible = new Map(bindings);
    for (const frame of localAliasFrames)
      for (const [name, value] of frame) visible.set(name, value);
    return visible;
  };
  const shadowsBindingInsideParameters = (node: UnknownRecord, shadowed: boolean): boolean =>
    shadowed ||
    (Array.isArray(node['params']) &&
      node['params'].some((parameter) => bindingPatternIncludesName(parameter, bindingName)));
  const shadowsBindingInsideFunction = (node: UnknownRecord, shadowed: boolean): boolean =>
    shadowsBindingInsideParameters(node, shadowed) ||
    declaresVarBindingWithinFunctionScope(node['body'], bindingName);
  const shadowsUndefinedInsideFunction = (node: UnknownRecord): boolean =>
    (Array.isArray(node['params']) &&
      node['params'].some((parameter) => bindingPatternIncludesName(parameter, 'undefined'))) ||
    declaresVarBindingWithinFunctionScope(node['body'], 'undefined');
  const walkTopLevel = (current: unknown, shadowed = false, controlLabel?: string): void => {
    if (!isRecord(current)) return;
    const type = current['type'];
    let currentShadowed = shadowed;
    if (type === 'BreakStatement') {
      const label =
        isRecord(current['label']) && typeof current['label']['name'] === 'string'
          ? current['label']['name']
          : undefined;
      const target = label
        ? breakTargets.findLast((candidate) => candidate.label === label)
        : breakTargets.at(-1);
      target?.states.push(snapshotMutableValues());
      return;
    }
    if (type === 'ContinueStatement') {
      const label =
        isRecord(current['label']) && typeof current['label']['name'] === 'string'
          ? current['label']['name']
          : undefined;
      const target = label
        ? continueTargets.findLast((candidate) => candidate.label === label)
        : continueTargets.at(-1);
      target?.states.push(snapshotMutableValues());
      return;
    }
    if (type === 'LabeledStatement') {
      const label =
        isRecord(current['label']) && typeof current['label']['name'] === 'string'
          ? current['label']['name']
          : undefined;
      if (isRecord(current['body'])) walkTopLevel(current['body'], currentShadowed, label);
      return;
    }
    if (type === 'BlockStatement') {
      currentShadowed ||= declaresLexicalBindingDirectlyInBlock(current, bindingName);
      undefinedShadowFrames.push(declaresLexicalBindingDirectlyInBlock(current, 'undefined'));
    }
    if (type === 'IfStatement') {
      if (isRecord(current['test'])) walkTopLevel(current['test'], currentShadowed);
      const base = snapshotMutableValues();
      const truthiness = literalTruthiness(current['test']);
      if (truthiness !== undefined) {
        restoreMutableValues(base);
        const branch = truthiness ? current['consequent'] : current['alternate'];
        if (isRecord(branch)) walkTopLevel(branch, currentShadowed);
        return;
      }
      const branches = [current['consequent'], current['alternate']].map((branch) => {
        restoreMutableValues(base);
        if (isRecord(branch)) walkTopLevel(branch, currentShadowed);
        return snapshotMutableValues();
      });
      restoreMutableValues(branches.flatMap((branch) => [...branch]));
      return;
    }
    if (type === 'ConditionalExpression') {
      if (isRecord(current['test'])) walkTopLevel(current['test'], currentShadowed);
      const base = snapshotMutableValues();
      const truthiness = literalTruthiness(current['test']);
      if (truthiness !== undefined) {
        restoreMutableValues(base);
        const branch = truthiness ? current['consequent'] : current['alternate'];
        if (isRecord(branch)) walkTopLevel(branch, currentShadowed);
        return;
      }
      const branches = [current['consequent'], current['alternate']].map((branch) => {
        restoreMutableValues(base);
        if (isRecord(branch)) walkTopLevel(branch, currentShadowed);
        return snapshotMutableValues();
      });
      restoreMutableValues(branches.flatMap((branch) => [...branch]));
      return;
    }
    if (type === 'LogicalExpression') {
      const left = current['left'];
      if (isRecord(left)) walkTopLevel(left, currentShadowed);
      const base = snapshotMutableValues();
      const operator = current['operator'];
      const leftTruthiness = literalTruthiness(left);
      const leftIsNullish =
        (isRecord(left) && left['type'] === 'Literal' && left['value'] === null) ||
        (isRecord(left) &&
          left['type'] === 'Identifier' &&
          left['name'] === 'undefined' &&
          !undefinedIsShadowed()) ||
        isDefinitelyUnshadowedUndefined(left, undefinedIsShadowed());
      const leftIsNonNullishLiteral =
        isRecord(left) && left['type'] === 'Literal' && left['value'] !== null;
      const skipsRight =
        (leftTruthiness !== undefined &&
          ((operator === '&&' && !leftTruthiness) || (operator === '||' && leftTruthiness))) ||
        (operator === '??' && leftIsNonNullishLiteral);
      if (skipsRight) return;
      if (isRecord(current['right'])) walkTopLevel(current['right'], currentShadowed);
      const guaranteesRight =
        (leftTruthiness !== undefined &&
          ((operator === '&&' && leftTruthiness) || (operator === '||' && !leftTruthiness))) ||
        (operator === '??' && leftIsNullish);
      if (!guaranteesRight) restoreMutableValues([...base, ...mutableValues]);
      return;
    }
    if (type === 'SwitchStatement' && Array.isArray(current['cases'])) {
      if (isRecord(current['discriminant'])) walkTopLevel(current['discriminant'], currentShadowed);
      undefinedShadowFrames.push(
        current['cases'].some(
          (switchCase) =>
            Array.isArray(switchCase['consequent']) &&
            switchCase['consequent'].some(
              (statement) =>
                isRecord(statement) &&
                statement['type'] === 'VariableDeclaration' &&
                (statement['kind'] === 'let' || statement['kind'] === 'const') &&
                Array.isArray(statement['declarations']) &&
                statement['declarations'].some(
                  (declaration) =>
                    isRecord(declaration) &&
                    bindingPatternIncludesName(declaration['id'], 'undefined'),
                ),
            ),
        ),
      );
      const base = snapshotMutableValues();
      const cases = current['cases'].filter(isRecord);
      const discriminant = current['discriminant'];
      const knownDiscriminant =
        isRecord(discriminant) && discriminant['type'] === 'Literal'
          ? discriminant['value']
          : undefined;
      const hasKnownDiscriminant = isRecord(discriminant) && discriminant['type'] === 'Literal';
      let knownStartIndex: number | undefined;
      if (hasKnownDiscriminant) {
        let defaultIndex: number | undefined;
        let hasUnresolvedCaseTest = false;
        for (let index = 0; index < cases.length; index += 1) {
          const test = cases[index]?.['test'];
          if (test === null) {
            defaultIndex = index;
            continue;
          }
          if (isRecord(test) && test['type'] === 'Literal' && test['value'] === knownDiscriminant) {
            if (!hasUnresolvedCaseTest) knownStartIndex = index;
            break;
          }
          if (!isRecord(test) || test['type'] !== 'Literal') hasUnresolvedCaseTest = true;
        }
        if (knownStartIndex === undefined && !hasUnresolvedCaseTest)
          knownStartIndex = defaultIndex ?? -1;
      }
      const switchShadowed =
        currentShadowed ||
        cases.some(
          (switchCase) =>
            Array.isArray(switchCase['consequent']) &&
            switchCase['consequent'].some(
              (statement) =>
                isRecord(statement) &&
                statement['type'] === 'VariableDeclaration' &&
                (statement['kind'] === 'let' || statement['kind'] === 'const') &&
                Array.isArray(statement['declarations']) &&
                statement['declarations'].some(
                  (declaration) =>
                    isRecord(declaration) &&
                    bindingPatternIncludesName(declaration['id'], bindingName),
                ),
            ),
        );
      const branches: Set<string>[] = [];
      const defaultIndex = cases.findIndex((switchCase) => switchCase['test'] === null);
      const startIndices =
        knownStartIndex === undefined
          ? [...cases.map((_, index) => index), ...(defaultIndex < 0 ? [-1] : [])]
          : knownStartIndex < 0
            ? [-1]
            : [knownStartIndex];
      for (const startIndex of startIndices) {
        restoreMutableValues(base);
        const lastTestIndex =
          startIndex < 0 || startIndex === defaultIndex ? cases.length - 1 : startIndex;
        for (let caseIndex = 0; caseIndex <= lastTestIndex; caseIndex += 1) {
          const test = cases[caseIndex]?.['test'];
          if (isRecord(test)) walkTopLevel(test, switchShadowed);
        }
        if (startIndex < 0) {
          branches.push(snapshotMutableValues());
          continue;
        }
        let stopped = false;
        const interruptedStates: Set<string>[] = [];
        breakTargets.push({ label: controlLabel, states: interruptedStates });
        for (let caseIndex = startIndex; caseIndex < cases.length && !stopped; caseIndex++) {
          const consequent = cases[caseIndex]?.['consequent'];
          if (!Array.isArray(consequent)) continue;
          for (const statement of consequent) {
            walkTopLevel(statement, switchShadowed);
            if (unconditionallyAbruptStatement(statement)) {
              stopped = true;
              break;
            }
          }
        }
        breakTargets.pop();
        branches.push(
          new Set([...mutableValues, ...interruptedStates.flatMap((state) => [...state])]),
        );
      }
      restoreMutableValues(branches.flatMap((branch) => [...branch]));
      undefinedShadowFrames.pop();
      return;
    }
    if (type === 'TryStatement') {
      const base = snapshotMutableValues();
      const alternatives: Set<string>[] = [];
      const tryBlock = current['block'];
      restoreMutableValues(base);
      if (isRecord(tryBlock)) walkTopLevel(tryBlock, currentShadowed);
      alternatives.push(snapshotMutableValues());
      const handler = current['handler'];
      if (isRecord(handler)) {
        restoreMutableValues(base);
        const catchShadowed =
          currentShadowed || bindingPatternIncludesName(handler['param'], bindingName);
        undefinedShadowFrames.push(bindingPatternIncludesName(handler['param'], 'undefined'));
        walkTopLevel(handler, catchShadowed);
        undefinedShadowFrames.pop();
        alternatives.push(snapshotMutableValues());
      }
      restoreMutableValues(alternatives.flatMap((state) => [...state]));
      const finalizer = current['finalizer'];
      if (isRecord(finalizer)) walkTopLevel(finalizer, currentShadowed);
      return;
    }
    if (type === 'ForStatement') {
      const initializer = current['init'];
      const loopShadowed =
        currentShadowed ||
        (isRecord(initializer) &&
          initializer['type'] === 'VariableDeclaration' &&
          (initializer['kind'] === 'let' || initializer['kind'] === 'const') &&
          Array.isArray(initializer['declarations']) &&
          initializer['declarations'].some(
            (declaration) =>
              isRecord(declaration) && bindingPatternIncludesName(declaration['id'], bindingName),
          ));
      const loopUndefinedShadowed =
        isRecord(initializer) &&
        initializer['type'] === 'VariableDeclaration' &&
        (initializer['kind'] === 'let' || initializer['kind'] === 'const') &&
        Array.isArray(initializer['declarations']) &&
        initializer['declarations'].some(
          (declaration) =>
            isRecord(declaration) && bindingPatternIncludesName(declaration['id'], 'undefined'),
        );
      undefinedShadowFrames.push(loopUndefinedShadowed);
      if (isRecord(initializer)) walkTopLevel(initializer, loopShadowed);
      if (isRecord(current['test'])) walkTopLevel(current['test'], loopShadowed);
      const base = snapshotMutableValues();
      if (literalTruthiness(current['test']) === false) {
        restoreMutableValues(base);
        undefinedShadowFrames.pop();
        return;
      }
      const interruptedStates: Set<string>[] = [];
      const continuedStates: Set<string>[] = [];
      breakTargets.push({ label: controlLabel, states: interruptedStates });
      continueTargets.push({ label: controlLabel, states: continuedStates });
      if (isRecord(current['body'])) walkTopLevel(current['body'], loopShadowed);
      continueTargets.pop();
      breakTargets.pop();
      const fallthroughState = snapshotMutableValues();
      if (isRecord(current['update'])) {
        const updateStates: Set<string>[] = [];
        const paths = unconditionallyAbruptStatement(current['body'])
          ? continuedStates
          : [...continuedStates, fallthroughState];
        for (const path of paths) {
          restoreMutableValues(path);
          walkTopLevel(current['update'], loopShadowed);
          updateStates.push(snapshotMutableValues());
        }
        restoreMutableValues([
          ...interruptedStates.flatMap((state) => [...state]),
          ...updateStates.flatMap((state) => [...state]),
        ]);
      } else {
        restoreMutableValues([
          ...interruptedStates.flatMap((state) => [...state]),
          ...continuedStates.flatMap((state) => [...state]),
          ...mutableValues,
        ]);
      }
      if (current['test'] !== null && !isStaticallyTrueExpression(current['test']))
        restoreMutableValues([...base, ...mutableValues]);
      undefinedShadowFrames.pop();
      return;
    }
    if (type === 'ForInStatement' || type === 'ForOfStatement') {
      if (isRecord(current['right'])) walkTopLevel(current['right'], currentShadowed);
      const base = snapshotMutableValues();
      if (
        isRecord(current['right']) &&
        current['right']['type'] === 'ArrayExpression' &&
        Array.isArray(current['right']['elements']) &&
        current['right']['elements'].length === 0
      ) {
        restoreMutableValues(base);
        return;
      }
      const left = current['left'];
      const loopUndefinedShadowed =
        isRecord(left) &&
        left['type'] === 'VariableDeclaration' &&
        (left['kind'] === 'let' || left['kind'] === 'const') &&
        Array.isArray(left['declarations']) &&
        left['declarations'].some(
          (declaration) =>
            isRecord(declaration) && bindingPatternIncludesName(declaration['id'], 'undefined'),
        );
      const loopShadowed =
        currentShadowed ||
        (isRecord(left) &&
          left['type'] === 'VariableDeclaration' &&
          (left['kind'] === 'let' || left['kind'] === 'const') &&
          Array.isArray(left['declarations']) &&
          left['declarations'].some(
            (declaration) =>
              isRecord(declaration) && bindingPatternIncludesName(declaration['id'], bindingName),
          ));
      undefinedShadowFrames.push(loopUndefinedShadowed);
      if (isRecord(left)) walkTopLevel(left, loopShadowed);
      const interruptedStates: Set<string>[] = [];
      breakTargets.push({ label: controlLabel, states: interruptedStates });
      const continuedStates: Set<string>[] = [];
      continueTargets.push({ label: controlLabel, states: continuedStates });
      if (isRecord(current['body'])) walkTopLevel(current['body'], loopShadowed);
      continueTargets.pop();
      breakTargets.pop();
      restoreMutableValues([
        ...base,
        ...interruptedStates.flatMap((state) => [...state]),
        ...continuedStates.flatMap((state) => [...state]),
        ...mutableValues,
      ]);
      undefinedShadowFrames.pop();
      return;
    }
    if (type === 'WhileStatement') {
      if (isRecord(current['test'])) walkTopLevel(current['test'], currentShadowed);
      const base = snapshotMutableValues();
      if (literalTruthiness(current['test']) === false) {
        restoreMutableValues(base);
        return;
      }
      const interruptedStates: Set<string>[] = [];
      breakTargets.push({ label: controlLabel, states: interruptedStates });
      const continuedStates: Set<string>[] = [];
      continueTargets.push({ label: controlLabel, states: continuedStates });
      if (isRecord(current['body'])) walkTopLevel(current['body'], currentShadowed);
      continueTargets.pop();
      breakTargets.pop();
      restoreMutableValues([
        ...interruptedStates.flatMap((state) => [...state]),
        ...continuedStates.flatMap((state) => [...state]),
        ...mutableValues,
      ]);
      if (!isStaticallyTrueExpression(current['test']))
        restoreMutableValues([...base, ...mutableValues]);
      return;
    }
    if (type === 'DoWhileStatement') {
      const interruptedStates: Set<string>[] = [];
      breakTargets.push({ label: controlLabel, states: interruptedStates });
      const continuedStates: Set<string>[] = [];
      continueTargets.push({ label: controlLabel, states: continuedStates });
      if (isRecord(current['body'])) walkTopLevel(current['body'], currentShadowed);
      continueTargets.pop();
      breakTargets.pop();
      if (isRecord(current['test'])) walkTopLevel(current['test'], currentShadowed);
      restoreMutableValues([
        ...interruptedStates.flatMap((state) => [...state]),
        ...continuedStates.flatMap((state) => [...state]),
        ...mutableValues,
      ]);
      return;
    }
    if (
      type === 'CallExpression' &&
      isRecord(current['callee']) &&
      (current['callee']['type'] === 'FunctionExpression' ||
        current['callee']['type'] === 'ArrowFunctionExpression')
    ) {
      if (Array.isArray(current['arguments']))
        for (const argument of current['arguments']) walkTopLevel(argument, currentShadowed);
      const callee = current['callee'];
      const parameterShadowed = shadowsBindingInsideParameters(callee, currentShadowed);
      const bodyShadowed = shadowsBindingInsideFunction(callee, currentShadowed);
      if (Array.isArray(callee['params'])) {
        const argumentsList = Array.isArray(current['arguments']) ? current['arguments'] : [];
        for (let index = 0; index < callee['params'].length; index += 1) {
          const parameter = callee['params'][index];
          if (!isRecord(parameter)) continue;
          const argument = argumentsList[index];
          if (parameter['type'] === 'AssignmentPattern') {
            if (
              argument !== undefined &&
              isDefinitelyNonUndefinedExpression(argument) &&
              !isDefinitelyUndefinedExpression(argument)
            )
              continue;
            if (
              argument === undefined ||
              isDefinitelyUnshadowedUndefined(argument, undefinedIsShadowed())
            )
              walkTopLevel(parameter['right'], parameterShadowed);
            else {
              const base = snapshotMutableValues();
              walkTopLevel(parameter['right'], parameterShadowed);
              restoreMutableValues([...base, ...mutableValues]);
            }
          } else walkTopLevel(parameter, parameterShadowed);
        }
      }
      if (isRecord(callee['body'])) {
        const previousSuppression = suppressPublication;
        suppressPublication = true;
        undefinedShadowFrames.push(shadowsUndefinedInsideFunction(callee));
        walkTopLevel(callee['body'], bodyShadowed);
        undefinedShadowFrames.pop();
        suppressPublication = previousSuppression;
      }
      return;
    }
    if (type === 'ReturnStatement' || type === 'ThrowStatement') {
      if (isRecord(current['argument'])) walkTopLevel(current['argument'], currentShadowed);
      returnTargets.at(-1)?.push(snapshotMutableValues());
      if (!suppressPublication) recordControls(mutableValues);
      return;
    }
    if (type === 'BlockStatement' && Array.isArray(current['body'])) {
      localAliasFrames.push(new Map());
      for (const statement of current['body']) {
        walkTopLevel(statement, currentShadowed);
        if (
          isRecord(statement) &&
          (statement['type'] === 'ReturnStatement' ||
            statement['type'] === 'ThrowStatement' ||
            statement['type'] === 'BreakStatement' ||
            statement['type'] === 'ContinueStatement')
        )
          break;
      }
      localAliasFrames.pop();
      undefinedShadowFrames.pop();
      return;
    }
    if (
      type === 'FunctionDeclaration' ||
      type === 'FunctionExpression' ||
      type === 'ArrowFunctionExpression'
    ) {
      const base = snapshotMutableValues();
      const previousBindings = new Map(bindings);
      localAliasFrames.push(new Map());
      returnTargets.push([]);
      explicitWrites.push(false);
      const parameterShadowed = shadowsBindingInsideParameters(current, currentShadowed);
      const bodyShadowed = shadowsBindingInsideFunction(current, currentShadowed);
      undefinedShadowFrames.push(
        Array.isArray(current['params']) &&
          current['params'].some((parameter) => bindingPatternIncludesName(parameter, 'undefined')),
      );
      if (Array.isArray(current['params']))
        for (const parameter of current['params']) {
          if (isRecord(parameter) && parameter['type'] === 'AssignmentPattern')
            walkTopLevel(parameter['right'], parameterShadowed);
          else walkTopLevel(parameter, parameterShadowed);
        }
      undefinedShadowFrames.pop();
      undefinedShadowFrames.push(shadowsUndefinedInsideFunction(current));
      if (isRecord(current['body'])) walkTopLevel(current['body'], bodyShadowed);
      const terminalValues = snapshotMutableValues();
      const returnedValues = returnTargets.at(-1) ?? [];
      returnTargets.pop();
      const hadExplicitWrite = explicitWrites.pop() ?? false;
      restoreMutableValues([...terminalValues, ...returnedValues.flatMap((state) => [...state])]);
      const reachableValues = snapshotMutableValues();
      const changed =
        reachableValues.size !== base.size ||
        [...reachableValues].some((value) => !base.has(value));
      if (!suppressPublication && (changed || hadExplicitWrite)) recordControls(reachableValues);
      restoreMutableValues([...base, ...reachableValues]);
      localAliasFrames.pop();
      undefinedShadowFrames.pop();
      bindings.clear();
      for (const [name, value] of previousBindings) bindings.set(name, value);
      return;
    }
    const node = current;
    if (
      !currentShadowed &&
      node['type'] === 'VariableDeclarator' &&
      isRecord(node['id']) &&
      node['id']['type'] === 'Identifier' &&
      node['id']['name'] === bindingName
    ) {
      if (node['init'] !== null && node['init'] !== undefined) {
        mutableValues.clear();
        for (const value of possibleStaticStringsFromExpression(node['init'], bindings))
          mutableValues.add(value);
      }
    }
    if (
      !currentShadowed &&
      node['type'] === 'VariableDeclarator' &&
      isRecord(node['id']) &&
      node['id']['type'] === 'Identifier' &&
      typeof node['id']['name'] === 'string' &&
      localAliasFrames.length > 0
    ) {
      const resolved = staticStringFromExpression(node['init'], visibleBindings());
      if (resolved !== undefined) localAliasFrames.at(-1)?.set(node['id']['name'], resolved);
    }
    if (
      !currentShadowed &&
      node['type'] === 'AssignmentExpression' &&
      node['operator'] === '+=' &&
      isRecord(node['left']) &&
      node['left']['type'] === 'Identifier' &&
      node['left']['name'] === bindingName
    ) {
      const rightValues = possibleStaticStringsFromExpression(node['right'], visibleBindings());
      const combined = new Set<string>();
      for (const previous of mutableValues)
        for (const right of rightValues) combined.add(previous + right);
      restoreMutableValues(combined);
      if (explicitWrites.length > 0) explicitWrites[explicitWrites.length - 1] = true;
    }
    if (
      !currentShadowed &&
      node['type'] === 'AssignmentExpression' &&
      node['operator'] === '=' &&
      isRecord(node['left']) &&
      node['left']['type'] === 'Identifier' &&
      node['left']['name'] === bindingName
    ) {
      const values = possibleStaticStringsFromExpression(node['right'], visibleBindings());
      restoreMutableValues(values);
      if (explicitWrites.length > 0) explicitWrites[explicitWrites.length - 1] = true;
    }
    if (
      !currentShadowed &&
      node['type'] === 'AssignmentExpression' &&
      (node['operator'] === '||=' || node['operator'] === '&&=' || node['operator'] === '??=') &&
      isRecord(node['left']) &&
      node['left']['type'] === 'Identifier' &&
      node['left']['name'] === bindingName
    ) {
      const rightValues = possibleStaticStringsFromExpression(node['right'], visibleBindings());
      const previousValues = [...mutableValues];
      const result = new Set<string>();
      for (const previous of previousValues) {
        const truthy = Boolean(previous);
        if (node['operator'] === '??=') result.add(previous);
        else if (node['operator'] === '||=' ? !truthy : truthy) {
          for (const right of rightValues) result.add(right);
        } else result.add(previous);
      }
      if (previousValues.length === 0) for (const right of rightValues) result.add(right);
      restoreMutableValues(result);
      if (explicitWrites.length > 0) explicitWrites[explicitWrites.length - 1] = true;
    }
    for (const child of Object.values(current)) {
      if (Array.isArray(child)) child.forEach((item) => walkTopLevel(item, currentShadowed));
      else if (isRecord(child)) walkTopLevel(child, currentShadowed);
    }
  };
  if (instanceContent !== undefined) walkTopLevel(instanceContent);
  // Assignments can also live inline in the template — an event handler like
  // `onclick={() => (tag = 'input')}` never appears in the instance script,
  // so scan every template expression (handlers, bindings, interpolations)
  // as its own top-level closure over the instance scope.
  if (isRecord(root['fragment']))
    walkAst(root['fragment'], (node) => {
      if (node['type'] === 'ExpressionTag' && isRecord(node['expression']))
        walkTopLevel(node['expression']);
    });
  recordControls(mutableValues);
  return possibleControls;
}

function staticAttributeValue(attribute: UnknownRecord): string | undefined {
  const value = attribute['value'];
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) return undefined;
  return value[0]['type'] === 'Text' && typeof value[0]['data'] === 'string'
    ? value[0]['data']
    : undefined;
}

function attributeValueWithDynamics(
  attribute: UnknownRecord,
  bindings: ReadonlyMap<string, string> = new Map(),
): string | undefined {
  const value = attribute['value'];
  if (value === true) return undefined;
  const parts = Array.isArray(value) ? value : [value];
  return parts
    .map((part) => {
      if (isRecord(part) && part['type'] === 'Text' && typeof part['data'] === 'string')
        return part['data'];
      if (isRecord(part) && part['type'] === 'ExpressionTag')
        return (
          staticStringFromExpression(part['expression'], bindings) ?? 'var(--cinder-dynamic-value)'
        );
      return 'var(--cinder-dynamic-value)';
    })
    .join('');
}

function staticPropertyName(property: UnknownRecord): string | undefined {
  if (property['type'] !== 'Property' || property['computed'] === true) return undefined;
  const key = property['key'];
  if (!isRecord(key)) return undefined;
  if (key['type'] === 'Identifier' && typeof key['name'] === 'string') return key['name'];
  if (key['type'] === 'Literal' && typeof key['value'] === 'string') return key['value'];
  return undefined;
}

// Resolves the *last* statically-known value for `hidden` and (on a solo
// `<input>`) `type`, walking attributes — including object-spread properties
// — in source order. A later attribute or spread must be able to override an
// earlier one, matching how Svelte applies attributes; a naive `.some()` over
// unordered evidence would let a trailing `{...{ type: 'text' }}` remain
// masked by an earlier `type="hidden"`.
function hasStaticHiddenAttribute(
  element: UnknownRecord,
  elementNames: ReadonlySet<string>,
  bindings: ReadonlyMap<string, string>,
): boolean {
  const attributes = element['attributes'];
  if (!Array.isArray(attributes)) return false;
  const soloInput = elementNames.size === 1 && elementNames.has('input');
  let hiddenState: boolean | undefined;
  let typeIsHidden: boolean | undefined;
  const applyObjectProperties = (properties: unknown[]): void => {
    for (const property of properties) {
      if (!isRecord(property)) continue;
      if (property['type'] === 'SpreadElement') {
        const nested = property['argument'];
        if (
          isRecord(nested) &&
          nested['type'] === 'ObjectExpression' &&
          Array.isArray(nested['properties'])
        )
          applyObjectProperties(nested['properties']);
        else {
          hiddenState = undefined;
          typeIsHidden = undefined;
        }
        continue;
      }
      const name = staticPropertyName(property);
      if (name === 'hidden')
        hiddenState =
          isRecord(property['value']) &&
          property['value']['type'] === 'Literal' &&
          property['value']['value'] === true;
      else if (soloInput && name === 'type')
        typeIsHidden =
          staticStringFromExpression(property['value'], bindings)?.toLowerCase() === 'hidden';
    }
  };

  for (const attribute of attributes) {
    if (!isRecord(attribute)) continue;
    if (attribute['type'] === 'SpreadAttribute' && isRecord(attribute['expression'])) {
      const expression = attribute['expression'];
      if (expression['type'] !== 'ObjectExpression' || !Array.isArray(expression['properties'])) {
        // An unresolvable spread (spreading an identifier we can't see the
        // shape of) might overwrite `hidden`/`type` with something visible —
        // we can't prove it doesn't, so invalidate any prior hidden proof. A
        // later static attribute can still re-establish it.
        hiddenState = undefined;
        typeIsHidden = undefined;
        continue;
      }
      applyObjectProperties(expression['properties']);
      continue;
    }
    if (attribute['type'] !== 'Attribute') continue;
    if (attribute['name'] === 'hidden') {
      if (attribute['value'] === true || staticAttributeValue(attribute) !== undefined) {
        hiddenState = true;
        continue;
      }
      const value = attribute['value'];
      const expressionTag = isRecord(value)
        ? value
        : Array.isArray(value) && value.length === 1 && isRecord(value[0])
          ? value[0]
          : undefined;
      const expression = expressionTag?.['expression'];
      if (expressionTag?.['type'] !== 'ExpressionTag' || !isRecord(expression)) continue;
      if (expression['type'] === 'Literal' && typeof expression['value'] === 'boolean') {
        hiddenState = expression['value'];
        continue;
      }
      if (expression['type'] === 'Identifier' && typeof expression['name'] === 'string') {
        const bound = bindings.get(expression['name']);
        if (bound === 'true' || bound === 'false') hiddenState = bound === 'true';
      }
      continue;
    }
    if (soloInput && attribute['name'] === 'type') {
      const resolved = attributeValueWithDynamics(attribute, bindings)?.toLowerCase();
      if (resolved !== undefined) typeIsHidden = resolved === 'hidden';
    }
  }
  return hiddenState === true || typeIsHidden === true;
}

export function visibleControlCount(source: string): number {
  return visibleControlSignatures(source).length;
}

export function visibleControlSignatures(source: string): string[] {
  const fragment = parseSvelteFragment(source);
  const bindings = staticStringBindings(source);
  if (fragment === undefined) return [];
  const signatures: string[] = [];
  walkAst(fragment, (node) => {
    if (node['type'] === 'HtmlTag' && isRecord(node['expression'])) {
      const candidates = new Set<string>();
      const html = staticStringFromExpression(node['expression'], bindings);
      if (html !== undefined) candidates.add(html);
      possibleMutableControlNames(source, node['expression'], (values) => {
        for (const value of values) candidates.add(value);
      });
      for (const candidate of candidates) signatures.push(...visibleControlSignatures(candidate));
      return;
    }
    const elementNames = new Set<string>();
    if (node['type'] === 'RegularElement' && typeof node['name'] === 'string')
      elementNames.add(node['name'].toLowerCase());
    if (node['type'] === 'SvelteElement') {
      for (const name of possibleStaticStringsFromExpression(node['tag'], bindings))
        elementNames.add(name.toLowerCase());
      for (const mutableControlName of possibleMutableControlNames(source, node['tag']))
        elementNames.add(mutableControlName);
    }
    const controlNames = new Set(
      [...elementNames].filter(
        (elementName) =>
          elementName === 'input' || elementName === 'select' || elementName === 'textarea',
      ),
    );
    if (controlNames.size > 0 && !hasStaticHiddenAttribute(node, controlNames, bindings)) {
      const attributes = Array.isArray(node['attributes'])
        ? node['attributes']
            .filter(isRecord)
            .map((attribute) => {
              const name = typeof attribute['name'] === 'string' ? attribute['name'] : '';
              const value = staticAttributeValue(attribute);
              return value === undefined ? name : `${name}=${value}`;
            })
            .filter(Boolean)
            .sort()
            .join('|')
        : '';
      signatures.push(`${[...controlNames].sort().join(',')}|${attributes}`);
    }
  });
  return signatures;
}

function elementClassSet(
  element: UnknownRecord,
  bindings: ReadonlyMap<string, string>,
): Set<string> {
  const attributes = element['attributes'];
  if (!Array.isArray(attributes)) return new Set();
  const classes = new Set<string>();
  for (const attribute of attributes) {
    if (!isRecord(attribute)) continue;
    if (
      attribute['type'] === 'ClassDirective' &&
      typeof attribute['name'] === 'string' &&
      isRecord(attribute['expression']) &&
      ((attribute['expression']['type'] === 'Literal' &&
        attribute['expression']['value'] === true) ||
        (attribute['expression']['type'] === 'Identifier' &&
          typeof attribute['expression']['name'] === 'string' &&
          bindings.get(attribute['expression']['name']) === 'true'))
    )
      classes.add(attribute['name']);
    if (attribute['type'] !== 'Attribute' || attribute['name'] !== 'class') continue;
    const staticValue = staticAttributeValue(attribute);
    if (staticValue !== undefined) {
      for (const className of staticValue.split(/\s+/).filter(Boolean)) classes.add(className);
      continue;
    }

    const value = attribute['value'];
    const parts = Array.isArray(value) ? value : [value];
    for (const part of parts) {
      if (!isRecord(part)) continue;
      if (part['type'] === 'Text' && typeof part['data'] === 'string') {
        for (const className of part['data'].split(/\s+/).filter(Boolean)) classes.add(className);
        continue;
      }
      if (part['type'] !== 'ExpressionTag' || !isRecord(part['expression'])) continue;
      const expression = part['expression'];
      if (expression['type'] === 'ArrayExpression' && Array.isArray(expression['elements'])) {
        for (const arrayElement of expression['elements']) {
          const className = isRecord(arrayElement)
            ? staticStringFromExpression(arrayElement, bindings)
            : undefined;
          if (className) className.split(/\s+/).forEach((name) => classes.add(name));
        }
      }
      if (expression['type'] === 'ObjectExpression' && Array.isArray(expression['properties'])) {
        for (const property of expression['properties']) {
          if (
            !isRecord(property) ||
            property['type'] !== 'Property' ||
            property['computed'] === true
          )
            continue;
          const key = property['key'];
          const enabled = property['value'];
          const className = isRecord(key)
            ? (staticStringFromExpression(key, bindings) ??
              (key['type'] === 'Identifier' && typeof key['name'] === 'string'
                ? key['name']
                : undefined))
            : undefined;
          if (
            className &&
            isRecord(enabled) &&
            enabled['type'] === 'Literal' &&
            enabled['value'] === true
          )
            classes.add(className);
        }
      }
      if (
        expression['type'] !== 'CallExpression' ||
        !isRecord(expression['callee']) ||
        expression['callee']['type'] !== 'Identifier' ||
        expression['callee']['name'] !== 'classNames' ||
        !Array.isArray(expression['arguments'])
      )
        continue;
      for (const className of expression['arguments'].flatMap(
        (argument) => staticStringFromExpression(argument, bindings)?.split(/\s+/) ?? [],
      ))
        if (className) classes.add(className);
    }
  }
  return classes;
}

function isPanelLikeClassSet(classes: ReadonlySet<string>): boolean {
  return [...classes].some((className) =>
    /(?:floating|surface|menu|popover|dialog|modal|drawer|tooltip|dropdown|sheet|panel|listbox|combobox|command)/i.test(
      className,
    ),
  );
}

function collectSharedFloatingTargets(source: string): SharedFloatingTarget[] {
  const fragment = parseSvelteFragment(source);
  const bindings = staticStringBindings(source);
  const targets: SharedFloatingTarget[] = [];
  if (fragment === undefined) return targets;
  walkAst(fragment, (node) => {
    if (node['type'] !== 'RegularElement' && node['type'] !== 'SvelteElement') return;
    const classes = elementClassSet(node, bindings);
    if (!classes.has('cinder-_floating-surface')) return;
    const attributes = new Map<string, string | true>();
    let id: string | undefined;
    if (Array.isArray(node['attributes']))
      for (const attribute of node['attributes']) {
        if (
          !isRecord(attribute) ||
          attribute['type'] !== 'Attribute' ||
          typeof attribute['name'] !== 'string' ||
          attribute['name'] === 'class'
        )
          continue;
        const value = attribute['value'] === true ? true : staticAttributeValue(attribute);
        if (value === undefined) continue;
        attributes.set(attribute['name'].toLowerCase(), value);
        if (attribute['name'] === 'id' && typeof value === 'string') id = value;
      }
    const tags =
      node['type'] === 'RegularElement' && typeof node['name'] === 'string'
        ? [node['name'].toLowerCase()]
        : [...possibleStaticStringsFromExpression(node['tag'], bindings)].map((tag) =>
            tag.toLowerCase(),
          );
    for (const tag of tags.length > 0 ? tags : [undefined])
      targets.push({
        ...(tag === undefined ? {} : { tag }),
        ...(id === undefined ? {} : { id }),
        classes,
        attributes,
      });
  });
  return targets;
}

function inlineStylePrimitiveCounts(source: string): CssPrimitiveCounts {
  const fragment = parseSvelteFragment(source);
  const bindings = staticStringBindings(source);
  const total: CssPrimitiveCounts = { grid: 0, floating: 0 };
  const parsedRoot: unknown = parseSvelte(source, { modern: true });
  if (isRecord(parsedRoot) && isRecord(parsedRoot['css'])) {
    const content = parsedRoot['css']['content'];
    const styleSource =
      isRecord(content) && typeof content['styles'] === 'string' ? content['styles'] : undefined;
    if (styleSource !== undefined) {
      const styleCounts = cssPrimitiveCounts(styleSource, collectSharedFloatingTargets(source));
      total.grid += styleCounts.grid;
      total.floating += styleCounts.floating;
    }
  }
  if (fragment === undefined) return total;
  walkAst(fragment, (node) => {
    if (
      (node['type'] !== 'RegularElement' && node['type'] !== 'SvelteElement') ||
      !Array.isArray(node['attributes'])
    )
      return;
    const classes = elementClassSet(node, bindings);
    let declarationBranches = [new Map<string, string>()];
    for (const attribute of node['attributes']) {
      if (!isRecord(attribute)) continue;
      if (attribute['type'] === 'Attribute' && attribute['name'] === 'style') {
        const attributeValue = attribute['value'];
        const expressionTag =
          isRecord(attributeValue) && attributeValue['type'] === 'ExpressionTag'
            ? attributeValue
            : Array.isArray(attributeValue) &&
                attributeValue.length === 1 &&
                isRecord(attributeValue[0]) &&
                attributeValue[0]['type'] === 'ExpressionTag'
              ? attributeValue[0]
              : undefined;
        const styleObjectBranches = styleObjectDeclarationBranches(
          expressionTag?.['expression'],
          source,
        );
        declarationBranches = declarationBranches.flatMap((declarations) =>
          styleObjectBranches.map(
            (styleObjectDeclarations) => new Map([...declarations, ...styleObjectDeclarations]),
          ),
        );
        const value = attributeValueWithDynamics(attribute, bindings);
        if (value === undefined || !value.includes(':')) continue;
        const root = parseCss(`:root { ${value} }`);
        const rule = root.first;
        if (rule?.type === 'rule')
          for (const declarations of declarationBranches)
            for (const [property, declarationValue] of declarationMap(rule))
              declarations.set(property, declarationValue);
      }
      if (attribute['type'] === 'StyleDirective' && typeof attribute['name'] === 'string') {
        const value = attribute['value'];
        const expressionTag =
          isRecord(value) && value['type'] === 'ExpressionTag'
            ? value
            : Array.isArray(value) && value.length === 1 && isRecord(value[0])
              ? value[0]
              : undefined;
        const possibleValues =
          expressionTag !== undefined
            ? possibleStaticStringsFromExpression(expressionTag['expression'], bindings)
            : new Set<string>();
        const normalizedValues = [...possibleValues].map((candidate) => candidate.toLowerCase());
        const allLayeringValues =
          normalizedValues.length > 0 &&
          normalizedValues.every((candidate) => candidate === 'absolute' || candidate === 'fixed');
        const directiveName = attribute['name'].toLowerCase();
        if (allLayeringValues) {
          for (const declarations of declarationBranches)
            declarations.set(directiveName, 'absolute');
        } else if (normalizedValues.length > 0) {
          // A conditional/logical directive value (`style:display={active ?
          // 'grid' : 'block'}`) has multiple reachable static outcomes, each
          // a distinct possible render — keep every one as its own branch
          // instead of collapsing to a single dynamic placeholder, the same
          // way a style OBJECT's conditional branches are preserved above.
          declarationBranches = declarationBranches.flatMap((declarations) =>
            normalizedValues.map(
              (candidate) => new Map([...declarations, [directiveName, candidate]]),
            ),
          );
        } else {
          const fallback =
            attributeValueWithDynamics(attribute, bindings)?.toLowerCase() ??
            'var(--cinder-dynamic-value)';
          for (const declarations of declarationBranches) declarations.set(directiveName, fallback);
        }
      }
    }
    if (
      declarationBranches.some((declarations) => {
        const display = declarations.get('display');
        return (
          (display === 'grid' || display === 'inline-grid') &&
          gridDefinitionProperties.some((property) => declarations.has(property))
        );
      })
    )
      total.grid++;
    if (
      declarationBranches.some((declarations) => {
        const position = declarations.get('position');
        const zIndex = declarations.get('z-index')?.trim();
        return (
          (position === 'absolute' || position === 'fixed') &&
          zIndex !== undefined &&
          !['auto', 'inherit', 'initial', 'revert', 'revert-layer', 'unset'].includes(zIndex)
        );
      }) &&
      (classes.size === 0 || isPanelLikeClassSet(classes)) &&
      !classes.has('cinder-_floating-surface')
    )
      total.floating++;
  });
  return total;
}

export function shouldCheckComponentSource(filePath: string): boolean {
  return !isExcludedComponentSource(filePath);
}

export { missingMigrationRecordPaths } from './primitive-composition-migrations.ts';

export function findPrimitiveCompositionViolations(
  source: string,
  filePath: string,
  companionSource: string | readonly string[] = '',
): PrimitiveCompositionViolation[] {
  const normalized = filePath
    .replaceAll('\\', '/')
    .replace(/^.*packages\/components\/src\/components\//, '');
  const violations: PrimitiveCompositionViolation[] = [];
  const rawControlCount = normalized.endsWith('.svelte') ? visibleControlCount(source) : 0;
  const rawControlSignatures = normalized.endsWith('.svelte')
    ? visibleControlSignatures(source)
    : [];
  const expectedRawControlCount = allowedRawControlCounts.get(normalized);
  if (rawControlCount > 0 && expectedRawControlCount === undefined) {
    violations.push({
      filePath,
      message: 'Compose the canonical form-control primitive instead of rendering a raw control.',
    });
  }
  if (expectedRawControlCount !== undefined && expectedRawControlCount !== rawControlCount) {
    violations.push({
      filePath,
      message:
        'A tracked raw-control count changed; migrate it or update the explicit migration record.',
    });
  }
  const expectedRawControlSignatures = allowedRawControlSignatures.get(normalized);
  if (
    expectedRawControlSignatures !== undefined &&
    (expectedRawControlSignatures.length !== rawControlSignatures.length ||
      expectedRawControlSignatures.some(
        (signature, index) => signature !== rawControlSignatures[index],
      ))
  ) {
    violations.push({
      filePath,
      message:
        'A tracked raw-control identity changed; migrate it or update the explicit migration record.',
    });
  }
  const companionSources =
    typeof companionSource === 'string' ? [companionSource] : companionSource;
  const counts = normalized.endsWith('.css')
    ? cssPrimitiveCounts(
        source,
        companionSources.flatMap((candidate) => collectSharedFloatingTargets(candidate)),
      )
    : normalized.endsWith('.svelte')
      ? inlineStylePrimitiveCounts(source)
      : { grid: 0, floating: 0 };
  const expectedGridCount = allowedGridCounts.get(normalized);
  if (counts.grid > 0 && expectedGridCount === undefined) {
    violations.push({
      filePath,
      message: 'Compose Grid instead of hand-rolling a grid column layout.',
    });
  }
  if (expectedGridCount !== undefined && expectedGridCount !== counts.grid) {
    violations.push({
      filePath,
      message: 'A tracked grid-layout count changed; migrate it or update the migration record.',
    });
  }
  const expectedFloatingCount = allowedFloatingCounts.get(normalized);
  if (counts.floating > 0 && expectedFloatingCount === undefined) {
    violations.push({
      filePath,
      message: 'Consume _floating-surface.css for positioned, layered surfaces.',
    });
  }
  if (expectedFloatingCount !== undefined && expectedFloatingCount !== counts.floating) {
    violations.push({
      filePath,
      message:
        'A tracked floating-surface count changed; migrate it or update the migration record.',
    });
  }
  const wrappers = normalized.endsWith('.svelte') ? fieldWrapperCount(source) : 0;
  const expectedWrapperCount = allowedFieldWrapperCounts.get(normalized);
  if (wrappers > 0 && expectedWrapperCount === undefined) {
    violations.push({
      filePath,
      message: 'Compose FormField instead of hand-rolling label, description, and error wrappers.',
    });
  }
  if (expectedWrapperCount !== undefined && expectedWrapperCount !== wrappers) {
    violations.push({
      filePath,
      message: 'A tracked field-wrapper count changed; migrate it or update the migration record.',
    });
  }
  return violations;
}

if (import.meta.main)
  await runPrimitiveCompositionCheck(
    shouldCheckComponentSource,
    findPrimitiveCompositionViolations,
    missingMigrationRecordPaths,
  );
