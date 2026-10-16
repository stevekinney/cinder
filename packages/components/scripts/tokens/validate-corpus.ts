/**
 * The `tokens:check` corpus gate: loads the token documents and the resolver
 * from disk and validates them with the runtime's in-memory validator.
 */

import { validateCorpus } from '../../src/tokens/runtime/corpus-documents.ts';
import { loadRawTokenDocuments, loadResolverDocument } from './load.ts';

async function main(): Promise<void> {
  const resolver = await loadResolverDocument();
  const loaded = await loadRawTokenDocuments();
  validateCorpus(resolver, loaded);
}

if (import.meta.main) await main();
