export type FormDirtyGuard = {
  readonly isDirty: boolean;
  markDirty(): void;
  reset(): void;
  handleBeforeUnload(event: BeforeUnloadEvent): void;
  canNavigate(confirm: () => boolean | Promise<boolean>): Promise<boolean>;
};

export function createFormDirtyGuard(): FormDirtyGuard {
  let dirty = false;
  return {
    get isDirty() {
      return dirty;
    },
    markDirty() {
      dirty = true;
    },
    reset() {
      dirty = false;
    },
    handleBeforeUnload(event) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    },
    async canNavigate(confirm) {
      return !dirty || (await confirm());
    },
  };
}
