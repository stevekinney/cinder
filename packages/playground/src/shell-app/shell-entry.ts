/**
 * Entry point for the playground shell SPA bundle.
 *
 * Adds the small progressive enhancements the server-rendered landing page
 * needs. The full Svelte shell is intentionally not hydrated here: its
 * documentation and editor graph belongs behind reader interaction, not in the
 * first landing-page transfer.
 */

import { applyTheme, NAV_FILTER_STORAGE_KEY, readInitialTheme } from '../component-page-theme.ts';
import {
  applyColorTokenOverridesToDocument,
  readSessionColorTokenOverrides,
} from './color-token-overrides.ts';
import { persistScrollPosition } from './sidebar-scroll.ts';

applyColorTokenOverridesToDocument(document, readSessionColorTokenOverrides()[readInitialTheme()]);

const themeToggle = document.querySelector<HTMLButtonElement>(
  'button[aria-label^="Preview theme:"]',
);

function labelForTheme(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? 'Preview theme: switch to light' : 'Preview theme: switch to dark';
}

if (themeToggle !== null) {
  themeToggle.addEventListener('click', () => {
    const nextTheme = readInitialTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    applyColorTokenOverridesToDocument(document, readSessionColorTokenOverrides()[nextTheme]);
    themeToggle.setAttribute('aria-label', labelForTheme(nextTheme));
    void hydrateShell().catch((error) =>
      console.error('[cinder playground] failed to hydrate landing shell:', error),
    );
  });
}

let shellHydration: Promise<void> | undefined;
let shellHydrated = false;

function hydrateShell(): Promise<void> {
  shellHydration ??= Promise.all([
    import('svelte'),
    import('./shell-initial-data.ts'),
    import('./shell.svelte'),
  ]).then(([svelte, initialDataModule, shellModule]) => {
    const target = document.getElementById('shell-root');
    if (target === null) throw new Error('[cinder playground] #shell-root target not found');

    const node = document.getElementById('cinder-initial');
    let rawInitialData: unknown = {};
    try {
      rawInitialData = node === null ? {} : JSON.parse(node.textContent ?? '{}');
    } catch (error) {
      console.error('[cinder playground] failed to parse #cinder-initial:', error);
    }
    let initial = initialDataModule.parseInitialData(rawInitialData);
    if (initial === null) {
      initial = {
        component: '',
        components: [],
        readmeHtml: '',
        documentation: null,
        initialSearch: '',
      };
    }
    svelte.hydrate(shellModule.default, {
      target,
      props: {
        components: initial.components,
        readmeHtml: initial.readmeHtml,
      },
    });
    shellHydrated = true;
  });
  return shellHydration;
}

// Static SSR always renders the light-state icon to avoid hydration mismatch.
// A persisted dark theme needs the interactive control immediately so its icon
// and accessible label match the pre-paint theme before the first click.
if (themeToggle !== null && readInitialTheme() === 'dark') {
  void hydrateShell().catch((error) =>
    console.error('[cinder playground] failed to synchronize landing theme:', error),
  );
}

/**
 * Make a server-rendered toolbar button work before the shell is hydrated.
 *
 * The landing shell stays un-hydrated until the reader asks for something, so a
 * toolbar button rendered by SSR has no Svelte handler behind it yet — the first
 * click would land on inert markup and appear to do nothing. Each such button
 * needs its own bootstrap: hydrate, then replay the click into the now-live
 * component.
 *
 * Every panel trigger in the toolbar needs this, so it is a function rather than
 * a block per button — adding a trigger without its bootstrap produces a button
 * that silently does nothing until some OTHER control happens to hydrate the
 * shell first, which is a genuinely confusing failure to debug.
 */
function bootstrapDeferredToggle(testId: string): void {
  const toggle = document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);

  toggle?.addEventListener(
    'click',
    (event) => {
      // Once Svelte has taken over the existing button, its own handler receives
      // this trusted click. Replaying would immediately toggle the panel closed.
      if (shellHydrated) return;
      event.preventDefault();
      void hydrateShell()
        .then(() => toggle.click())
        .catch((error) =>
          console.error('[cinder playground] failed to hydrate landing shell:', error),
        );
    },
    { once: true },
  );
}

bootstrapDeferredToggle('color-token-panel-toggle');
bootstrapDeferredToggle('token-inspector-toggle');

const sidebarNavigation = document.querySelector<HTMLElement>('nav.dx-nav');
if (sidebarNavigation !== null) persistScrollPosition(sidebarNavigation);

const sidebarFilter = document.getElementById('sidebar-filter');
if (sidebarFilter instanceof HTMLInputElement) {
  let latestFilterValue = '';
  try {
    latestFilterValue = sessionStorage.getItem(NAV_FILTER_STORAGE_KEY) ?? '';
    sidebarFilter.value = latestFilterValue;
  } catch {
    // Private mode or disabled storage: filtering still works for this page.
  }
  const persistAndHydrateFilter = () => {
    latestFilterValue = sidebarFilter.value;
    try {
      sessionStorage.setItem(NAV_FILTER_STORAGE_KEY, latestFilterValue);
    } catch {
      // Private mode or disabled storage: keep the current input value.
    }
    void hydrateShell()
      .then(() => {
        sidebarFilter.removeEventListener('input', persistAndHydrateFilter);
        const hydratedFilter = document.getElementById('sidebar-filter');
        if (!(hydratedFilter instanceof HTMLInputElement)) return;
        hydratedFilter.value = latestFilterValue;
        hydratedFilter.dispatchEvent(new Event('input', { bubbles: true }));
      })
      .catch((error) =>
        console.error('[cinder playground] failed to hydrate landing shell:', error),
      );
  };
  sidebarFilter.addEventListener('input', persistAndHydrateFilter);

  if (latestFilterValue !== '') {
    void hydrateShell().catch((error) =>
      console.error('[cinder playground] failed to restore landing filter:', error),
    );
  }
}
