type MediaObservation = { source: HTMLElement; roots: ShadowRoot[] };

const observedMediaQueries = new Map<string, MediaQueryList>();

export function refreshMediaQueryObservers(
  observations: Iterable<MediaObservation>,
  onChange: () => void,
): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  const queries = collectObservedQueries(observations);
  removeStaleMediaQueries(queries, onChange);
  addNewMediaQueries(queries, onChange);
}

export function clearMediaQueryObservers(onChange: () => void): void {
  for (const mediaQuery of observedMediaQueries.values())
    removeMediaQueryListener(mediaQuery, onChange);
  observedMediaQueries.clear();
}

function collectObservedQueries(observations: Iterable<MediaObservation>): Set<string> {
  const queries = new Set<string>();
  const roots = new Set<Document | ShadowRoot>([document]);
  for (const observation of observations) {
    const root = observation.source.getRootNode();
    if (root instanceof ShadowRoot) roots.add(root);
    for (const observedRoot of observation.roots) roots.add(observedRoot);
  }
  for (const root of roots) collectRootQueries(root, queries);
  return queries;
}

function collectRootQueries(root: Document | ShadowRoot, queries: Set<string>): void {
  const stylesheets = [
    ...Array.from(root.styleSheets ?? []),
    ...Array.from(root.adoptedStyleSheets ?? []),
  ];
  for (const stylesheet of stylesheets) {
    try {
      const mediaText = stylesheet.media?.mediaText;
      if (mediaText) queries.add(mediaText);
      collectMediaQueries(stylesheet.cssRules, queries);
    } catch {
      // Cross-origin stylesheets are not script-readable.
    }
  }
}

function collectMediaQueries(rules: CSSRuleList | Iterable<CSSRule>, queries: Set<string>): void {
  for (const rule of Array.from(rules)) collectRuleQueries(rule, queries);
}

function collectRuleQueries(rule: CSSRule, queries: Set<string>): void {
  const conditionText = Reflect.get(rule, 'conditionText');
  const media = Reflect.get(rule, 'media');
  if (typeof conditionText === 'string' && media && typeof media === 'object')
    queries.add(conditionText);
  const mediaText = media && Reflect.get(media, 'mediaText');
  if (typeof mediaText === 'string' && mediaText) queries.add(mediaText);
  const imported = Reflect.get(rule, 'styleSheet');
  if (imported) collectImportedQueries(imported, queries);
  const nestedRules = Reflect.get(rule, 'cssRules');
  if (isCssRuleCollection(nestedRules)) {
    try {
      collectMediaQueries(nestedRules, queries);
    } catch {
      /* inaccessible CSS rules */
    }
  }
}

function collectImportedQueries(imported: unknown, queries: Set<string>): void {
  if ((typeof imported !== 'object' && typeof imported !== 'function') || imported === null) return;
  try {
    const media = Reflect.get(imported, 'media');
    const mediaText = media && Reflect.get(media, 'mediaText');
    if (typeof mediaText === 'string' && mediaText) queries.add(mediaText);
    const rules = Reflect.get(imported, 'cssRules');
    if (isCssRuleCollection(rules)) collectMediaQueries(rules, queries);
  } catch {
    /* cross-origin imported stylesheets are ignored */
  }
}

function isCssRuleCollection(value: unknown): value is CSSRuleList | Iterable<CSSRule> {
  if (typeof CSSRuleList !== 'undefined' && value instanceof CSSRuleList) return true;
  return typeof value === 'object' && value !== null && Symbol.iterator in value;
}

function addNewMediaQueries(queries: Set<string>, onChange: () => void): void {
  for (const query of queries) {
    if (observedMediaQueries.has(query)) continue;
    const mediaQuery = window.matchMedia(query);
    addMediaQueryListener(mediaQuery, onChange);
    observedMediaQueries.set(query, mediaQuery);
  }
}

function removeStaleMediaQueries(queries: Set<string>, onChange: () => void): void {
  for (const [query, mediaQuery] of observedMediaQueries) {
    if (queries.has(query)) continue;
    removeMediaQueryListener(mediaQuery, onChange);
    observedMediaQueries.delete(query);
  }
}

function addMediaQueryListener(mediaQuery: MediaQueryList, onChange: () => void): void {
  if (typeof mediaQuery.addEventListener === 'function')
    mediaQuery.addEventListener('change', onChange);
  else mediaQuery.addListener?.(onChange);
}

function removeMediaQueryListener(mediaQuery: MediaQueryList, onChange: () => void): void {
  if (typeof mediaQuery.removeEventListener === 'function')
    mediaQuery.removeEventListener('change', onChange);
  else mediaQuery.removeListener?.(onChange);
}
