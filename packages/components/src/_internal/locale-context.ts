import { createContext } from 'svelte';

import { optionalContext } from './optional-context.ts';

export type TextDirection = 'ltr' | 'rtl';

export type LocaleContext = {
  /** BCP 47 locale tag used by locale-aware components when no local prop is set. */
  readonly locale: string | undefined;
  /** Text direction for components that need direction-aware behavior. */
  readonly direction: TextDirection | undefined;
};

const [getLocaleContextStrict, setLocaleContextRaw] = createContext<LocaleContext>();

export function setLocaleContext(context: LocaleContext): void {
  setLocaleContextRaw(context);
}

export const getLocaleContext: () => LocaleContext | undefined =
  optionalContext(getLocaleContextStrict);
