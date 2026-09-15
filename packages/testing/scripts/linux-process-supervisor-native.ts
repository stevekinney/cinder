import { dlopen, FFIType, ptr, read } from 'bun:ffi';

type NativeFunctions = {
  prctl: {
    args: [
      typeof FFIType.i32,
      typeof FFIType.i32,
      typeof FFIType.i32,
      typeof FFIType.i32,
      typeof FFIType.i32,
    ];
    returns: typeof FFIType.i32;
  };
  waitpid: {
    args: [typeof FFIType.i32, typeof FFIType.ptr, typeof FFIType.i32];
    returns: typeof FFIType.i32;
  };
  __errno_location: { args: []; returns: typeof FFIType.ptr };
};

const PR_SET_CHILD_SUBREAPER = 36;
const WNOHANG = 1;

export type PrctlCall = (
  option: number,
  arg2: number,
  arg3: number,
  arg4: number,
  arg5: number,
) => number;

let native: ReturnType<typeof dlopen<NativeFunctions>> | undefined;

function loadNative(): ReturnType<typeof dlopen<NativeFunctions>> {
  native ??= dlopen('libc.so.6', {
    prctl: {
      args: [FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32, FFIType.i32],
      returns: FFIType.i32,
    },
    waitpid: { args: [FFIType.i32, FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
    __errno_location: { args: [], returns: FFIType.ptr },
  });
  return native;
}

export function enableChildSubreaper(): void {
  const result = enableChildSubreaperWith(loadNative().symbols.prctl);
  assertPrctlSuccess(result);
}

export function enableChildSubreaperWith(prctl: PrctlCall): number {
  return prctl(PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0);
}

export function assertPrctlSuccess(result: number): void {
  if (result !== 0) throw new Error(`prctl(PR_SET_CHILD_SUBREAPER) failed with code ${result}`);
}

export type WaitResult = { result: number; errno: number };

export function reapOneChild(): WaitResult {
  const status = new Int32Array(1);
  const library = loadNative();
  const result = library.symbols.waitpid(-1, ptr(status), WNOHANG);
  const errnoPointer = library.symbols.__errno_location();
  if (errnoPointer === null) throw new Error('errno pointer unavailable');
  return { result, errno: read.i32(errnoPointer, 0) };
}
