import { createRawSnippet } from 'svelte';

export function markupSnippet(markup: string) {
  return createRawSnippet(() => ({
    render: () => markup,
  }));
}

type ClipboardLike = { writeText: (text: string) => Promise<void> };

export function setNavigatorClipboard(clipboard: ClipboardLike): void {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  });
}

export function restoreNavigatorClipboard(originalClipboard: unknown): void {
  if (originalClipboard === undefined) {
    Reflect.deleteProperty(globalThis.navigator, 'clipboard');
    return;
  }
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  });
}
