import { requiredInstance } from '@lostgradient/testing';
import { cleanup, fireEvent } from '@testing-library/svelte';
export function cleanupNumberInput() {
  // Tear down any standalone <form> elements appended to body by form tests
  // FIRST so cleanup() doesn't try to remove children of an already-detached
  // form. happy-dom throws if removeChild can't find the node.
  document.querySelectorAll('body > form').forEach((form) => {
    try {
      form.remove();
    } catch {
      // ignore detached-node errors
    }
  });
  cleanup();
}
export function getInput(container: Element, id = 'n'): HTMLInputElement {
  return requiredInstance(container.querySelector(`#${id}`), HTMLInputElement);
}

export function getHidden(container: Element): HTMLInputElement | null {
  return container.querySelector('input[type="hidden"]');
}

export function getIncrement(container: Element): HTMLButtonElement {
  return requiredInstance(
    container.querySelector('.cinder-number-input__stepper--increment'),
    HTMLButtonElement,
  );
}

export function getDecrement(container: Element): HTMLButtonElement {
  return requiredInstance(
    container.querySelector('.cinder-number-input__stepper--decrement'),
    HTMLButtonElement,
  );
}

export async function type(input: HTMLInputElement, text: string) {
  input.value = text;
  await fireEvent.input(input, { target: { value: text } });
}

export async function blur(input: HTMLInputElement) {
  await fireEvent.blur(input);
}

export async function focus(input: HTMLInputElement) {
  await fireEvent.focus(input);
}
