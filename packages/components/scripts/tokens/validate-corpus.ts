import { loadResolverDocument, loadTokenDocuments } from './load.ts';
import { validateResolverDocument, validateTokenDocument } from './validate.ts';

async function main(): Promise<void> {
  const [resolver, documents] = await Promise.all([loadResolverDocument(), loadTokenDocuments()]);
  validateResolverDocument(resolver);
  for (const { path, document } of documents) validateTokenDocument(document, path);
}

await main();
