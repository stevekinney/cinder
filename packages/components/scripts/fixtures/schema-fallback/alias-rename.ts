/**
 * Fixture: HTML attributes accessed through a renamed type alias.
 *
 * The filter must trace through the alias and still recognise the
 * inherited surface as svelte/elements-declared.
 */
import type { HTMLInputAttributes } from 'svelte/elements';

type RenamedInputAttributes = HTMLInputAttributes;

export type AliasRenameProps = RenamedInputAttributes & {
  /** Cinder-specific tone. */
  tone?: 'neutral' | 'accent';
};
