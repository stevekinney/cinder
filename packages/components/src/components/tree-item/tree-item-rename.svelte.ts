import type { Attachment } from 'svelte/attachments';

import type { TreeItemProps } from './tree-item.types.ts';

export type TreeItemRenameControllerOptions = {
  getId: () => string;
  getLabel: () => string;
  getOnRename: () => TreeItemProps['onRename'];
  /**
   * Not in the extraction's original sketch, but load-bearing: `canRename`
   * gates F2/double-click/Enter entry into edit mode, and the existing
   * "disabled items do not enter edit mode" coverage
   * (tree/tree-rename.test.ts) requires it to keep gating after the move.
   */
  getDisabled: () => boolean;
  getOuterElement: () => HTMLElement | undefined;
  getElementId: () => string;
  canFocusVisibleDelta: (direction: 1 | -1) => boolean;
  focusVisibleDelta: (direction: 1 | -1) => void;
};

/**
 * Inline-rename state machine for a single tree item: begin/cancel/commit
 * editing, the async `onRename` round-trip (pending/error), and the
 * live-region announcements that accompany each transition. Modeled on the
 * `$state`-fields-plus-`#options`-object shape of `TreeDragController`.
 */
export class TreeItemRenameController {
  editing = $state(false);
  editValue = $state('');
  renamePending = $state(false);
  renameError = $state('');
  renameAnnouncement = $state('');
  renameAnnouncementSequence = $state(0);

  #inputElement: HTMLInputElement | undefined;
  #owningTreeElement: HTMLElement | undefined;
  readonly #options: TreeItemRenameControllerOptions;

  constructor(options: TreeItemRenameControllerOptions) {
    this.#options = options;
  }

  get canRename(): boolean {
    return !this.#options.getDisabled() && this.#options.getOnRename() != null;
  }

  get editingLabel(): string {
    return `Editing: ${this.#options.getLabel()}`;
  }

  get messageId(): string {
    return `${this.#options.getElementId()}-rename-message`;
  }

  attachInput: Attachment<HTMLInputElement> = (node) => {
    this.#inputElement = node;
    queueMicrotask(() => {
      if (!this.editing || this.#inputElement !== node) return;
      node.focus();
      node.select();
    });
    return () => {
      if (this.#inputElement === node) this.#inputElement = undefined;
    };
  };

  #announce(message: string): void {
    this.renameAnnouncement = message;
    this.renameAnnouncementSequence += 1;
  }

  #renameFailureMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error) return error;
    return 'Unknown error';
  }

  #focusCurrentTreeItem(): void {
    const outerElement = this.#options.getOuterElement();
    if (outerElement?.isConnected) {
      outerElement.focus();
      this.#owningTreeElement = undefined;
      return;
    }

    if (typeof document === 'undefined') return;
    const root: ParentNode =
      this.#owningTreeElement?.isConnected === true ? this.#owningTreeElement : document;
    const id = this.#options.getId();
    const current = [...root.querySelectorAll<HTMLElement>('[data-cinder-tree-item-id]')].find(
      (element) => element.dataset['cinderTreeItemId'] === id,
    );
    current?.focus();
    this.#owningTreeElement = undefined;
  }

  beginEdit(): void {
    if (!this.canRename || this.editing) return;
    const label = this.#options.getLabel();
    this.editValue = label;
    this.renameError = '';
    this.renamePending = false;
    this.#owningTreeElement =
      this.#options.getOuterElement()?.closest<HTMLElement>('[role="tree"]') ?? undefined;
    this.editing = true;
    this.#announce(`Editing ${label}. Press Enter to confirm, Escape to cancel.`);
  }

  #finishEdit(afterFocus: (() => void) | undefined = undefined): void {
    this.editing = false;
    this.renameError = '';
    this.renamePending = false;
    queueMicrotask(() => {
      this.#focusCurrentTreeItem();
      afterFocus?.();
    });
  }

  cancelEdit(): void {
    this.editValue = this.#options.getLabel();
    this.#announce('Rename cancelled.');
    this.#finishEdit();
  }

  async commitEdit(afterFocus: (() => void) | undefined = undefined): Promise<boolean> {
    if (!this.editing || this.renamePending) return false;

    if (this.editValue.trim().length === 0) {
      this.renameError = 'Label is required.';
      this.#announce(this.renameError);
      queueMicrotask(() => this.#inputElement?.focus());
      return false;
    }

    const onRename = this.#options.getOnRename();
    if (!onRename) {
      this.#finishEdit(afterFocus);
      return true;
    }

    this.renamePending = true;
    this.renameError = '';
    try {
      await onRename(this.#options.getId(), this.editValue);
      this.#announce(`${this.editValue}, renamed.`);
      this.#finishEdit(afterFocus);
      return true;
    } catch (error) {
      const message = `Rename failed: ${this.#renameFailureMessage(error)}.`;
      this.renamePending = false;
      this.renameError = message;
      this.#announce(message);
      queueMicrotask(() => this.#inputElement?.focus());
      return false;
    }
  }

  async #commitEditAndMove(direction: 1 | -1): Promise<void> {
    await this.commitEdit(() => this.#options.focusVisibleDelta(direction));
  }

  handleInputKeydown = (event: KeyboardEvent): void => {
    event.stopPropagation();

    if (event.key === 'Enter') {
      event.preventDefault();
      void this.commitEdit();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEdit();
      return;
    }

    if (event.key === 'Tab') {
      const direction = event.shiftKey ? -1 : 1;
      if (this.#options.canFocusVisibleDelta(direction)) {
        event.preventDefault();
        void this.#commitEditAndMove(direction);
      } else {
        void this.commitEdit();
      }
    }
  };

  handleInputBlur = (): void => {
    void this.commitEdit();
  };
}
