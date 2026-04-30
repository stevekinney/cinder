import { Window } from 'happy-dom';

type Global = typeof globalThis & Record<string, unknown>;

let installed = false;

export function setupHappyDom(): void {
  if (installed) return;

  const happyWindow = new Window();
  const target = globalThis as Global;

  for (const key of Object.getOwnPropertyNames(happyWindow)) {
    if (key in target) continue;

    const descriptor = Object.getOwnPropertyDescriptor(happyWindow, key);
    if (!descriptor) continue;

    Object.defineProperty(target, key, descriptor);
  }

  Object.defineProperty(target, 'window', { value: happyWindow, configurable: true });
  installed = true;
}

setupHappyDom();
