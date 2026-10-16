import type { ResolverDocument, TokenDocument, ValidationIssue } from './types.ts';
import { TokenValidationError } from './types.ts';
import { validateResolverDocument } from './validate-resolver.ts';
import { validateResolverDocumentSchema, validateTokenDocumentSchema } from './validate-schema.ts';
import { validateTokenDocument } from './validate-tokens.ts';
import { addIssue, isObject } from './validate-values.ts';

export function assertValidTokenDocument(
  document: unknown,
  source?: string,
  lookupDocuments: readonly unknown[] = [],
  sourceByDocument?: ReadonlyMap<object, string>,
): asserts document is TokenDocument {
  const issues: ValidationIssue[] = [];
  if (!isObject(document)) addIssue(issues, source ?? '$', 'document must be an object');
  if (issues.length > 0) throw new TokenValidationError(issues);
  // First-pass gate: the official DTCG 2025.10 format JSON Schema catches shape
  // violations structurally, before the semantic checks below run. See
  // validate-schema.ts for why this precedes (rather than replaces) validateTokenDocument.
  const projected = validateTokenDocumentSchema(
    document,
    source ?? '$',
    lookupDocuments,
    sourceByDocument,
  );
  validateTokenDocument(projected, source);
}

export function assertValidResolverDocument(
  document: unknown,
): asserts document is ResolverDocument {
  if (!isObject(document))
    throw new TokenValidationError([{ path: '$', reason: 'resolver must be an object' }]);
  // First-pass gate: the official DTCG 2025.10 resolver JSON Schema catches
  // shape violations structurally, before the semantic checks below run
  // (see validate-schema.ts for why validateResolverDocumentSchema exists
  // as a separate, explicitly-called step rather than being folded in here).
  validateResolverDocumentSchema(document);
  if (
    document['version'] !== '2025.10' ||
    !isObject(document['sets']) ||
    !isObject(document['modifiers']) ||
    !Array.isArray(document['resolutionOrder'])
  )
    throw new TokenValidationError([
      {
        path: '$',
        reason: 'resolver must contain version, sets, modifiers, and resolutionOrder',
      },
    ]);
  validateResolverDocument({
    version: document['version'],
    sets: document['sets'],
    modifiers: document['modifiers'],
    resolutionOrder: document['resolutionOrder'],
  });
}
