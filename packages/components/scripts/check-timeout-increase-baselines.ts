import { normalizeThresholdKind } from './check-timeout-increase-comparison';

export type ThresholdBaseline = { renderedValue: string; value: number };

type PlaywrightConfigurationDomain = 'expect' | 'nested' | 'top-level' | 'webServer';

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
  if (
    label.toLowerCase() === 'timeout-minutes' &&
    /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(filePath)
  ) {
    return { renderedValue: '360 (implicit GitHub Actions job timeout)', value: 360 };
  }
  if (kind === 'retries') return { renderedValue: '0 (implicit default retries)', value: 0 };
  if (kind === 'slow') return { renderedValue: '1 (implicit normal timeout)', value: 1 };
  if (
    label.toLowerCase() === 'testtimeout' &&
    /(?:^|\/)(?:jest|vitest)\.config\.[^/]+$/u.test(filePath)
  ) {
    return { renderedValue: '5_000 (implicit test runner timeout)', value: 5_000 };
  }
  if (configurationDomain === 'expect') {
    return { renderedValue: '5_000 (implicit Playwright expect timeout)', value: 5_000 };
  }
  if (configurationDomain === 'webServer') {
    return { renderedValue: '60_000 (implicit Playwright web server timeout)', value: 60_000 };
  }
  if (
    kind === 'timeout' &&
    (configurationDomain === 'top-level' || /\btest\.describe\.configure\s*\(/u.test(line))
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
    return { renderedValue: '30_000 (implicit Playwright action timeout)', value: 30_000 };
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
  if (
    normalizeThresholdKind(label) === 'timeout' &&
    /\bexpect(?:\.poll)?\s*\(/u.test(
      `${analysisBeforeLine}\n${analysisLine.slice(0, candidateOffset)}`,
    )
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
