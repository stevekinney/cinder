import { hydrate, unmount, type Component } from 'svelte';

import { setupHappyDom } from './happy-dom.ts';
import { renderSvelteOnServer } from './svelte-server.ts';

type HydrateResult = {
  ssrHtml: string;
  warnings: string[];
  container: HTMLElement;
  cleanup: () => Promise<void>;
};

/** Render in a fresh server process, then hydrate with the real client runtime. */
export async function renderThenHydrate<Props extends Record<string, unknown>>(
  component: Component<Props>,
  sourcePath: string,
  props: Props,
  serverProps: Record<string, unknown> = props,
): Promise<HydrateResult> {
  const ssrHtml = await renderSvelteOnServer(sourcePath, serverProps);
  setupHappyDom();
  const container = document.createElement('div');
  container.innerHTML = ssrHtml;
  document.body.appendChild(container);
  const warnings: string[] = [];
  const warningDescriptor = Object.getOwnPropertyDescriptor(console, 'warn');
  if (!warningDescriptor) throw new Error('Missing console warning method');
  Object.defineProperty(console, 'warn', {
    ...warningDescriptor,
    value: (...arguments_: unknown[]) => warnings.push(arguments_.map(String).join(' ')),
  });
  try {
    const instance = hydrate(component, { target: container, props });
    return {
      ssrHtml,
      warnings,
      container,
      cleanup: async () => {
        await unmount(instance, { outro: false });
        container.remove();
      },
    };
  } catch (error) {
    container.remove();
    throw error;
  } finally {
    Object.defineProperty(console, 'warn', warningDescriptor);
  }
}
