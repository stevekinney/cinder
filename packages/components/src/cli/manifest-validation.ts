import {
  CinderKnowledgeError,
  type AvoidWhen,
  type CinderManifest,
  type ManifestComponent,
} from './types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAvoidWhenArray(value: unknown): value is AvoidWhen[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item['reason'] === 'string' &&
        (item['alternative'] === undefined || typeof item['alternative'] === 'string'),
    )
  );
}

function isPackageMetadata(value: unknown): value is CinderManifest['package'] {
  return (
    isRecord(value) &&
    typeof value['name'] === 'string' &&
    typeof value['version'] === 'string' &&
    typeof value['framework'] === 'string' &&
    typeof value['frameworkVersionRange'] === 'string' &&
    typeof value['stylesEntry'] === 'string' &&
    typeof value['schemaDialect'] === 'string'
  );
}

function isCategoryMap(value: unknown): value is CinderManifest['categories'] {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (category) =>
        isRecord(category) &&
        typeof category['label'] === 'string' &&
        typeof category['description'] === 'string',
    )
  );
}

function isStatusLevelMap(value: unknown): value is CinderManifest['statusLevels'] {
  return isRecord(value) && Object.values(value).every((status) => typeof status === 'string');
}

function isOverlapFamilyMap(value: unknown): value is CinderManifest['overlapFamilies'] {
  return isRecord(value) && Object.values(value).every(isStringArray);
}

function isManifestComponent(value: unknown): value is ManifestComponent {
  if (!isRecord(value)) return false;
  const artifacts = value['artifacts'];
  return (
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    typeof value['import'] === 'string' &&
    typeof value['exportName'] === 'string' &&
    typeof value['category'] === 'string' &&
    typeof value['status'] === 'string' &&
    typeof value['purpose'] === 'string' &&
    isStringArray(value['tags']) &&
    isStringArray(value['useWhen']) &&
    isAvoidWhenArray(value['avoidWhen']) &&
    isStringArray(value['related']) &&
    typeof value['hasConstraints'] === 'boolean' &&
    typeof value['hasExamples'] === 'boolean' &&
    isRecord(artifacts) &&
    typeof artifacts['schema'] === 'string' &&
    typeof artifacts['variables'] === 'string' &&
    (artifacts['examples'] === undefined || typeof artifacts['examples'] === 'string') &&
    (artifacts['constraints'] === undefined || typeof artifacts['constraints'] === 'string')
  );
}

export function validateManifest(value: unknown): CinderManifest {
  if (!isRecord(value)) {
    throw new CinderKnowledgeError('INVALID_MANIFEST', 'components.json must be an object.');
  }
  const manifestVersion = value['manifestVersion'];
  const packageValue = value['package'];
  const components = value['components'];
  const categories = value['categories'];
  const statusLevels = value['statusLevels'];
  const overlapFamilies = value['overlapFamilies'];
  if (manifestVersion !== 1) {
    throw new CinderKnowledgeError(
      'INVALID_MANIFEST',
      'components.json must use manifestVersion 1.',
    );
  }
  if (!isPackageMetadata(packageValue) || !Array.isArray(components)) {
    throw new CinderKnowledgeError(
      'INVALID_MANIFEST',
      'components.json is missing package metadata or components.',
    );
  }
  if (
    !isCategoryMap(categories) ||
    !isStatusLevelMap(statusLevels) ||
    !isOverlapFamilyMap(overlapFamilies)
  ) {
    throw new CinderKnowledgeError(
      'INVALID_MANIFEST',
      'components.json is missing category, status, or overlap metadata.',
    );
  }

  const manifestComponents = components.map((component) => {
    if (!isManifestComponent(component)) {
      throw new CinderKnowledgeError(
        'INVALID_MANIFEST',
        'Every manifest component must include the generated component contract fields.',
      );
    }
    return component;
  });

  return {
    manifestVersion,
    package: packageValue,
    categories,
    statusLevels,
    overlapFamilies,
    components: manifestComponents,
  };
}
