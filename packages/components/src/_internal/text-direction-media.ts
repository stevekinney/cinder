import {
  collectDirectionStyleSheets,
  isCssRuleCollection,
  isMediaRule,
  readNestedCssRules,
} from './text-direction-css-primitives.ts';

interface MediaInventory {
  queries: Set<string>;
  visitedSheets: Set<object>;
}

export function observeTextDirectionMediaQueries(
  element: HTMLElement | null | undefined,
  onChange: () => void,
): (() => void) | undefined {
  if (!element || typeof matchMedia !== 'function') return undefined;
  const inventory: MediaInventory = { queries: new Set(), visitedSheets: new Set() };
  for (const sheet of collectDirectionStyleSheets(element).keys()) visitSheet(sheet, inventory);
  const queries = [...inventory.queries].map((query) => matchMedia(query));
  const handler = () => onChange();
  for (const query of queries) query.addEventListener?.('change', handler);
  return () => {
    for (const query of queries) query.removeEventListener?.('change', handler);
  };
}

function visitSheet(sheet: object, inventory: MediaInventory): void {
  if (inventory.visitedSheets.has(sheet)) return;
  inventory.visitedSheets.add(sheet);
  try {
    const rules: unknown = Reflect.get(sheet, 'cssRules');
    if (isCssRuleCollection(rules)) visitRules(rules, inventory);
  } catch {
    // Cross-origin stylesheets can deny access to their rules.
  }
}

function visitRules(rules: CSSRuleList | Iterable<CSSRule>, inventory: MediaInventory): void {
  for (const rule of Array.from(rules)) {
    if (rule.type === 3) {
      visitImport(rule, inventory);
      continue;
    }
    if (isMediaRule(rule)) addQuery(Reflect.get(rule, 'conditionText'), inventory);
    const nested = readNestedCssRules(rule);
    if (nested) visitRules(nested, inventory);
  }
}

function visitImport(rule: CSSRule, inventory: MediaInventory): void {
  try {
    const media: unknown = Reflect.get(rule, 'media');
    if (typeof media === 'object' && media !== null)
      addQuery(Reflect.get(media, 'mediaText'), inventory);
  } catch {
    // The import media can be inaccessible independently of the sheet.
  }
  try {
    const imported: unknown = Reflect.get(rule, 'styleSheet');
    if (typeof imported === 'object' && imported !== null) visitSheet(imported, inventory);
  } catch {
    // Cross-origin imported stylesheets can deny access.
  }
}

function addQuery(condition: unknown, inventory: MediaInventory): void {
  if (typeof condition === 'string' && condition) inventory.queries.add(condition);
}
