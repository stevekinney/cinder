import { pushEscapeHandler } from '../../_internal/overlay.ts';
import { inDocumentOrder } from '../../utilities/document-order.ts';
import type { CommandItemRegistrationInput, CommandListContext } from './command-list-context.ts';

type RegistrationHandle = { id: string; unregister: () => void };
type RegistrationRecord = CommandItemRegistrationInput & {
  id: string;
  node: HTMLElement;
  handle: RegistrationHandle;
};

export type CommandListItem = CommandItemRegistrationInput & {
  id: string;
  node: HTMLElement;
};

export type CommandListKeyboardOptions = {
  event: KeyboardEvent;
  onEnter?: (id: string) => void;
  onEscape?: () => void;
  ignoreModifiedNavigation?: boolean;
  preventDefaultOnEmptyEnter?: boolean;
};

export type CommandListDismissalOptions = {
  isOpen: () => boolean;
  isInside: (target: Node) => boolean;
  onDismiss: (restoreFocus: boolean) => void;
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
      id: updateRegistrationHandleId(registration, `${listboxId}-item-${index + 1}`),
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

  bindDismissal(options: CommandListDismissalOptions): () => void {
    const releaseEscape = pushEscapeHandler((event?: KeyboardEvent) => {
      if (!options.isOpen() || event?.key !== 'Escape') return;
      event.preventDefault();
      options.onDismiss(true);
    });
    const handlePointerDown = (event: MouseEvent): void => {
      if (options.isOpen() && !options.isInside(event.target as Node)) options.onDismiss(false);
    };
    const handleFocusIn = (event: FocusEvent): void => {
      if (options.isOpen() && !options.isInside(event.target as Node)) options.onDismiss(false);
    };
    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('focusin', handleFocusIn, true);
    return () => {
      releaseEscape();
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
    };
  }

  setActiveById(id: string): void {
    this.#intendedActiveId = id;
  }

  register(input: CommandItemRegistrationInput, node: HTMLElement) {
    this.syncListboxId();
    const id = `${this.listboxId}-item-${++this.#itemCounter}`;
    const handle = $state<RegistrationHandle>({
      id,
      unregister: () => {
        const index = this.registrations.findIndex(
          (registeredItem) => registeredItem.node === node,
        );
        if (index !== -1) this.registrations.splice(index, 1);
      },
    });
    const registration: RegistrationRecord = {
      id,
      node,
      handle,
      getValue: input.getValue,
      getOnselect: input.getOnselect,
      getDisabled: input.getDisabled,
    };
    this.registrations.push(registration);
    return handle;
  }

  syncItems(items: readonly CommandListItem[]): void {
    this.syncListboxId();
    const previousActiveId = this.#intendedActiveId;
    this.registrations = items.map((item) => ({
      ...item,
      handle: {
        id: item.id,
        unregister: () => {},
      },
    }));
    this.#itemCounter = items.length;
    this.#intendedActiveId = items.some((item) => item.id === previousActiveId)
      ? previousActiveId
      : null;
    this.refreshRegistrationsReady();
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

function updateRegistrationHandleId(registration: RegistrationRecord, id: string): string {
  registration.handle.id = id;
  return id;
}
