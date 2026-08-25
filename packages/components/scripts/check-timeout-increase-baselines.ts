import { normalizeThresholdKind } from './check-timeout-increase-comparison';
import {
  findCallArguments,
  NUMERIC_EXPRESSION_PATTERN,
  NUMERIC_LITERAL_PATTERN,
  type WaitThresholdArgument,
} from './check-timeout-increase-numeric';
import type { BunTestTimeoutArgument } from './check-timeout-increase-types';

export type ThresholdBaseline = { renderedValue: string; value: number };

export function findBunDefaultTimeoutAliasArguments(
  importSource: string,
  analysis: string,
): BunTestTimeoutArgument[] {
  const argumentsFound: BunTestTimeoutArgument[] = [];
  for (const match of importSource.matchAll(
    /\bimport\s*\{(?<imports>[^}]*)\}\s*from\s+['"]bun:test['"]/gu,
  )) {
    for (const aliasMatch of (match.groups?.['imports'] ?? '').matchAll(
      /(?:^|,)\s*setDefaultTimeout\s+as\s+(?<alias>[A-Za-z_$][\w$]*)/gu,
    )) {
      const alias = aliasMatch.groups?.['alias'];
      if (alias === undefined) continue;
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      for (const call of findCallArguments(
        analysis,
        new RegExp(String.raw`\b${escapedAlias}\s*\(`, 'gu'),
      )) {
        const argument = call[0];
        if (argument === undefined) continue;
        if (!new RegExp(String.raw`^${NUMERIC_EXPRESSION_PATTERN}$`, 'u').test(argument.text))
          continue;
        argumentsFound.push({ offset: argument.offset, renderedValue: argument.text });
      }
    }
  }
  return argumentsFound;
}

