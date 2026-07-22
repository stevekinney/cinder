/// <reference lib="dom" />
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: JsonEditor } = await import('./json-editor.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('JsonEditor', () => {
  test('emits each proposed string value without taking ownership of controlled state', async () => {
    const onValueChange = mock();
    const view = render(JsonEditor, {
      id: 'payload',
      label: 'Payload',
      value: '{"before":true}',
      onValueChange,
    });

    const editor = view.getByLabelText('Payload') as HTMLTextAreaElement;
    await fireEvent.input(editor, { target: { value: '{"after":true}' } });

    expect(onValueChange).toHaveBeenCalledWith('{"after":true}');
  });

  test('synchronizes the native textarea when the external value changes', async () => {
    const view = render(JsonEditor, {
      id: 'payload',
      label: 'Payload',
      value: '{"version":1}',
    });

    await view.rerender({
      id: 'payload',
      label: 'Payload',
      value: '{"version":2}',
    });

    expect((view.getByLabelText('Payload') as HTMLTextAreaElement).value).toBe('{"version":2}');
  });

  test('synchronizes parse feedback after a native form reset', async () => {
    const form = document.createElement('form');
    form.id = 'payload-form';
    document.body.append(form);
    const view = render(JsonEditor, {
      id: 'payload',
      label: 'Payload',
      value: '{}',
      defaultValue: '{}',
      form: form.id,
    });
    const editor = view.getByLabelText('Payload') as HTMLTextAreaElement;

    await fireEvent.input(editor, { target: { value: '{' } });
    expect(editor.getAttribute('aria-invalid')).toBe('true');

    form.reset();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(editor.value).toBe('{}');
    expect(editor.hasAttribute('aria-invalid')).toBe(false);
    expect(view.getByRole('status').textContent).toBe('Valid JSON.');
  });

  test('announces valid JSON and wires the description to the textarea', () => {
    const view = render(JsonEditor, {
      id: 'payload',
      label: 'Payload',
      description: 'Enter the request body.',
      value: '{"valid":true}',
    });

    const editor = view.getByLabelText('Payload');
    const description = view.getByText('Enter the request body.');
    const status = view.getByRole('status');

    expect(status.textContent).toBe('Valid JSON.');
    expect(editor.getAttribute('aria-invalid')).toBeNull();
    expect(editor.getAttribute('aria-describedby')?.split(' ')).toEqual([
      description.id,
      status.id,
    ]);
  });

  test('announces invalid JSON and gives an external error precedence', async () => {
    const view = render(JsonEditor, {
      id: 'payload',
      label: 'Payload',
      value: '{',
    });

    const editor = view.getByLabelText('Payload');
    expect(editor.getAttribute('aria-invalid')).toBe('true');
    expect(view.getByRole('alert').textContent).toBe('Enter valid JSON.');

    await view.rerender({
      id: 'payload',
      label: 'Payload',
      value: '{}',
      error: 'Payloads are unavailable.',
    });

    expect(editor.getAttribute('aria-invalid')).toBe('true');
    expect(view.getByRole('alert').textContent).toBe('Payloads are unavailable.');
  });

  test('skips parsing while an external error owns feedback and resumes when it clears', async () => {
    const parse = spyOn(JSON, 'parse');
    const view = render(JsonEditor, {
      id: 'payload',
      label: 'Payload',
      value: '{"large":true}',
      error: 'Payloads are unavailable.',
    });

    expect(parse).not.toHaveBeenCalled();

    await view.rerender({
      id: 'payload',
      label: 'Payload',
      value: '{"large":true}',
      error: '',
    });

    expect(parse).toHaveBeenCalledWith('{"large":true}');
    parse.mockRestore();
  });

  test('treats an empty external error as cleared validation state', async () => {
    const view = render(JsonEditor, {
      id: 'payload',
      label: 'Payload',
      value: '{',
      error: '',
    });

    expect(view.getByRole('alert').textContent).toBe('Enter valid JSON.');

    await view.rerender({
      id: 'payload',
      label: 'Payload',
      value: '{}',
      error: '',
    });

    expect(view.getByRole('status').textContent).toBe('Valid JSON.');
  });

  test('updates parse feedback immediately from typed text before controlled state responds', async () => {
    const view = render(JsonEditor, {
      id: 'payload',
      label: 'Payload',
      value: '{}',
    });
    const editor = view.getByLabelText('Payload');

    await fireEvent.input(editor, { target: { value: '{' } });

    expect((editor as HTMLTextAreaElement).value).toBe('{');
    expect(editor.getAttribute('aria-invalid')).toBe('true');
    expect(view.getByRole('alert').textContent).toBe('Enter valid JSON.');
  });

  test('preserves proposed parse feedback across unrelated parent rerenders', async () => {
    const view = render(JsonEditor, {
      id: 'payload',
      label: 'Payload',
      value: '{}',
    });
    const editor = view.getByLabelText('Payload');
    await fireEvent.input(editor, { target: { value: '{' } });

    await view.rerender({
      id: 'payload',
      label: 'Payload',
      description: 'Updated description.',
      value: '{}',
    });

    expect(editor.getAttribute('aria-invalid')).toBe('true');
    expect(view.getByRole('alert').textContent).toBe('Enter valid JSON.');
  });

  test('suppresses valid feedback when consumer validation marks the editor invalid', () => {
    const view = render(JsonEditor, {
      id: 'payload',
      label: 'Payload',
      value: '{}',
      'aria-invalid': 'true',
      'aria-describedby': 'payload-domain-error',
    });
    const editor = view.getByLabelText('Payload');

    expect(editor.getAttribute('aria-invalid')).toBe('true');
    expect(editor.getAttribute('aria-describedby')).toBe('payload-domain-error');
    expect(view.queryByRole('status')).toBeNull();
  });

  test('restores valid feedback when consumer validation is cleared with null', async () => {
    const view = render(JsonEditor, {
      id: 'payload',
      label: 'Payload',
      value: '{}',
      'aria-invalid': 'true',
    });

    await view.rerender({
      id: 'payload',
      label: 'Payload',
      value: '{}',
      'aria-invalid': null,
    });

    expect(view.getByLabelText('Payload').getAttribute('aria-invalid')).toBeNull();
    expect(view.getByRole('status').textContent).toBe('Valid JSON.');
  });

  test('keeps native multiline keyboard input and does not trap Tab', async () => {
    const onValueChange = mock();
    const view = render(JsonEditor, {
      id: 'payload',
      label: 'Payload',
      value: '{}',
      onValueChange,
    });
    const editor = view.getByLabelText('Payload') as HTMLTextAreaElement;

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    editor.dispatchEvent(tabEvent);
    await fireEvent.input(editor, { target: { value: '{\n  "line": 2\n}' } });

    expect(tabEvent.defaultPrevented).toBe(false);
    expect(onValueChange).toHaveBeenCalledWith('{\n  "line": 2\n}');
  });

  test('can suppress success text while retaining invalid parse feedback', async () => {
    const view = render(JsonEditor, {
      id: 'payload',
      label: 'Payload',
      value: '{}',
      showValidFeedback: false,
    });

    expect(view.queryByRole('status')).toBeNull();

    await view.rerender({
      id: 'payload',
      label: 'Payload',
      value: '{',
      showValidFeedback: false,
    });

    expect(view.getByRole('alert').textContent).toBe('Enter valid JSON.');
  });
});
