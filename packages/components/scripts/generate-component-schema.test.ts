import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import Ajv2020 from 'ajv/dist/2020';

import { generateSchemaForComponent, parseDefaultValue } from './generate-component-schema.ts';

describe('parseDefaultValue', () => {
  test('a single-quoted @default value resolves to the plain string, not the doubled-quote form', () => {
    expect(parseDefaultValue("'auto'")).toBe('auto');
  });

  test('a double-quoted @default value still resolves via JSON.parse (regression guard)', () => {
    expect(parseDefaultValue('"md"')).toBe('md');
  });

  test('a numeric @default value resolves to a number', () => {
    expect(parseDefaultValue('3')).toBe(3);
  });

  test('a single-quoted value with an internal unescaped quote is left untouched', () => {
    // The balanced-quote regex does not match (the inner `'` isn't
    // backslash-escaped), so this bails to the pre-fix raw-text fallback
    // rather than guessing at a stripped result that could corrupt the value.
    expect(parseDefaultValue("'won't fit'")).toBe("'won't fit'");
  });
});

describe('run-step-timeline generated schema', () => {
  const schema = generateSchemaForComponent({
    typesFilePath: join(
      import.meta.dir,
      '..',
      'src',
      'components',
      'run-step-timeline',
      'run-step-timeline.types.ts',
    ),
    componentName: 'run-step-timeline',
    depthToSrc: 2,
  }).schema;
  const validate = new Ajv2020({ strict: false }).compile(schema);

  function expectValid(value: unknown): void {
    expect(validate(value)).toBe(true);
  }

  function expectInvalid(value: unknown): void {
    expect(validate(value)).toBe(false);
  }

  test('accepts text and code details on top-level and nested run steps', () => {
    expectValid({
      steps: [
        {
          id: 'top-level',
          label: 'Top level',
          status: 'succeeded',
          details: [
            {
              id: 'top-text',
              label: 'Text log',
              open: true,
              type: 'text',
              content: 'plain execution log',
            },
            {
              id: 'top-code',
              label: 'Payload',
              open: false,
              type: 'code',
              code: '{"ok":true}',
              language: 'json',
              languageLabelVisible: false,
            },
          ],
          children: [
            {
              id: 'nested',
              label: 'Nested',
              status: 'running',
              details: [
                {
                  id: 'nested-text',
                  label: 'Nested log',
                  type: 'text',
                  content: 'nested execution log',
                },
                {
                  id: 'nested-code',
                  label: 'Nested payload',
                  type: 'code',
                  code: '[1,2,3]',
                  language: 'json',
                  languageLabelVisible: false,
                },
              ],
            },
          ],
        },
      ],
    });
  });

  test('rejects malformed detail variants before they reach the renderer', () => {
    const baseStep = {
      id: 'step',
      label: 'Step',
      status: 'succeeded',
    };

    expectInvalid({
      steps: [
        {
          ...baseStep,
          details: [{ id: 'missing-type', label: 'Missing type', content: 'legacy shape' }],
        },
      ],
    });
    expectInvalid({
      steps: [
        {
          ...baseStep,
          details: [{ id: 'text-with-code', label: 'Wrong field', type: 'text', code: '{}' }],
        },
      ],
    });
    expectInvalid({
      steps: [
        {
          ...baseStep,
          details: [{ id: 'code-with-content', label: 'Wrong field', type: 'code', content: '{}' }],
        },
      ],
    });
    expectInvalid({
      steps: [
        {
          ...baseStep,
          details: [{ id: 'code-missing-payload', label: 'Missing payload', type: 'code' }],
        },
      ],
    });
    expectInvalid({
      steps: [
        {
          ...baseStep,
          details: [{ id: 'text-missing-payload', label: 'Missing payload', type: 'text' }],
        },
      ],
    });
  });
});
