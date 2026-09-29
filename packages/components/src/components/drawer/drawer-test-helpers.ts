import { createRawSnippet } from 'svelte';

export function installDrawerDialogStubs(): void {
  if (typeof HTMLDialogElement === 'undefined') return;
  if (!HTMLDialogElement.prototype.showModal) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: function () {
        Object.defineProperty(this, 'open', { value: true, configurable: true, writable: true });
        this.setAttribute('open', '');
      },
      configurable: true,
      writable: true,
    });
  }
  if (!HTMLDialogElement.prototype.close) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      value: function () {
        Object.defineProperty(this, 'open', { value: false, configurable: true, writable: true });
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      },
      configurable: true,
      writable: true,
    });
  }
}

export const emptySnippet = createRawSnippet(() => ({
  render: () => '<span></span>',
  setup: () => {},
}));

export function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

export function createTransitionEndEvent(propertyName: string): Event {
  const event = new Event('transitionend');
  Object.defineProperty(event, 'propertyName', { value: propertyName });
  return event;
}

export async function finishCloseTransition(container: HTMLElement): Promise<void> {
  const panel = container.querySelector('.cinder-drawer__panel');
  if (!panel) return;
  panel.dispatchEvent(createTransitionEndEvent('translate'));
  panel.dispatchEvent(createTransitionEndEvent('opacity'));
  await Promise.resolve();
}

export function installDrawerStyleProbe(): () => void {
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = (target: Element) => {
    if (target instanceof HTMLElement && target.classList.contains('cinder-drawer__panel')) {
      return new Proxy(originalGetComputedStyle(target), {
        get(style, property, receiver) {
          if (property === 'transitionProperty') return 'translate, opacity';
          if (property === 'transitionDuration') return '150ms, 150ms';
          if (property === 'transitionDelay') return '0ms, 0ms';
          return Reflect.get(style, property, receiver);
        },
      });
    }
    return originalGetComputedStyle(target);
  };
  return () => {
    window.getComputedStyle = originalGetComputedStyle;
  };
}
