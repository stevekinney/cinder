import type {
  ComponentDocumentationPayload,
  DocumentationComponentSummary,
  DocumentationReadme,
  JsonValue,
} from './component-documentation-types.ts';
import { isComponentManifest } from './manifest-reference.ts';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readProperty(value: object, key: string): unknown {
  return Reflect.get(value, key);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isObject(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isArtifactSpecifiers(value: unknown): value is DocumentationComponentSummary['artifacts'] {
  if (!isObject(value)) return false;
  const constraints = readProperty(value, 'constraints');
  const examples = readProperty(value, 'examples');
  return (
    typeof readProperty(value, 'schema') === 'string' &&
    typeof readProperty(value, 'variables') === 'string' &&
    (constraints === undefined || typeof constraints === 'string') &&
    (examples === undefined || typeof examples === 'string')
  );
}

function isDocumentationComponentSummary(value: unknown): value is DocumentationComponentSummary {
  if (!isObject(value)) return false;
  return (
    typeof readProperty(value, 'id') === 'string' &&
    typeof readProperty(value, 'name') === 'string' &&
    typeof readProperty(value, 'importSpecifier') === 'string' &&
    typeof readProperty(value, 'exportName') === 'string' &&
    typeof readProperty(value, 'category') === 'string' &&
    typeof readProperty(value, 'categoryLabel') === 'string' &&
    typeof readProperty(value, 'categoryDescription') === 'string' &&
    typeof readProperty(value, 'status') === 'string' &&
    typeof readProperty(value, 'statusDescription') === 'string' &&
    typeof readProperty(value, 'purpose') === 'string' &&
    isStringArray(readProperty(value, 'tags')) &&
    isStringArray(readProperty(value, 'useWhen')) &&
    isStringArray(readProperty(value, 'avoidWhen')) &&
    isStringArray(readProperty(value, 'related')) &&
    typeof readProperty(value, 'hasConstraints') === 'boolean' &&
    typeof readProperty(value, 'hasExamples') === 'boolean' &&
    isArtifactSpecifiers(readProperty(value, 'artifacts'))
  );
}

function isDocumentationReadme(value: unknown): value is DocumentationReadme {
  if (!isObject(value)) return false;
  const codeBlocks = readProperty(value, 'codeBlocks');
  return (
    typeof readProperty(value, 'rawMarkdown') === 'string' &&
    typeof readProperty(value, 'html') === 'string' &&
    typeof readProperty(value, 'hadUnsafeContent') === 'boolean' &&
    Array.isArray(codeBlocks) &&
    codeBlocks.every(
      (block) =>
        isObject(block) &&
        (readProperty(block, 'language') === null ||
          typeof readProperty(block, 'language') === 'string') &&
        (readProperty(block, 'meta') === null || typeof readProperty(block, 'meta') === 'string') &&
        typeof readProperty(block, 'value') === 'string' &&
        typeof readProperty(block, 'index') === 'number',
    )
  );
}

function isRawArtifacts(value: unknown): value is ComponentDocumentationPayload['rawArtifacts'] {
  if (!isObject(value)) return false;
  return (
    isJsonValue(readProperty(value, 'manifestEntry')) &&
    isJsonValue(readProperty(value, 'schema')) &&
    isJsonValue(readProperty(value, 'variables')) &&
    (readProperty(value, 'constraints') === null ||
      isJsonValue(readProperty(value, 'constraints'))) &&
    (readProperty(value, 'examples') === null || isJsonValue(readProperty(value, 'examples')))
  );
}

export function isComponentDocumentationPayload(
  value: unknown,
): value is ComponentDocumentationPayload {
  if (!isObject(value)) return false;
  return (
    isDocumentationComponentSummary(readProperty(value, 'component')) &&
    isDocumentationReadme(readProperty(value, 'readme')) &&
    isComponentManifest(readProperty(value, 'propsManifest')) &&
    isJsonValue(readProperty(value, 'schema')) &&
    isJsonValue(readProperty(value, 'variables')) &&
    (readProperty(value, 'constraints') === null ||
      isJsonValue(readProperty(value, 'constraints'))) &&
    (readProperty(value, 'examples') === null || isJsonValue(readProperty(value, 'examples'))) &&
    isRawArtifacts(readProperty(value, 'rawArtifacts'))
  );
}

export function variablesList(value: JsonValue): string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : [];
}

export function schemaPropertyNames(schema: JsonValue): string[] {
  if (!isObject(schema)) return [];
  const properties = schema['properties'];
  if (!isObject(properties)) return [];
  const propertyNames = Object.keys(properties);
  propertyNames.sort((a, b) => a.localeCompare(b));
  return propertyNames;
}

export function schemaRequiredPropertyNames(schema: JsonValue): string[] {
  if (!isObject(schema)) return [];
  const required = schema['required'];
  return isStringArray(required) ? required : [];
}

export function validateComponentDocumentationPayload(
  payload: ComponentDocumentationPayload,
): string[] {
  const errors: string[] = [];
  if (payload.component.purpose.trim() === '') {
    errors.push(`${payload.component.id} is missing a manifest purpose`);
  }
  if (payload.readme.html.trim() === '') {
    errors.push(`${payload.component.id} README rendered to empty HTML`);
  }
  if (payload.readme.hadUnsafeContent) {
    errors.push(`${payload.component.id} README rendering stripped unsafe content`);
  }
  if (!isObject(payload.schema)) {
    errors.push(`${payload.component.id} schema artifact is not an object`);
  }
  if (payload.rawArtifacts.manifestEntry === null) {
    errors.push(`${payload.component.id} raw manifest artifact is missing`);
  }
  if (payload.rawArtifacts.schema === null) {
    errors.push(`${payload.component.id} raw schema artifact is missing`);
  }
  if (payload.rawArtifacts.variables === null) {
    errors.push(`${payload.component.id} raw variables artifact is missing`);
  }
  if (payload.component.hasConstraints && payload.constraints === null) {
    errors.push(`${payload.component.id} manifest says constraints exist but payload has none`);
  }
  if (payload.component.hasExamples && payload.examples === null) {
    errors.push(`${payload.component.id} manifest says examples exist but payload has none`);
  }
  return errors;
}

type DocumentationResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
};

export type DocumentationFetch = (url: string) => Promise<DocumentationResponse>;

export async function fetchComponentDocumentation(
  componentName: string,
  fetchImpl: DocumentationFetch = fetch,
): Promise<ComponentDocumentationPayload> {
  const response = await fetchImpl(`/api/documentation/${encodeURIComponent(componentName)}`);
  if (!response.ok) {
    throw new Error(`Documentation request failed: ${response.status} ${response.statusText}`);
  }
  const body: unknown = await response.json();
  if (!isComponentDocumentationPayload(body)) {
    throw new Error('Documentation response was not a valid ComponentDocumentationPayload');
  }
  return body;
}
