import { plugin } from 'bun';

import { sveltePlugin } from '../packages/components/scripts/svelte-plugin.ts';

await plugin(sveltePlugin({ generate: 'server' }));

const componentImports = {
  chat: () => import('../packages/components/src/components/chat.svelte'),
  'diff-statistics': () => import('../packages/components/src/components/diff-statistics.svelte'),
  'diff-viewer': () => import('../packages/components/src/components/diff-viewer.svelte'),
  'markdown-editor': () => import('../packages/components/src/components/markdown-editor.svelte'),
  'review-editor': () => import('../packages/components/src/components/review-editor.svelte'),
  'segmented-control': () => import('../packages/components/src/components/segmented-control.svelte'),
  'selection-popover': () => import('../packages/components/src/components/selection-popover.svelte'),
  surface: () => import('../packages/components/src/components/surface.svelte'),
  'view-switcher': () => import('../packages/components/src/components/view-switcher.svelte'),
} as const;

for (const [componentName, importComponent] of Object.entries(componentImports)) {
  const componentModule = await importComponent();
  if (typeof componentModule.default !== 'function') {
    throw new Error(`${componentName} did not export a Svelte component.`);
  }
}

console.log('SSR fixture imported all domain-suite components.');