function resolveNumericOption(
  analysis: string,
  optionText: string,
  optionOffset: number,
  optionName: string,
): { offset: number; renderedValue: string } | undefined {
  const match = new RegExp(
    String.raw`\b${optionName}\s*:\s*(?<value>${NUMERIC_EXPRESSION_PATTERN}|[A-Za-z_$][\w$]*)`,
    'u',
  ).exec(optionText);
  let renderedValue = match?.groups?.['value'];
  if (match === null || renderedValue === undefined) return undefined;
  let offset = optionOffset + match.index + match[0].lastIndexOf(renderedValue);
  if (/^[A-Za-z_$][\w$]*$/u.test(renderedValue)) {
    const declarationPattern = new RegExp(
      String.raw`\b(?:const|let|var)\s+${renderedValue}\b[^=;\n]*=\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
      'gu',
    );
    const declaration = [...analysis.matchAll(declarationPattern)]
      .filter((candidate) => (candidate.index ?? 0) < optionOffset)
      .at(-1);
    const declaredValue = declaration?.groups?.['value'];
    if (declaration === undefined || declaredValue === undefined) return undefined;
    renderedValue = declaredValue;
    offset = (declaration.index ?? 0) + declaration[0].lastIndexOf(declaredValue);
  }
  return { offset, renderedValue };
}

export function findAdditionalWaitThresholdArguments(analysis: string): WaitThresholdArgument[] {
  const argumentsFound: WaitThresholdArgument[] = [];
  for (const match of analysis.matchAll(/\bBun\.(?<method>sleep(?:Sync)?)\s*\(/gu)) {
    const callArguments = findCallArguments(
      analysis.slice(match.index),
      /^Bun\.sleep(?:Sync)?\s*\(/gu,
    )[0];
    const argument = callArguments?.[0];
    if (
      argument === undefined ||
      /\bMath\.(?:min|max)\s*\(/u.test(argument.text) ||
      new RegExp(String.raw`^${NUMERIC_EXPRESSION_PATTERN}$`, 'u').test(argument.text)
    )
      continue;
    for (const [occurrenceIndex, value] of [
      ...argument.text.matchAll(new RegExp(NUMERIC_LITERAL_PATTERN, 'gu')),
    ].entries()) {
      argumentsFound.push({
        label: match.groups?.['method'] === 'sleepSync' ? 'bun.sleepSync' : 'bun.sleep',
        occurrenceIndex,
        offset: (match.index ?? 0) + argument.offset + (value.index ?? 0),
        renderedValue: value[0],
      });
    }
  }
  for (const callArguments of findCallArguments(analysis, /\bBun\.spawn(?:Sync)?\s*\(/gu)) {
    for (const argument of callArguments) {
      const timeout = resolveNumericOption(analysis, argument.text, argument.offset, 'timeout');
      if (timeout === undefined) continue;
      argumentsFound.push({
        ...timeout,
        baseline: { renderedValue: 'unbounded (implicit Bun spawn timeout)', value: Infinity },
        label: 'bun-spawn-timeout',
      });
    }
  }
  for (const callArguments of findCallArguments(
    analysis,
    /(?<![\w$.])(?:spawn|spawnSync|exec|execSync)\s*\(/gu,
  )) {
    for (const argument of callArguments) {
      const timeout = resolveNumericOption(analysis, argument.text, argument.offset, 'timeout');
      if (timeout === undefined) continue;
      argumentsFound.push({
        ...timeout,
        baseline: {
          renderedValue: 'unbounded (implicit Node subprocess timeout)',
          value: Infinity,
        },
        label: 'timeout',
      });
    }
  }
  for (const callArguments of findCallArguments(
    analysis,
    /(?<![\w$.])waitFor[A-Za-z_$\d]*\s*\(/gu,
  )) {
    for (const argument of callArguments) {
      const interval = resolveNumericOption(analysis, argument.text, argument.offset, 'interval');
      if (interval === undefined) continue;
      argumentsFound.push({
        ...interval,
        baseline: { renderedValue: '50 (implicit Testing Library waitFor interval)', value: 50 },
        label: 'testing-library-wait-interval',
      });
    }
  }
  for (const callArguments of findCallArguments(
    analysis,
    /(?:\bfindBy[A-Za-z_$\d]*|\b[A-Za-z_$][\w$]*\.[ \t]*findBy[A-Za-z_$\d]*)\s*\(/gu,
  )) {
    const options = callArguments[2];
    if (options === undefined) continue;
    const timeout = resolveNumericOption(analysis, options.text, options.offset, 'timeout');
    if (timeout === undefined) continue;
    argumentsFound.push({
      ...timeout,
      baseline: { renderedValue: '1_000 (implicit Testing Library findBy timeout)', value: 1_000 },
      label: 'testing-library-wait-timeout',
    });
  }
  return argumentsFound;
}

export function findPlaywrightRelativeTimeoutExtensions(
  analysis: string,
): Array<{ offset: number; renderedValue: string }> {
  const extensions: Array<{ offset: number; renderedValue: string }> = [];
  const pattern = new RegExp(
    String.raw`\btestInfo\.setTimeout\s*\(\s*testInfo\.timeout\s*(?<operator>[+*-])\s*(?<value>${NUMERIC_EXPRESSION_PATTERN})`,
    'gu',
  );
  for (const match of analysis.matchAll(pattern)) {
    const renderedValue = match.groups?.['value'];
    const operator = match.groups?.['operator'];
    if (renderedValue === undefined || operator === undefined) continue;
    extensions.push({
      offset: (match.index ?? 0) + match[0].lastIndexOf(renderedValue),
      renderedValue: `30_000 ${operator} (${renderedValue})`,
    });
  }
  return extensions;
}

type PlaywrightConfigurationDomain = 'expect' | 'nested' | 'project' | 'top-level' | 'webServer';

function playwrightConfigurationDomain(
  filePath: string,
  analysisBeforeLine: string,
  analysisLine: string,
  candidateOffset: number,
): PlaywrightConfigurationDomain | undefined {
  if (!/(?:^|\/)playwright\.config\.[^/]+$/u.test(filePath)) return undefined;
  const prefix = `${analysisBeforeLine}\n${analysisLine.slice(0, candidateOffset)}`;
  const propertyObjects = [...prefix.matchAll(/\b(?<name>[A-Za-z_$][\w$]*)\s*:\s*(?:\[\s*)?\{/gu)];
  for (let index = propertyObjects.length - 1; index >= 0; index -= 1) {
    const propertyObject = propertyObjects[index];
    if (propertyObject === undefined) continue;
    if (propertyObject.index === undefined) continue;
    let braceDepth = 0;
    for (const character of prefix.slice(propertyObject.index)) {
      if (character === '{') braceDepth += 1;
      else if (character === '}') braceDepth -= 1;
    }
    if (braceDepth <= 0) continue;
    const name = propertyObject.groups?.['name'];
    if (name === 'expect' || name === 'webServer') return name;
    if (name === 'projects') return 'project';
    return 'nested';
  }
  return 'top-level';
}

export function implicitBaselineFor(
  label: string,
  line = '',
  filePath = '',
  configurationDomain?: PlaywrightConfigurationDomain,
): ThresholdBaseline | undefined {
  const kind = normalizeThresholdKind(label);
  if (label === 'playwright-operation-timeout') {
    return {
      renderedValue: 'unbounded (implicit Playwright action timeout)',
      value: Number.POSITIVE_INFINITY,
    };
  }
  if (label.toLowerCase() === 'abortsignal.timeout') {
    return { renderedValue: 'unbounded (no AbortSignal timeout)', value: Number.POSITIVE_INFINITY };
  }
  if (['shell.kill-after', 'shell.timeout'].includes(label)) {
    return { renderedValue: 'unbounded (no GNU timeout bound)', value: Number.POSITIVE_INFINITY };
  }
  if (label === 'sleep') return { renderedValue: '0 (no explicit wait)', value: 0 };
  if (
    label.toLowerCase() === 'timeout-minutes' &&
    /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(filePath)
  ) {
    return { renderedValue: '360 (implicit GitHub Actions job timeout)', value: 360 };
  }
  if (kind === 'timeout' && /(?:^|\/)bunfig\.toml$/u.test(filePath)) {
    return { renderedValue: '5_000 (implicit Bun test timeout)', value: 5_000 };
  }
  if (
    ['repeat-each', 'repeateach'].includes(label.toLowerCase()) &&
    (label.includes('-') || /(?:^|\/)playwright\.config\.[^/]+$/u.test(filePath))
  ) {
    return { renderedValue: '1 (implicit Playwright repeatEach)', value: 1 };
  }
  if (kind === 'retries') return { renderedValue: '0 (implicit default retries)', value: 0 };
  if (kind === 'slow') return { renderedValue: '1 (implicit normal timeout)', value: 1 };
  if (
    label.toLowerCase() === 'testtimeout' &&
    (/(?:^|\/)(?:jest|vitest)\.config\.[^/]+$/u.test(filePath) || /\b(?:jest|vitest)\b/u.test(line))
  ) {
    return { renderedValue: '5_000 (implicit test runner timeout)', value: 5_000 };
  }
  if (
    ['hooktimeout', 'teardowntimeout'].includes(label.toLowerCase()) &&
    /(?:^|\/)vitest\.config\.[^/]+$/u.test(filePath)
  ) {
    return { renderedValue: '10_000 (implicit Vitest lifecycle timeout)', value: 10_000 };
  }
  if (configurationDomain === 'expect') {
    return { renderedValue: '5_000 (implicit Playwright expect timeout)', value: 5_000 };
  }
  if (configurationDomain === 'webServer') {
    return { renderedValue: '60_000 (implicit Playwright web server timeout)', value: 60_000 };
  }
  if (
    label.toLowerCase() === 'globaltimeout' &&
    /(?:^|\/)playwright\.config\.[^/]+$/u.test(filePath)
  ) {
    return {
      renderedValue: 'unbounded (implicit Playwright global timeout disabled)',
      value: Number.POSITIVE_INFINITY,
    };
  }
  if (
    label.toLowerCase() === 'actiontimeout' &&
    /(?:^|\/)playwright\.config\.[^/]+$/u.test(filePath)
  ) {
    return {
      renderedValue: 'unbounded (implicit Playwright action timeout disabled)',
      value: Number.POSITIVE_INFINITY,
    };
  }
  if (
    label.toLowerCase() === 'timeout' &&
    (configurationDomain === 'top-level' ||
      configurationDomain === 'project' ||
      /\btest\.describe\.configure\s*\(/u.test(line))
  ) {
    return { renderedValue: '30_000 (implicit Playwright test timeout)', value: 30_000 };
  }
  if (kind === 'timeout' && /\bbun\s+test(?:\s|$)/u.test(line)) {
    return { renderedValue: '5_000 (implicit Bun test timeout)', value: 5_000 };
  }
  if (label.toLowerCase() === 'settimeout' && /\b(?:test|testInfo)\.setTimeout\s*\(/u.test(line)) {
    return { renderedValue: '30_000 (implicit Playwright test timeout)', value: 30_000 };
  }
  if (
    ['setdefaulttimeout', 'setdefaultnavigationtimeout'].includes(label.toLowerCase()) &&
    /\.\s*setDefault(?:Navigation)?Timeout\s*\(/u.test(line)
  ) {
    return {
      renderedValue: 'unbounded (implicit Playwright operation timeout disabled)',
      value: Number.POSITIVE_INFINITY,
    };
  }
  if (
    label.toLowerCase() === 'setdefaulttimeout' &&
    /(?<![\w$.])setDefaultTimeout\s*\(/u.test(line)
  ) {
    return { renderedValue: '5_000 (implicit Bun test timeout)', value: 5_000 };
  }
  return undefined;
}

export function implicitBaselineForMatch(
  label: string,
  line: string,
  filePath: string,
  analysisBeforeLine: string,
  analysisLine: string,
  candidateOffset: number,
): ThresholdBaseline | undefined {
  const prefix = `${analysisBeforeLine}\n${analysisLine.slice(0, candidateOffset)}`;
  if (
    normalizeThresholdKind(label) === 'timeout' &&
    /\.(?:waitFor|waitForSelector|waitForLoadState|waitForURL)\s*\([\s\S]*\{[^}]*$/u.test(prefix)
  ) {
    return {
      renderedValue: 'unbounded (implicit Playwright locator wait timeout)',
      value: Number.POSITIVE_INFINITY,
    };
  }
  if (
    normalizeThresholdKind(label) === 'timeout' &&
    /(?:^|[^\w$.])waitFor[A-Za-z_$\d]*\s*\([\s\S]*,\s*\{[^}]*$/u.test(prefix)
  ) {
    return { renderedValue: '1_000 (implicit Testing Library waitFor timeout)', value: 1_000 };
  }
  if (
    normalizeThresholdKind(label) === 'timeout' &&
    /\bexpect\s*\([^)]*\)\.toPass\s*\([^)]*\{[^}]*$/u.test(prefix)
  ) {
    return { renderedValue: '0 (implicit Playwright toPass timeout)', value: 0 };
  }
  if (
    normalizeThresholdKind(label) === 'timeout' &&
    /\bexpect(?:\.(?:configure|poll))?\s*\(/u.test(prefix)
  ) {
    return { renderedValue: '5_000 (implicit Playwright expect timeout)', value: 5_000 };
  }
  return implicitBaselineFor(
    label,
    line,
    filePath,
    playwrightConfigurationDomain(filePath, analysisBeforeLine, analysisLine, candidateOffset),
  );
}

export function waitThresholdBaselineFor(
  label: string,
  explicitBaseline?: ThresholdBaseline,
): ThresholdBaseline {
  if (['fetchwithtimeout', 'promisewithtimeout'].includes(label.toLowerCase())) {
    return { renderedValue: 'unbounded operation', value: Number.POSITIVE_INFINITY };
  }
  return (
    explicitBaseline ??
    implicitBaselineFor(label) ?? { renderedValue: '0 (no explicit wait)', value: 0 }
  );
}
