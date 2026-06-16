/**
 * Shared SSR-safety test helper.
 *
 * Imports a list of module specifiers with the realm's DOM globals
 * (`document`/`window`) removed, then restores them. Returns the first
 * "not defined" error message a module throws on evaluation, or `undefined` if
 * every specifier imported cleanly — a clean import under nulled globals is the
 * SSR-safety proof (a module-level `document`/`window` access would surface here
 * as a throw instead of `undefined`).
 *
 * Each specifier is cache-busted with a unique query string so Bun re-evaluates
 * the module body under the nulled globals instead of serving a previously
 * cached instance (which would have been evaluated with the globals live).
 */
export async function importWithoutDomGlobals(specifiers: string[]): Promise<string | undefined> {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'document');
  Reflect.deleteProperty(globalThis, 'window');

  try {
    for (const specifier of specifiers) {
      const cacheBusted = `${specifier}${specifier.includes('?') ? '&' : '?'}ssr-eval=${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try {
        await import(cacheBusted);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    }
    return undefined;
  } finally {
    if (documentDescriptor) {
      Object.defineProperty(globalThis, 'document', documentDescriptor);
    }
    if (windowDescriptor) {
      Object.defineProperty(globalThis, 'window', windowDescriptor);
    }
  }
}
