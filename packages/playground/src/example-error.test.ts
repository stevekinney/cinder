import { describe, expect, it } from 'bun:test';

import {
  formatErrorForClipboard,
  formatErrorMessage,
  MAX_STACK_LENGTH,
  toMountErrorDetail,
  truncateStack,
} from './example-error.ts';

describe('formatErrorMessage', () => {
  it('uses the message of an Error instance', () => {
    expect(formatErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('falls back to the error name when the message is empty', () => {
    const error = new TypeError('');
    expect(formatErrorMessage(error)).toBe('TypeError');
  });

  it('returns a thrown string verbatim', () => {
    expect(formatErrorMessage('plain string failure')).toBe('plain string failure');
  });

  it('stringifies a thrown non-error value', () => {
    expect(formatErrorMessage(42)).toBe('42');
    expect(formatErrorMessage({ toString: () => 'custom' })).toBe('custom');
  });

  it('never returns an empty string for a falsy thrown value', () => {
    expect(formatErrorMessage(null)).toBe('null');
    expect(formatErrorMessage(undefined)).toBe('undefined');
  });
});

describe('truncateStack', () => {
  it('returns undefined for undefined input', () => {
    expect(truncateStack(undefined)).toBeUndefined();
  });

  it('returns undefined for whitespace-only input', () => {
    expect(truncateStack('   \n  ')).toBeUndefined();
  });

  it('returns a short stack trimmed and intact', () => {
    expect(truncateStack('  at foo (bar.ts:1)  ')).toBe('at foo (bar.ts:1)');
  });

  it('truncates a stack longer than the limit and appends a marker', () => {
    const long = 'x'.repeat(MAX_STACK_LENGTH + 50);
    const result = truncateStack(long);
    expect(result).not.toBeUndefined();
    expect(result?.startsWith('x'.repeat(MAX_STACK_LENGTH))).toBe(true);
    expect(result).toContain('50 more characters truncated');
  });

  it('honors a custom maxLength', () => {
    const result = truncateStack('abcdefghij', 4);
    expect(result?.startsWith('abcd')).toBe(true);
    expect(result).toContain('6 more characters truncated');
  });
});

describe('toMountErrorDetail', () => {
  it('captures both message and truncated stack from an Error', () => {
    const error = new Error('mount failed');
    error.stack = 'Error: mount failed\n    at mount (component.svelte:10)';
    const detail = toMountErrorDetail(error);
    expect(detail.message).toBe('mount failed');
    expect(detail.stack).toContain('at mount (component.svelte:10)');
  });

  it('omits the stack when the thrown value carries none', () => {
    expect(toMountErrorDetail('just a string')).toEqual({ message: 'just a string' });
  });

  it('omits the stack when an Error has an empty stack', () => {
    const error = new Error('no stack');
    error.stack = '';
    expect(toMountErrorDetail(error)).toEqual({ message: 'no stack' });
  });
});

describe('formatErrorForClipboard', () => {
  it('returns only the message when there is no stack', () => {
    expect(formatErrorForClipboard({ message: 'oops' })).toBe('oops');
  });

  it('joins message and stack with a blank line', () => {
    expect(
      formatErrorForClipboard({ message: 'oops', stack: 'at a\nat b' }),
    ).toBe('oops\n\nat a\nat b');
  });
});
