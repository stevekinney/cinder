import { format } from 'prettier';
import {
  RESOLVED_CONTEXT_COMBOS,
  documentsForResolutionOrder,
  modifierValuesForCombo,
} from '../../src/tokens/runtime/context-order.ts';
import { cinderExtensions } from '../../src/tokens/runtime/corpus.ts';
import { resolveDocuments } from '../../src/tokens/runtime/resolve.ts';
import type { ResolverDocument, TokenDocument } from '../../src/tokens/runtime/types.ts';
import { assertPrettierResolvesToRoot } from '../lib/prettier-resolution.ts';
import { JSON_PLUGINS, PRETTIER_OPTIONS } from './generator-configuration.ts';

export async function buildResolvedContexts(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
): Promise<Map<string, string>> {
  const themeModifier = resolver.modifiers['theme']!;
  const motionModifier = resolver.modifiers['motion']!;

  const outputs = new Map<string, string>();
  for (const combo of RESOLVED_CONTEXT_COMBOS) {
    const themeContext = themeModifier.contexts[combo.theme];
    const motionContext = motionModifier.contexts[combo.motion];
    if (!themeContext || !motionContext) {
      throw new Error(
        `Resolver has no "${combo.theme}"/"${combo.motion}" context for "${combo.name}".`,
      );
    }
    const modifierValues = modifierValuesForCombo(resolver, combo);
    const documents = documentsForResolutionOrder(resolver, documentsByPath, modifierValues);
    const resolved = resolveDocuments(documents);
    // A token whose `$value` cannot honestly represent its real CSS value in
    // DTCG's type system (e.g. `auto`, a bare `16 / 9` ratio, `currentColor`)
    // carries `nonRepresentableValue` in its extension data -- `cssRecipe`
    // governs its real CSS emission (tokens-base.css) and registry coverage
    // (registry.generated.json, which never publishes a raw `$value`), but a
    // generic DTCG consumer of THESE resolved-context JSON files has no way
    // to know `$value` here is a placeholder rather than the real resolved
    // value, and applying it literally actively breaks (e.g. `0rem` collapses
    // a block that should size to its content). Omit these paths from the
    // published resolved-context artifacts entirely rather than publish a
    // value known to be wrong.
    for (const path of Object.keys(resolved)) {
      if (cinderExtensions(resolved[path]!)?.['nonRepresentableValue'] === true) {
        delete resolved[path];
      }
    }
    assertPrettierResolvesToRoot();
    const json = await format(JSON.stringify(resolved), {
      ...PRETTIER_OPTIONS,
      parser: 'json',
      plugins: JSON_PLUGINS,
    });
    outputs.set(combo.name, json);
  }
  return outputs;
}

// ---------------------------------------------------------------------------
