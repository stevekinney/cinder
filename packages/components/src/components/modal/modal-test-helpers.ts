import { createRawSnippet } from 'svelte';

export function installModalDialogStubs(): void {
  if (typeof HTMLDialogElement === 'undefined') return;
  if (!HTMLDialogElement.prototype.showModal) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: function () {
        this.setAttribute('open', '');
      },
      configurable: true,
      writable: true,
    });
  }
  if (!HTMLDialogElement.prototype.close) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      value: function () {
        this.removeAttribute('open');
      },
      configurable: true,
      writable: true,
    });
  }
}

export function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

export const emptySnippet = createRawSnippet(() => ({
  render: () => '<span></span>',
  setup: () => {},
}));

const { fireEvent } = await import('@testing-library/svelte');

export async function fireNativeClose(dialog: HTMLDialogElement): Promise<void> {
  dialog.close();
  await fireEvent(dialog, new Event('close'));
}
