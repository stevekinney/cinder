import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

export type ProcessIdentity = {
  pid: number;
  parentPid: number;
  groupId: number;
  startTime: string;
};

export type ProcessSnapshot = {
  identities: readonly ProcessIdentity[];
  complete: boolean;
  observedPids: readonly number[];
};

export type ProcessSnapshotReader = () => readonly ProcessIdentity[] | ProcessSnapshot | null;

export function snapshotIdentities(
  snapshot: readonly ProcessIdentity[] | ProcessSnapshot,
): readonly ProcessIdentity[] {
  return 'identities' in snapshot ? snapshot.identities : snapshot;
}

export function snapshotIsComplete(
  snapshot: readonly ProcessIdentity[] | ProcessSnapshot,
): boolean {
  return !('identities' in snapshot) || snapshot.complete;
}

type ProcessSnapshotSource = {
  pid: number;
  parentPid: number;
  groupId: number;
  startTime: string;
};

type DarwinFfiModule = Pick<typeof import('bun:ffi'), 'FFIType' | 'dlopen' | 'ptr'>;
type DarwinFfiFunctions = {
  proc_pidinfo: {
    args: [
      typeof import('bun:ffi').FFIType.i32,
      typeof import('bun:ffi').FFIType.i32,
      typeof import('bun:ffi').FFIType.u64,
      typeof import('bun:ffi').FFIType.ptr,
      typeof import('bun:ffi').FFIType.i32,
    ];
    returns: typeof import('bun:ffi').FFIType.i32;
  };
};
type DarwinLibproc = import('bun:ffi').Library<DarwinFfiFunctions>;

const DARWIN_BSD_INFO_SIZE = 136;
const DARWIN_PID_OFFSET = 12;
const DARWIN_PPID_OFFSET = 16;
const DARWIN_PGID_OFFSET = 100;
const DARWIN_START_SECONDS_OFFSET = 120;
const DARWIN_START_MICROSECONDS_OFFSET = 128;
const DARWIN_PROC_PIDTBSDINFO = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDarwinFfiModule(value: unknown): value is DarwinFfiModule {
  return (
    isRecord(value) &&
    typeof value['dlopen'] === 'function' &&
    typeof value['ptr'] === 'function' &&
    isRecord(value['FFIType'])
  );
}

function loadDarwinFfi(): DarwinFfiModule | null {
  const value: unknown = require('bun:ffi');
  return isDarwinFfiModule(value) ? value : null;
}

export function parseDarwinProcessInfo(
  buffer: ArrayBufferLike,
  expected: Pick<ProcessIdentity, 'pid' | 'parentPid' | 'groupId'>,
): string | null {
  if (buffer.byteLength !== DARWIN_BSD_INFO_SIZE) return null;
  const view = new DataView(buffer);
  const pid = view.getUint32(DARWIN_PID_OFFSET, true);
  const parentPid = view.getUint32(DARWIN_PPID_OFFSET, true);
  const groupId = view.getUint32(DARWIN_PGID_OFFSET, true);
  if (pid !== expected.pid || parentPid !== expected.parentPid || groupId !== expected.groupId)
    return null;
  return `${view.getBigUint64(DARWIN_START_SECONDS_OFFSET, true)}:${view.getBigUint64(
    DARWIN_START_MICROSECONDS_OFFSET,
    true,
  )}`;
}

export function parseProcessSnapshot(output: string): ProcessIdentity[] {
  return output
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((columns) => columns.length >= 4)
    .flatMap(([pidText, parentPidText, groupIdText, ...startTimeColumns]) => {
      const pid = Number(pidText);
      const parentPid = Number(parentPidText);
      const groupId = Number(groupIdText);
      const startTime = startTimeColumns.join(' ');
      return Number.isInteger(pid) &&
        Number.isInteger(parentPid) &&
        Number.isInteger(groupId) &&
        pid > 0 &&
        parentPid >= 0 &&
        groupId > 0 &&
        startTime.length > 0
        ? [{ pid, parentPid, groupId, startTime }]
        : [];
    });
}

