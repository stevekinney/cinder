import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, beforeEach } from 'bun:test';

export function setupClipboardTests(): void {
  setupHappyDom();
  let originalClipboard: Clipboard | undefined;
  let originalExecCommand: PropertyDescriptor | undefined;
  let originalAppendChild: PropertyDescriptor | undefined;

  beforeEach(() => {
    document.body.replaceChildren();
    originalClipboard = globalThis.navigator.clipboard;
    originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
    originalAppendChild = Object.getOwnPropertyDescriptor(document.body, 'appendChild');
  });

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    } else {
      Reflect.deleteProperty(globalThis.navigator, 'clipboard');
    }
    if (originalExecCommand) Object.defineProperty(document, 'execCommand', originalExecCommand);
    else Reflect.deleteProperty(document, 'execCommand');
    if (originalAppendChild)
      Object.defineProperty(document.body, 'appendChild', originalAppendChild);
    else Reflect.deleteProperty(document.body, 'appendChild');
    document.body.replaceChildren();
  });
}
