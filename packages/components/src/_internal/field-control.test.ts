/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import {
  ariaInvalid,
  composeDescribedBy,
  describeId,
  errorId,
  resolveFieldControl,
} from './field-control.ts';

describe('field-control helpers', () => {
  test('describeId returns suffixed id when description is present', () => {
    expect(describeId('email', true)).toBe('email-description');
  });

  test('describeId returns undefined when description is absent', () => {
    expect(describeId('email', false)).toBeUndefined();
  });

  test('errorId returns suffixed id when error is present', () => {
    expect(errorId('email', true)).toBe('email-error');
  });

  test('errorId returns undefined when error is absent', () => {
    expect(errorId('email', false)).toBeUndefined();
  });

  test('composeDescribedBy filters out undefined and joins with single spaces', () => {
    expect(composeDescribedBy('a', undefined, 'b', null, 'c')).toBe('a b c');
  });

  test('composeDescribedBy returns undefined when no ids are present', () => {
    expect(composeDescribedBy(undefined, null, undefined)).toBeUndefined();
  });

  test('composeDescribedBy collapses an empty input to undefined', () => {
    expect(composeDescribedBy()).toBeUndefined();
  });

  test('composeDescribedBy treats empty strings as absent ids', () => {
    expect(composeDescribedBy('', 'real-id', '')).toBe('real-id');
  });

  test('ariaInvalid returns the literal "true" when there is an error', () => {
    expect(ariaInvalid(true)).toBe('true');
  });

  test('ariaInvalid returns undefined when there is no error', () => {
    expect(ariaInvalid(false)).toBeUndefined();
  });

  test('resolveFieldControl prefers explicit errors over context and consumer invalid state', () => {
    const resolved = resolveFieldControl({
      generatedId: 'generated',
      id: 'email',
      hasDescription: true,
      hasError: true,
      consumerDescribedBy: 'consumer-hint',
      consumerInvalid: false,
      context: {
        controlId: 'context-email',
        descriptionId: 'context-description',
        errorId: 'context-error',
        describedBy: 'context-description context-error',
        invalid: undefined,
        required: true,
        disabled: true,
      },
    });

    expect(resolved).toEqual({
      id: 'email',
      descriptionId: 'email-description',
      errorId: 'email-error',
      describedBy: 'email-description email-error context-description context-error consumer-hint',
      ariaInvalid: 'true',
      required: true,
      disabled: true,
    });
  });

  test('resolveFieldControl falls back to generated id and standalone state', () => {
    expect(
      resolveFieldControl({
        generatedId: 'generated',
        required: true,
        disabled: false,
      }),
    ).toEqual({
      id: 'generated',
      descriptionId: undefined,
      errorId: undefined,
      describedBy: undefined,
      ariaInvalid: undefined,
      required: true,
      disabled: false,
    });
  });

  test('resolveFieldControl preserves native non-boolean aria-invalid values', () => {
    expect(
      resolveFieldControl({
        generatedId: 'field',
        consumerInvalid: 'grammar',
      }).ariaInvalid,
    ).toBe('grammar');
  });
});
