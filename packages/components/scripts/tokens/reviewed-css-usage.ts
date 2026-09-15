import type { DynamicRecord, Inventory } from './css-usage-inventory';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function identity(value: unknown): string {
  if (
    !record(value) ||
    !text(value['file']) ||
    !positiveInteger(value['line']) ||
    !positiveInteger(value['column']) ||
    !text(value['kind']) ||
    !text(value['expression']) ||
    !(value['property'] === null || text(value['property']))
  )
    throw new Error('CSS usage review has an invalid dynamic identity');
  return JSON.stringify([
    value['file'],
    value['line'],
    value['column'],
    value['kind'],
    value['property'],
    value['expression'],
  ]);
}
function location(value: Pick<DynamicRecord, 'file' | 'line' | 'column'>): string {
  return JSON.stringify([value['file'], value['line'], value['column']]);
}
const categories = new Set([
  'caller-controlled-style-color-input',
  'computed-style-color-input',
  'geometric-numeric-runtime-value',
  'shipped-public-token-mapping',
]);

/** Fail closed when a runtime style sink or a reviewed producer changes. */
export function observedUsageProperties(
  inventory: Inventory,
  review: unknown,
  publicProperties: ReadonlySet<string>,
): ReadonlyMap<string, readonly string[]> {
  if (
    !record(review) ||
    review['schemaVersion'] !== 1 ||
    !Array.isArray(review['surfaces']) ||
    !Array.isArray(review['sourceFiles']) ||
    !Array.isArray(review['producerEvidence'])
  )
    throw new Error('CSS usage review must contain version 1 surfaces and source evidence');
  const currentSources = new Map(
    inventory['sourceFiles'].map((source) => [source['path'], source['sha256']]),
  );
  const evidence = new Map<string, string>();
  for (const source of [...review['sourceFiles'], ...review['producerEvidence']]) {
    if (
      !record(source) ||
      !text(source['path']) ||
      typeof source['sha256'] !== 'string' ||
      !/^[a-f\d]{64}$/.test(source['sha256'])
    )
      throw new Error('CSS usage review has invalid source evidence');
    if (currentSources.get(source['path']) !== source['sha256'])
      throw new Error(
        `CSS usage review source changed: ${source['path']}; inspect its producer before updating the review`,
      );
    evidence.set(source['path'], source['sha256']);
  }
  const dynamic = new Map(inventory.dynamic.map((surface) => [identity(surface), surface]));
  if (dynamic.size !== inventory.dynamic.length)
    throw new Error('Duplicate dynamic CSS inventory identity');
  const reviewed = new Set<string>();
  const observed = new Map<string, Set<string>>();
  const add = (tokenProperty: string, property: string): void => {
    if (!publicProperties.has(tokenProperty))
      throw new Error(`Unknown public token binding: ${tokenProperty}`);
    if (!/^-?[a-z][a-z\d-]*$/.test(property))
      throw new Error(`Expected terminal CSS property, received ${property}`);
    const values = observed.get(tokenProperty) ?? new Set<string>();
    values.add(property);
    observed.set(tokenProperty, values);
  };
  for (const use of inventory.uses) add(use['tokenProperty'], use['property']);
  for (const surface of review['surfaces']) {
    if (!record(surface)) throw new Error('CSS usage review has an invalid surface');
    const key = identity(surface['identity']);
    const current = dynamic.get(key);
    if (!current) throw new Error(`Stale dynamic CSS review: ${key}`);
    if (reviewed.has(key)) throw new Error(`Duplicate dynamic CSS review: ${key}`);
    if (
      surface['reviewStatus'] !== 'reviewed' ||
      !text(surface['category']) ||
      !categories.has(surface['category']) ||
      !text(surface['reason'])
    )
      throw new Error(`Unreviewed dynamic CSS surface: ${key}`);
    if (!evidence.has(current['file']))
      throw new Error(`Missing CSS usage review source evidence: ${current['file']}`);
    const producer = surface['producer'];
    if (
      !record(producer) ||
      !text(producer['path']) ||
      !positiveInteger(producer['line']) ||
      !text(producer['description']) ||
      typeof producer['emitsPublicVar'] !== 'boolean' ||
      producer['status'] !== 'reviewed' ||
      !evidence.has(producer['path'])
    )
      throw new Error(`Missing reviewed CSS producer evidence: ${key}`);
    if (producer['chain'] !== undefined) {
      if (!Array.isArray(producer['chain'])) throw new Error(`Invalid CSS producer chain: ${key}`);
      for (const step of producer['chain'])
        if (
          !record(step) ||
          !text(step['path']) ||
          !positiveInteger(step['line']) ||
          !text(step['description']) ||
          !evidence.has(step['path'])
        )
          throw new Error(`Missing CSS producer chain evidence: ${key}`);
    }
    if (!Array.isArray(surface['mappings'])) throw new Error(`Invalid CSS usage mappings: ${key}`);
    const shipped = surface['category'] === 'shipped-public-token-mapping';
    if (shipped !== surface['mappings'].length > 0 || (shipped && !producer['emitsPublicVar']))
      throw new Error(`Contradictory CSS usage mapping classification: ${key}`);
    const mappingKeys = new Set<string>();
    for (const mapping of surface['mappings']) {
      if (!record(mapping) || !text(mapping['tokenProperty']) || !text(mapping['property']))
        throw new Error(`Invalid CSS usage mapping: ${key}`);
      const mappingKey = JSON.stringify([mapping['tokenProperty'], mapping['property']]);
      if (mappingKeys.has(mappingKey)) throw new Error(`Duplicate CSS usage mapping: ${key}`);
      mappingKeys.add(mappingKey);
      add(mapping['tokenProperty'], mapping['property']);
    }
    reviewed.add(key);
  }
  for (const [key] of dynamic)
    if (!reviewed.has(key)) throw new Error(`Missing dynamic CSS review: ${key}`);
  const accountedLocations = new Set(inventory.dynamic.map(location));
  for (const diagnostic of inventory.diagnostics)
    if (
      diagnostic['kind'] !== 'unsupported-surface' ||
      !accountedLocations.has(location(diagnostic))
    )
      throw new Error(
        `Unaccounted CSS inventory diagnostic: ${diagnostic['file']}:${diagnostic['line']}:${diagnostic['column']}: ${diagnostic['reason']}`,
      );
  return new Map(
    [...observed]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([property, values]) => [property, [...values].sort()]),
  );
}
