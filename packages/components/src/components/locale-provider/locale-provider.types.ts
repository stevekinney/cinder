import type { Snippet } from 'svelte';

import type { TextDirection } from '../../_internal/locale-context.ts';

export type { TextDirection } from '../../_internal/locale-context.ts';

export type LocaleProviderProps = {
  /** BCP 47 locale tag used as the default for locale-aware descendants. */
  locale?: string;
  /** Text direction exposed to direction-aware descendants. */
  direction?: TextDirection | undefined;
  /** Descendant content that should inherit the locale context. */
  children?: Snippet;
};

export interface LocaleProviderSchemaProps {
  /** BCP 47 locale tag used as the default for locale-aware descendants. */
  locale?: string;
  /** Text direction exposed to direction-aware descendants. */
  direction?: TextDirection | undefined;
}
