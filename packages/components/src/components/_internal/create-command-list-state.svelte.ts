import { inDocumentOrder } from '../../utilities/document-order.ts';
import type { CommandItemRegistrationInput, CommandListContext } from './command-list-context.ts';

type RegistrationRecord = CommandItemRegistrationInput & { id: string; node: HTMLElement };

export type CommandListKeyboardOptions = {
  event: KeyboardEvent;
  onEnter?: (id: string) => void;
  onEscape?: () => void;
  ignoreModifiedNavigation?: boolean;
};

export class CommandListState {
  readonly listboxId: string;
  registrations = $state<RegistrationRecord[]>([]);
  registrationsReady = $state(false);
  #itemCounter = 0;
  #readyCycle = 0;
  #intendedActiveId = $state<string | null>(null);

  enabledIds = $derived.by(() => {
    return inDocumentOrder(this.registrations)
      .filter((registration) => !registration.getDisabled())
      .map((registration) => registration.id);
  });

  activeItemId = $derived(
    this.#intendedActiveId !== null && this.enabledIds.includes(this.#intendedActiveId)
      ? this.#intendedActiveId
      : (this.enabledIds[0] ?? null),
  );

  constructor(listboxId: string) {
    this.listboxId = listboxId;
  }

  resetActiveItem(): void {
    this.#intendedActiveId = null;
  }

  refreshRegistrationsReady(): void {
    this.registrationsReady = false;
    const cycle = ++this.#readyCycle;
    queueMicrotask(() => {
      if (cycle === this.#readyCycle) this.registrationsReady = true;
    });
  }

  scrollActiveItemIntoView(): void {
    if (this.activeItemId === null) return;
    const record = this.registrations.find((registration) => registration.id === this.activeItemId);
    record?.node.scrollIntoView({ block: 'nearest' });
  }

  setActiveById(id: string): void {
    this.#intendedActiveId = id;
  }

  register(input: CommandItemRegistrationInput, node: HTMLElement) {
    const id = `${this.listboxId}-item-${++this.#itemCounter}`;
    this.registrations.push({
      id,
      node,
      getValue: input.getValue,
      getOnselect: input.getOnselect,
      getDisabled: input.getDisabled,
    });
    return {
      id,
      unregister: () => {
        const index = this.registrations.findIndex((registration) => registration.id === id);
        if (index !== -1) this.registrations.splice(index, 1);
      },
    };
  }

  activateItemById(id: string): RegistrationRecord | null {
    const record = this.registrations.find((registration) => registration.id === id);
    if (!record || record.getDisabled()) return null;
    record.getOnselect()();
    return record;
  }

  handleKeydown({
    event,
    onEnter,
    onEscape,
    ignoreModifiedNavigation = false,
  }: CommandListKeyboardOptions): boolean {
    if (event.isComposing || event.keyCode === 229) return false;
    const isModified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    const ids = this.enabledIds;

    if (event.key === 'ArrowDown') {
      if (ignoreModifiedNavigation && isModified) return false;
      event.preventDefault();
      if (ids.length === 0) return true;
      const index = this.activeItemId === null ? -1 : ids.indexOf(this.activeItemId);
      this.#intendedActiveId = ids[(index + 1) % ids.length] ?? null;
      return true;
    }

    if (event.key === 'ArrowUp') {
      if (ignoreModifiedNavigation && isModified) return false;
      event.preventDefault();
      if (ids.length === 0) return true;
      const index = this.activeItemId === null ? 0 : ids.indexOf(this.activeItemId);
      this.#intendedActiveId = ids[index <= 0 ? ids.length - 1 : index - 1] ?? null;
      return true;
    }

    if (event.key === 'Home') {
      if (ignoreModifiedNavigation && isModified) return false;
      event.preventDefault();
      this.#intendedActiveId = ids[0] ?? null;
      return true;
    }

    if (event.key === 'End') {
      if (ignoreModifiedNavigation && isModified) return false;
      event.preventDefault();
      this.#intendedActiveId = ids[ids.length - 1] ?? null;
      return true;
    }

    if (event.key === 'Enter') {
      if (this.activeItemId === null) return false;
      event.preventDefault();
      event.stopPropagation();
      onEnter?.(this.activeItemId);
      return true;
    }

    if (event.key === 'Escape' && onEscape) {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
      return true;
    }

    return false;
  }

  createContext(activateItemById: (id: string) => void = (id) => void this.activateItemById(id)) {
    const listboxId = this.listboxId;
    const getActiveItemId = () => this.activeItemId;
    const register = (input: CommandItemRegistrationInput, node: HTMLElement) =>
      this.register(input, node);
    const setActiveById = (id: string) => this.setActiveById(id);

    return {
      get listboxId() {
        return listboxId;
      },
      get activeItemId() {
        return getActiveItemId();
      },
      register,
      setActiveById,
      activateItemById,
    } satisfies CommandListContext;
  }
}

export function createCommandListState(listboxId: string): CommandListState {
  return new CommandListState(listboxId);
}
