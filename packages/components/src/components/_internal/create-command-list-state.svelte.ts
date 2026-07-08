import { inDocumentOrder } from '../../utilities/document-order.ts';
import type { CommandItemRegistrationInput, CommandListContext } from './command-list-context.ts';

type RegistrationRecord = CommandItemRegistrationInput & { id: string; node: HTMLElement };

export type CommandListKeyboardOptions = {
  event: KeyboardEvent;
  onEnter?: (id: string) => void;
  onEscape?: () => void;
  ignoreModifiedNavigation?: boolean;
  preventDefaultOnEmptyEnter?: boolean;
};

export class CommandListState {
  readonly #getListboxId: () => string;
  #registeredListboxId = $state('');
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

  constructor(listboxId: string | (() => string)) {
    this.#getListboxId = typeof listboxId === 'function' ? listboxId : () => listboxId;
    this.#registeredListboxId = this.#getListboxId();
  }

  get listboxId(): string {
    return this.#registeredListboxId;
  }

  syncListboxId(nextListboxId: string = this.#getListboxId()): void {
    const listboxId = nextListboxId;
    if (this.#registeredListboxId === listboxId) return;
    this.#registeredListboxId = listboxId;
    this.#intendedActiveId = null;
    this.registrations = this.registrations.map((registration, index) => ({
      ...registration,
      id: `${listboxId}-item-${index + 1}`,
    }));
    this.#itemCounter = this.registrations.length;
    this.refreshRegistrationsReady();
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
    this.syncListboxId();
    const id = `${this.listboxId}-item-${++this.#itemCounter}`;
    const getRegisteredId = () =>
      this.registrations.find((registeredItem) => registeredItem.node === node)?.id ?? id;
    const registration: RegistrationRecord = {
      id,
      node,
      getValue: input.getValue,
      getOnselect: input.getOnselect,
      getDisabled: input.getDisabled,
    };
    this.registrations.push(registration);
    return {
      get id() {
        return getRegisteredId();
      },
      unregister: () => {
        const index = this.registrations.findIndex(
          (registeredItem) => registeredItem.node === node,
        );
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
    preventDefaultOnEmptyEnter = false,
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
      if (!onEnter) return false;
      if (this.activeItemId === null && !preventDefaultOnEmptyEnter) return false;
      event.preventDefault();
      event.stopPropagation();
      if (this.activeItemId === null) return true;
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
    const getListboxId = () => this.listboxId;
    const getActiveItemId = () => this.activeItemId;
    const register = (input: CommandItemRegistrationInput, node: HTMLElement) =>
      this.register(input, node);
    const setActiveById = (id: string) => this.setActiveById(id);

    return {
      get listboxId() {
        return getListboxId();
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

export function createCommandListState(listboxId: string | (() => string)): CommandListState {
  return new CommandListState(listboxId);
}
