/**
 * Config parsing tests (plan §3, §3.3, T1.1) — missing block, malformed
 * JSON, and defaults, per PROJECT-BRIEF. Pure logic, no real DOM: `Document`
 * is a tiny hand-built double satisfying only `getElementById()`, the one
 * method `readRuntimeConfig()` calls.
 */
import { describe, expect, test } from 'bun:test';

import { readRuntimeConfig, type WeftUiRuntimeConfig } from './config.ts';

function fakeDocument(text: string | null): Pick<Document, 'getElementById'> {
  return {
    getElementById(id: string) {
      if (id !== 'weft-ui-config' || text === null) return null;
      const element = document.createElement('div');
      element.textContent = text;
      return element;
    },
  };
}

describe('readRuntimeConfig — missing block', () => {
  test('defaults to same-origin auto transport when the element is absent', () => {
    expect(readRuntimeConfig(fakeDocument(null))).toEqual({
      baseUrl: '',
      eventTransport: 'auto',
    });
  });

  test('defaults the same way when the element is present but empty', () => {
    expect(readRuntimeConfig(fakeDocument('   '))).toEqual({
      baseUrl: '',
      eventTransport: 'auto',
    });
  });
});

describe('readRuntimeConfig — malformed JSON', () => {
  test('throws a diagnosable error rather than a bare SyntaxError', () => {
    expect(() => readRuntimeConfig(fakeDocument('{ not valid json'))).toThrow(
      /did not contain valid JSON/,
    );
  });
});

describe('readRuntimeConfig — shape validation', () => {
  test('throws when baseUrl is missing', () => {
    expect(() => readRuntimeConfig(fakeDocument('{}'))).toThrow(
      /did not contain a valid runtime config object/,
    );
  });

  test('throws when baseUrl is not a string', () => {
    expect(() => readRuntimeConfig(fakeDocument('{"baseUrl": 7233}'))).toThrow(
      /did not contain a valid runtime config object/,
    );
  });

  test('throws on an unrecognized eventTransport value', () => {
    expect(() =>
      readRuntimeConfig(fakeDocument('{"baseUrl": "", "eventTransport": "carrier-pigeon"}')),
    ).toThrow(/did not contain a valid runtime config object/);
  });

  test('throws when token is present but not a string', () => {
    expect(() => readRuntimeConfig(fakeDocument('{"baseUrl": "", "token": 12345}'))).toThrow(
      /did not contain a valid runtime config object/,
    );
  });

  test('throws when assetBase is present but not a string', () => {
    expect(() => readRuntimeConfig(fakeDocument('{"baseUrl": "", "assetBase": false}'))).toThrow(
      /did not contain a valid runtime config object/,
    );
  });

  test('throws when headers is present but not an object', () => {
    expect(() =>
      readRuntimeConfig(fakeDocument('{"baseUrl": "", "headers": "X-API-Key: x"}')),
    ).toThrow(/did not contain a valid runtime config object/);
  });

  test('throws when headers is an array', () => {
    expect(() => readRuntimeConfig(fakeDocument('{"baseUrl": "", "headers": []}'))).toThrow(
      /did not contain a valid runtime config object/,
    );
  });

  test('throws when a headers value is not a string', () => {
    expect(() =>
      readRuntimeConfig(fakeDocument('{"baseUrl": "", "headers": {"X-API-Key": 7233}}')),
    ).toThrow(/did not contain a valid runtime config object/);
  });

  test('throws for a non-object JSON value (array, string, number, null)', () => {
    expect(() => readRuntimeConfig(fakeDocument('[]'))).toThrow();
    expect(() => readRuntimeConfig(fakeDocument('"hello"'))).toThrow();
    expect(() => readRuntimeConfig(fakeDocument('42'))).toThrow();
    expect(() => readRuntimeConfig(fakeDocument('null'))).toThrow();
  });
});

describe('readRuntimeConfig — a valid config', () => {
  test('round-trips baseUrl, eventTransport, token, headers, and assetBase verbatim', () => {
    const config: WeftUiRuntimeConfig = {
      baseUrl: 'https://weft.example.com',
      eventTransport: 'sse',
      token: 'operator-key',
      headers: { 'X-Custom-Header': 'value' },
      assetBase: 'https://cdn.example.com/weft-ui/',
    };
    expect(readRuntimeConfig(fakeDocument(JSON.stringify(config)))).toEqual(config);
  });

  test('accepts an empty headers object', () => {
    expect(readRuntimeConfig(fakeDocument('{"baseUrl": "", "headers": {}}'))).toEqual({
      baseUrl: '',
      headers: {},
    });
  });

  test('accepts baseUrl alone with no other fields', () => {
    expect(readRuntimeConfig(fakeDocument('{"baseUrl": "/weft"}'))).toEqual({ baseUrl: '/weft' });
  });

  test('accepts every documented eventTransport value', () => {
    for (const eventTransport of ['auto', 'websocket', 'sse'] as const) {
      expect(
        readRuntimeConfig(fakeDocument(JSON.stringify({ baseUrl: '', eventTransport }))),
      ).toEqual({ baseUrl: '', eventTransport });
    }
  });
});