export function parseLinuxProcessStat(
  pid: number,
  stat: string,
  bootId: string,
): ProcessIdentity | null {
  const closingParenthesis = stat.lastIndexOf(')');
  if (closingParenthesis < 0) return null;
  const fields = stat
    .slice(closingParenthesis + 1)
    .trim()
    .split(/\s+/);
  if (fields.length < 20) return null;
  const parentPid = Number(fields[1]);
  const groupId = Number(fields[2]);
  const startTicks = Number(fields[19]);
  if (
    !Number.isInteger(parentPid) ||
    !Number.isInteger(groupId) ||
    !Number.isInteger(startTicks) ||
    parentPid < 0 ||
    groupId <= 0 ||
    startTicks < 0 ||
    !bootId
  )
    return null;
  return { pid, parentPid, groupId, startTime: `${bootId}:${startTicks}` };
}

let cachedDarwinLibproc: DarwinLibproc | null | undefined;

function darwinLibproc(ffi: DarwinFfiModule): DarwinLibproc | null {
  if (cachedDarwinLibproc !== undefined) return cachedDarwinLibproc;
  try {
    cachedDarwinLibproc = ffi.dlopen('/usr/lib/libproc.dylib', {
      proc_pidinfo: {
        args: [ffi.FFIType.i32, ffi.FFIType.i32, ffi.FFIType.u64, ffi.FFIType.ptr, ffi.FFIType.i32],
        returns: ffi.FFIType.i32,
      },
    });
  } catch {
    cachedDarwinLibproc = null;
  }
  return cachedDarwinLibproc;
}

function captureDarwinProcessSnapshot(): readonly ProcessIdentity[] | ProcessSnapshot | null {
  const result = spawnSync('ps', ['-A', '-o', 'pid=,ppid=,pgid='], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  const rows: ProcessSnapshotSource[] = result.stdout
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .flatMap(([pidText, parentPidText, groupIdText]) => {
      const pid = Number(pidText);
      const parentPid = Number(parentPidText);
      const groupId = Number(groupIdText);
      return Number.isInteger(pid) &&
        Number.isInteger(parentPid) &&
        Number.isInteger(groupId) &&
        pid > 0 &&
        parentPid >= 0 &&
        groupId > 0
        ? [{ pid, parentPid, groupId, startTime: '' }]
        : [];
    });
  const ffi = loadDarwinFfi();
  if (ffi === null) return null;
  const libproc = darwinLibproc(ffi);
  if (libproc === null) return null;
  const identities: ProcessIdentity[] = [];
  let complete = true;
  for (const row of rows) {
    const buffer = new Uint8Array(DARWIN_BSD_INFO_SIZE);
    const bytes = libproc.symbols.proc_pidinfo(
      row.pid,
      DARWIN_PROC_PIDTBSDINFO,
      0,
      ffi.ptr(buffer),
      DARWIN_BSD_INFO_SIZE,
    );
    if (bytes !== DARWIN_BSD_INFO_SIZE) {
      complete = false;
      continue;
    }
    const startTime = parseDarwinProcessInfo(buffer.buffer, row);
    if (startTime === null) complete = false;
    else identities.push({ ...row, startTime });
  }
  return { identities, complete, observedPids: rows.map((row) => row.pid) };
}

function captureLinuxProcessSnapshot(): readonly ProcessIdentity[] | ProcessSnapshot | null {
  try {
    const bootId = readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
    const identities: ProcessIdentity[] = [];
    const observedPids: number[] = [];
    let complete = true;
    for (const entry of readdirSync('/proc', { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
      const pid = Number(entry.name);
      observedPids.push(pid);
      try {
        const identity = parseLinuxProcessStat(
          pid,
          readFileSync(`/proc/${entry.name}/stat`, 'utf8'),
          bootId,
        );
        if (identity === null) complete = false;
        else identities.push(identity);
      } catch (error) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
        if (code !== 'ENOENT') complete = false;
      }
    }
    return { identities, complete, observedPids };
  } catch {
    return null;
  }
}

export function captureProcessSnapshot(): readonly ProcessIdentity[] | ProcessSnapshot | null {
  if (process.platform === 'darwin') return captureDarwinProcessSnapshot();
  if (process.platform === 'linux') return captureLinuxProcessSnapshot();
  return [];
}
