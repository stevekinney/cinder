import { describe, expect, test } from 'bun:test';
import { createFormDirtyGuard } from './form-dirty-guard.ts';

describe('createFormDirtyGuard', () => {
  test('tracks dirty state and reset', () => {
    const guard = createFormDirtyGuard();
    expect(guard.isDirty).toBe(false);
    guard.markDirty();
    expect(guard.isDirty).toBe(true);
    guard.reset();
    expect(guard.isDirty).toBe(false);
  });
  test('beforeunload only prevents navigation when dirty', () => {
    const guard = createFormDirtyGuard();
    const clean = new Event('beforeunload', { cancelable: true });
    Object.defineProperty(clean, 'returnValue', { value: undefined, writable: true });
    guard.handleBeforeUnload(clean);
    expect(clean.returnValue).toBeUndefined();
    guard.markDirty();
    let prevented = false;
    const dirty = new Event('beforeunload', { cancelable: true });
    Object.defineProperty(dirty, 'returnValue', { value: undefined, writable: true });
    dirty.preventDefault = () => {
      prevented = true;
    };
    guard.handleBeforeUnload(dirty);
    expect(prevented).toBe(true);
  });
  test('canNavigate confirms only when dirty', async () => {
    const guard = createFormDirtyGuard();
    expect(await guard.canNavigate(() => false)).toBe(true);
    guard.markDirty();
    expect(await guard.canNavigate(() => false)).toBe(false);
  });
});
