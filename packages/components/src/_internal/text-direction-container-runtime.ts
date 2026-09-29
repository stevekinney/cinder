import { evaluateSizeQuery } from './text-direction-container-size.ts';
import { parseStyleQuery } from './text-direction-container.ts';
import type { ParentElementResolver } from './text-direction-css.ts';

function resolveContainerQueryText(
  conditionText: string,
  rule: CSSRule,
  containerName: unknown,
): string {
  const containerQuery = Reflect.get(rule, 'containerQuery');
  if (typeof containerQuery === 'string') return containerQuery;
  if (typeof containerName !== 'string' || !containerName) return conditionText;
  if (!conditionText.startsWith(containerName)) return conditionText;
  const rest = conditionText.slice(containerName.length);
  if (!/^\s/.test(rest)) return conditionText;
  return rest.trimStart();
}

interface ContainerConditionEntry {
  name: string;
  query: string;
}

// `CSSContainerRule.conditions` exposes each entry of a comma-separated
// `@container` condition list (`@container sidebar (min-width: 20rem),
// (min-width: 40rem)`) as an independent `{ name, query }` pair. Browsers
// blank the legacy singular `containerName`/`containerQuery` accessors to
// `''` once a rule uses this form (verified against real Chromium), so an
// empty legacy `containerQuery` must not be read as "no condition" when
// `.conditions` actually holds the real ones — this guard is checked before
// the legacy accessors specifically so that case is caught. Environments
// where `.conditions` is absent, not an array, empty, or holds anything
// that isn't a `{ name: string, query: string }` pair fall through to the
// legacy single-condition path unchanged (which itself fails closed on an
// empty `containerQuery`) — this is an enhancement layered on top of that
// path, not a replacement for it.
function isContainerConditionList(value: unknown): value is ContainerConditionEntry[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof Reflect.get(entry, 'name') === 'string' &&
      typeof Reflect.get(entry, 'query') === 'string',
  );
}

export function isContainerQueryActive(
  conditionText: string,
  element: HTMLElement,
  rule: CSSRule,
  getParentElement: ParentElementResolver,
): boolean {
  if (typeof getComputedStyle !== 'function') return false;
  const conditions = Reflect.get(rule, 'conditions');
  // A comma-separated condition list is active if ANY entry matches — each
  // entry gets its own independent named-container ancestor resolution and
  // condition evaluation, OR'd together, matching the
  // `<container-condition-list>` comma-separated grammar.
  if (isContainerConditionList(conditions))
    return conditions.some((condition) =>
      isSingleContainerConditionActive(condition.query, condition.name, element, getParentElement),
    );
  const containerName = Reflect.get(rule, 'containerName');
  const queryText = resolveContainerQueryText(conditionText, rule, containerName);
  return isSingleContainerConditionActive(queryText, containerName, element, getParentElement);
}

function isSingleContainerConditionActive(
  queryText: string,
  containerName: unknown,
  element: HTMLElement,
  getParentElement: ParentElementResolver,
): boolean {
  if (!queryText.trim()) return false;
  const styleQuery = parseStyleQuery(queryText);
  if (styleQuery)
    return evaluateStyleQuery(queryText, styleQuery, containerName, element, getParentElement);
  const queriesPhysicalWidth =
    /(?:^|[\s(])(?:width|min-width|max-width)\s*[:<>=]/i.test(queryText) ||
    /[\d.]+(?:px|rem)\s*(?:<=|<|>=|>)\s*width\b/i.test(queryText);
  const container = findQueryContainer(
    element,
    containerName,
    queriesPhysicalWidth,
    getParentElement,
  );
  if (!container) return false;
  return evaluateSizeQuery(queryText, element, container);
}

function evaluateStyleQuery(
  queryText: string,
  styleQuery: { name: string; value: string; index: number; end: number },
  containerName: unknown,
  element: HTMLElement,
  getParentElement: ParentElementResolver,
): boolean {
  const remainder = (queryText.slice(0, styleQuery.index) + queryText.slice(styleQuery.end))
    .replace(/^\s*(?:and|or|not)\b/i, '')
    .replace(/^\(|\)$/g, '')
    .trim();
  if (remainder) return false;
  let ancestor = getParentElement(element);
  while (ancestor) {
    if (!matchesContainerName(ancestor, containerName)) {
      ancestor = getParentElement(ancestor);
      continue;
    }
    const value =
      getComputedStyle(ancestor).getPropertyValue(styleQuery.name).trim() ||
      ancestor.style.getPropertyValue(styleQuery.name).trim();
    return /^\s*not\b/i.test(queryText)
      ? value !== styleQuery.value.trim()
      : value === styleQuery.value.trim();
  }
  return false;
}

function matchesContainerName(container: HTMLElement, containerName: unknown): boolean {
  if (typeof containerName !== 'string' || !containerName) return true;
  const computedStyle = getComputedStyle(container);
  const name =
    computedStyle.containerName ||
    computedStyle.getPropertyValue('container-name') ||
    container.style.containerName ||
    container.style.getPropertyValue('container-name');
  return name.split(/\s+/).includes(containerName);
}

function findQueryContainer(
  element: HTMLElement,
  containerName: unknown,
  queriesPhysicalWidth: boolean,
  getParentElement: ParentElementResolver,
): HTMLElement | null {
  let container = getParentElement(element);
  while (container) {
    const computedStyle = getComputedStyle(container);
    const type =
      computedStyle.containerType ||
      computedStyle.getPropertyValue('container-type') ||
      container.style.containerType ||
      container.style.getPropertyValue('container-type');
    const writingMode =
      computedStyle.writingMode ||
      computedStyle.getPropertyValue('writing-mode') ||
      container.style.writingMode ||
      container.style.getPropertyValue('writing-mode');
    if (isEligibleQueryContainer(container, containerName, queriesPhysicalWidth, type, writingMode))
      return container;
    container = getParentElement(container);
  }
  return null;
}

function isEligibleQueryContainer(
  container: HTMLElement,
  containerName: unknown,
  queriesPhysicalWidth: boolean,
  type: string,
  writingMode: string,
): boolean {
  if (!matchesContainerName(container, containerName) || !type || type === 'normal') return false;
  return !(
    queriesPhysicalWidth &&
    /^(?:vertical|sideways)-/i.test(writingMode) &&
    type === 'inline-size'
  );
}

export function isContainerRule(rule: CSSRule): boolean {
  if (rule.constructor.name === 'CSSContainerRule') return true;
  if (Reflect.get(rule, 'type') !== 0) return false;
  const cssText = Reflect.get(rule, 'cssText');
  return typeof cssText === 'string' && /^\s*@container\b/i.test(cssText);
}
