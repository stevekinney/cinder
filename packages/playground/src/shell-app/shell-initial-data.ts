export type InitialData = { component: string; components: string[]; readmeHtml: string };

function getOwnProperty(value: object, key: string): unknown {
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

/**
 * Validate the shell data island and normalize older cached payloads that
 * predate the README landing page. Component route payloads without
 * `readmeHtml` are still safe because component pages never render it.
 */
export function parseInitialData(value: unknown): InitialData | null {
  if (typeof value !== 'object' || value === null) return null;
  const component = getOwnProperty(value, 'component');
  const components = getOwnProperty(value, 'components');
  const readmeHtml = getOwnProperty(value, 'readmeHtml');
  if (typeof component !== 'string') return null;
  if (!Array.isArray(components)) return null;
  if (readmeHtml !== undefined && typeof readmeHtml !== 'string') return null;
  const componentNamePattern = /^[a-z0-9][a-z0-9-]*$/;
  // The active component can legitimately be absent from `components`: the
  // server lists only sidebar-eligible components there (those with at least
  // one .example.svelte), but `/c/<name>` accepts any discovered component.
  // So we validate the component name's shape but NOT membership in the
  // sidebar list — that would wipe the sidebar for a perfectly valid URL
  // like /c/radio.
  if (component !== '' && !componentNamePattern.test(component)) return null;
  for (const item of components) {
    if (typeof item !== 'string' || !componentNamePattern.test(item)) return null;
  }
  return {
    component,
    components,
    readmeHtml: readmeHtml ?? '',
  };
}
