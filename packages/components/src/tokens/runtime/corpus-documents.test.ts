import { describe, expect, test } from 'bun:test';

import {
  cloneCorpus,
  loadProfileCorpus,
  readFixture,
} from '../../../scripts/tokens/authoring-test-support.ts';
import { validateCorpus, validateLoadedTokenDocuments } from './corpus-documents.ts';
import { TokenValidationError } from './types.ts';

describe('validateLoadedTokenDocuments', () => {
  test('refuses two loaded documents that share a path', () => {
    const { resolver } = loadProfileCorpus();
    const document = readFixture('profile-base.tokens.json');
    const run = () =>
      validateLoadedTokenDocuments(resolver, [
        { path: 'profile-base.tokens.json', document },
        { path: 'profile-base.tokens.json', document },
      ]);
    expect(run).toThrow(TokenValidationError);
    expect(run).toThrow('duplicate loaded token document path after normalization');
  });

  test('keeps validating after it has forgotten the oldest remembered stacks', () => {
    // Each fresh clone mints its own document identities, so these rounds outgrow the
    // remembered-stack bound and evict from the oldest end without losing a verdict.
    for (let round = 0; round < 24; round++) {
      const { resolver, documentsByPath } = cloneCorpus(loadProfileCorpus());
      // A modifier may only override base tokens; the unbound imported token is traced elsewhere.
      delete (documentsByPath.get('profile-light.tokens.json') as Record<string, unknown>)[
        'imported'
      ];
      const validated = validateCorpus(
        resolver,
        [...documentsByPath].map(([path, document]) => ({ path, document })),
      );
      expect(validated.size).toBe(6);
    }
  });
});
