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
  });
  return shellHydration;
}

const colorPanelToggle = document.querySelector<HTMLButtonElement>(
  '[data-testid="color-token-panel-toggle"]',
);

colorPanelToggle?.addEventListener(
  'click',
  (event) => {
    event.preventDefault();
    void hydrateShell()
      .then(() => colorPanelToggle.click())
      .catch((error) =>
        console.error('[cinder playground] failed to hydrate landing shell:', error),
      );
  },
  { once: true },
);

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
