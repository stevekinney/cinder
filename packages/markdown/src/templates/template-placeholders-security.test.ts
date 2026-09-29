/**
 * Security tests for placeholder resolution.
 * DEP-625: Prototype pollution prevention: reserved and malformed paths never
 * resolve, only declared own data properties are read, and unresolved tokens
 * stay visible instead of becoming empty text.
 */

import { describe, expect, it } from 'bun:test';

import {
  parsePlaceholderTokens,
  resolveTemplatePlaceholders,
  validatePlaceholderTokens,
} from './template-placeholders.js';
import type { JsonObject, PlaceholderResolutionOptions } from './types.js';

function declare(...paths: string[]): PlaceholderResolutionOptions {
  return { definitions: { candidates: paths.map((path) => ({ path })) } };
}

/** Codes reported for a single-run template scanned without Markdown context. */
function tokenCodes(text: string, ...paths: string[]): string[] {
  return validatePlaceholderTokens(
    parsePlaceholderTokens(text),
    paths.map((path) => ({ path })),
  ).map((issue) => issue.code);
}

const RESERVED_PATHS = [
  '__proto__',
  'constructor',
  'prototype',
  'user.__proto__.isAdmin',
  'data.constructor.prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toString',
  'toLocaleString',
  'valueOf',
  '__PROTO__',
  'Constructor',
  'PROTOTYPE',
  'ToStRiNg',
  'user.__PROTO__.isAdmin',
  '__custom__',
  'user.__secret__.data',
  'a.b.__proto__.c.d',
];

describe('DEP-625: Prototype pollution prevention', () => {
  describe('reserved segment blocking', () => {
    it.each(RESERVED_PATHS)('reports blocked_path for {{%s}}', (path) => {
      expect(tokenCodes(`{{${path}}}`, 'user.name')).toEqual(['blocked_path']);
    });

    it.each([
      'constructor',
      'prototype',
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
      'toString',
      'toLocaleString',
      'valueOf',
      'Constructor',
      'PROTOTYPE',
      'ToStRiNg',
      'data.constructor.prototype',
      '__defineGetter',
    ])('keeps {{%s}} unresolved in the resolver with a blocked_path issue', (path) => {
      const template = `Value: {{${path}}}`;
      const result = resolveTemplatePlaceholders(
        template,
        { data: { value: 42 } },
        declare('data'),
      );

      expect(result.text).toBe(template);
      expect(result.issues.map((issue) => [issue.code, issue.path])).toEqual([
        ['blocked_path', path],
      ]);
    });

    it.each(['__proto__', 'user.__proto__.isAdmin', '__custom__', 'a.b.__proto__.c.d'])(
      'never resolves {{%s}} even where Markdown emphasis splits the token',
      (path) => {
        const template = `{{${path}}}`;
        const result = resolveTemplatePlaceholders(
          template,
          { user: { name: 'Alice' }, a: { b: { c: { d: 'value' } } } },
          declare('user.name', 'a.b.c.d'),
        );

        expect(result.text).toBe(template);
        expect(result.issues.length).toBeGreaterThan(0);
        expect(
          result.issues.every((issue) => ['blocked_path', 'malformed_token'].includes(issue.code)),
        ).toBe(true);
      },
    );

    it('blocks reserved segments even when they exist as own data', () => {
      const maliciousData = Object.create(null) as JsonObject;
      maliciousData['constructor'] = 'evil';

      const result = resolveTemplatePlaceholders('{{constructor}}', maliciousData, declare('name'));

      expect(result.text).toBe('{{constructor}}');
      expect(result.issues.map((issue) => issue.code)).toEqual(['blocked_path']);
    });

    it('rejects reserved paths in the definitions instead of declaring them', () => {
      const result = resolveTemplatePlaceholders(
        '{{constructor}}',
        {},
        { definitions: { candidates: [{ path: 'constructor' }] } },
      );

      expect(result.text).toBe('{{constructor}}');
      expect(result.issues.map((issue) => [issue.code, issue.location.kind])).toEqual([
        ['blocked_path', 'definition'],
      ]);
    });
  });

  describe('malformed path blocking', () => {
    it.each(['user..name', '.user.name', 'user.name.', 'user...name', '1user', 'first-name', ''])(
      'reports invalid_path_format for {{%s}} and keeps it unresolved',
      (path) => {
        const template = `{{${path}}}`;
        const result = resolveTemplatePlaceholders(
          template,
          { user: { name: 'Alice' } },
          declare('user.name'),
        );

        expect(result.text).toBe(template);
        expect(result.issues.map((issue) => issue.code)).toEqual(['invalid_path_format']);
      },
    );
  });

  describe('inherited properties never resolve', () => {
    it('does not read inherited members of a nested plain object', () => {
      const result = resolveTemplatePlaceholders('{{a.missing}}', { a: {} }, declare('a.missing'));

      expect(result).toEqual({
        text: '{{a.missing}}',
        issues: [
          {
            code: 'missing_value',
            message: expect.any(String),
            path: 'a.missing',
            location: { kind: 'token', startOffset: 0, endOffset: 13 },
          },
        ],
      });
    });

    it('treats an object with an inherited prototype as invalid data', () => {
      const inherited = Object.create({ name: 'inherited' }) as JsonObject;
      const result = resolveTemplatePlaceholders(
        '{{user.name}}',
        { user: inherited },
        declare('user.name'),
      );

      expect(result.text).toBe('{{user.name}}');
      expect(result.issues.map((issue) => issue.code)).toEqual(['invalid_value']);
    });
  });

  describe('legitimate paths still resolve', () => {
    it.each([
      ['name', { name: 'Alice' }, 'Alice'],
      ['user.name', { user: { name: 'Alice' } }, 'Alice'],
      ['a.b.c.d', { a: { b: { c: { d: 'value' } } } }, 'value'],
      ['user_data.field_name', { user_data: { field_name: 'test' } }, 'test'],
      ['_private.data', { _private: { data: 'secret' } }, 'secret'],
      ['_value', { _value: 42 }, '42'],
      ['constructor_id', { constructor_id: '12345' }, '12345'],
      ['my_constructor', { my_constructor: 'Builder' }, 'Builder'],
    ])('resolves {{%s}}', (path, values, expected) => {
      expect(resolveTemplatePlaceholders(`{{${path}}}`, values, declare(path))).toEqual({
        text: expected,
        issues: [],
      });
    });
  });

  describe('multiple tokens with mixed valid and blocked paths', () => {
    it('resolves valid paths and keeps blocked ones visible in the same template', () => {
      const result = resolveTemplatePlaceholders(
        '{{name}} is {{age}} years old and {{constructor}} is blocked',
        { name: 'Alice', age: 30 },
        declare('name', 'age'),
      );

      expect(result.text).toBe('Alice is 30 years old and {{constructor}} is blocked');
      expect(result.issues.map((issue) => issue.code)).toEqual(['blocked_path']);
    });

    it('resolves a template with only valid tokens', () => {
      expect(
        resolveTemplatePlaceholders(
          '{{a}} {{b}} {{c}}',
          { a: '1', b: '2', c: '3' },
          declare('a', 'b', 'c'),
        ),
      ).toEqual({ text: '1 2 3', issues: [] });
    });
  });
});
