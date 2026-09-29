/**
 * ProseMirror state that holds the active placeholder configuration.
 *
 * Configuration changes travel as plugin metadata on a transaction with no
 * steps and `addToHistory: false`, so replacing definitions never touches the
 * document, undo history, selection or content callbacks, and never recreates
 * the editor.
 */

import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';

import { createLazyProsePlugin, type LazyProsePlugin } from './milkdown-plugin-runtime.js';
import type { ResolvedPlaceholderConfiguration } from './template-placeholder-configuration.js';
import { UNCONFIGURED_PLACEHOLDERS } from './template-placeholder-configuration.js';

export const templatePlaceholderConfigurationPluginKey =
  new PluginKey<ResolvedPlaceholderConfiguration>('template-placeholder-configuration');

type ConfigurationMeta = { readonly configuration: ResolvedPlaceholderConfiguration };

function isConfigurationMeta(value: unknown): value is ConfigurationMeta {
  return typeof value === 'object' && value !== null && 'configuration' in value;
}

function readMeta(transaction: Transaction): ResolvedPlaceholderConfiguration | undefined {
  const meta: unknown = transaction.getMeta(templatePlaceholderConfigurationPluginKey);
  return isConfigurationMeta(meta) ? meta.configuration : undefined;
}

/** The configuration a transaction installs, if it installs one. */
export function placeholderConfigurationChange(
  transaction: Transaction,
): ResolvedPlaceholderConfiguration | undefined {
  return readMeta(transaction);
}

/** The configuration active in an editor state. */
export function readPlaceholderConfiguration(state: EditorState): ResolvedPlaceholderConfiguration {
  return templatePlaceholderConfigurationPluginKey.getState(state) ?? UNCONFIGURED_PLACEHOLDERS;
}

/**
 * The configuration in effect after `transaction`, read without depending on
 * plugin order: a newly installed configuration wins, otherwise the one that
 * was active before the transaction.
 */
export function configurationAfter(
  transaction: Transaction,
  previousState: EditorState,
): ResolvedPlaceholderConfiguration {
  return readMeta(transaction) ?? readPlaceholderConfiguration(previousState);
}

/** Build the metadata-only transaction that installs `configuration`. */
export function createPlaceholderConfigurationTransaction(
  state: EditorState,
  configuration: ResolvedPlaceholderConfiguration,
): Transaction {
  return state.tr
    .setMeta(templatePlaceholderConfigurationPluginKey, {
      configuration,
    } satisfies ConfigurationMeta)
    .setMeta('addToHistory', false);
}

/** Create the plugin that stores the configuration, starting from `initial`. */
export function createTemplatePlaceholderConfigurationPlugin(
  initial: ResolvedPlaceholderConfiguration,
): LazyProsePlugin {
  return createLazyProsePlugin(
    () =>
      new Plugin<ResolvedPlaceholderConfiguration>({
        key: templatePlaceholderConfigurationPluginKey,
        state: {
          init: () => initial,
          apply: (transaction, previous) => readMeta(transaction) ?? previous,
        },
      }),
  );
}
