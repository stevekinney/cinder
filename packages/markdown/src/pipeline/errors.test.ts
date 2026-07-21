/**
 * Unit tests for pipeline error classes.
 *
 * DEP-565: Coverage hardening for @lostgradient/markdown.
 */

import { describe, expect, it } from 'bun:test';
import { MarkdownParseError, PositionValidationError } from './errors.js';

describe('MarkdownParseError', () => {
  it('sets .message from constructor argument', () => {
    const error = new MarkdownParseError('parse failed', '# Hello');
    expect(error.message).toBe('parse failed');
  });

  it('has .name set to MarkdownParseError', () => {
    const error = new MarkdownParseError('test', 'input');
    expect(error.name).toBe('MarkdownParseError');
  });

  it('is an instance of Error', () => {
    const error = new MarkdownParseError('test', 'input');
    expect(error).toBeInstanceOf(Error);
  });

  it('is an instance of MarkdownParseError', () => {
    const error = new MarkdownParseError('test', 'input');
    expect(error).toBeInstanceOf(MarkdownParseError);
  });

  it('stores the input string', () => {
    const error = new MarkdownParseError('test', '# Some markdown');
    expect(error.input).toBe('# Some markdown');
  });

  it('truncates input longer than 200 characters', () => {
    const longInput = 'a'.repeat(300);
    const error = new MarkdownParseError('test', longInput);
    expect(error.input).toBe('a'.repeat(200) + '...');
    expect(error.input.length).toBe(203);
  });

  it('does not truncate input at exactly 200 characters', () => {
    const exactInput = 'b'.repeat(200);
    const error = new MarkdownParseError('test', exactInput);
    expect(error.input).toBe(exactInput);
    expect(error.input.length).toBe(200);
  });
});

describe('PositionValidationError', () => {
  it('sets .message describing missing positions', () => {
    const error = new PositionValidationError(['heading', 'paragraph']);
    expect(error.message).toContain('heading, paragraph');
    expect(error.message).toContain('missing position data');
  });

  it('has .name set to PositionValidationError', () => {
    const error = new PositionValidationError(['heading']);
    expect(error.name).toBe('PositionValidationError');
  });

  it('is an instance of Error', () => {
    const error = new PositionValidationError(['heading']);
    expect(error).toBeInstanceOf(Error);
  });

  it('is an instance of PositionValidationError', () => {
    const error = new PositionValidationError(['heading']);
    expect(error).toBeInstanceOf(PositionValidationError);
  });

  it('stores missingPositions array', () => {
    const positions = ['heading', 'list', 'code'];
    const error = new PositionValidationError(positions);
    expect(error.missingPositions).toEqual(positions);
  });

  it('handles single missing position', () => {
    const error = new PositionValidationError(['blockquote']);
    expect(error.message).toContain('blockquote');
    expect(error.missingPositions).toEqual(['blockquote']);
  });
});
