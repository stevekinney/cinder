/**
 * Smoke tests for the JsonSchemaEditor facade. The state container has full
 * unit coverage in json-schema-editor-state.svelte.test.ts; these tests verify
 * the facade mounts and forwards key props.
 *
 * Note: deeper integration scenarios (form-edit → onchange) hit a happy-dom
 * bug with deeply-recursive Svelte 5 component trees. Those flows are
 * verified via the playground browser exercise instead.
 */

import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: JsonSchemaEditor } = await import('../json-schema-editor.svelte');

describe('JsonSchemaEditor — mount', () => {
  test('renders empty state for invalid initial schema', () => {
    const { container } = render(JsonSchemaEditor, {
      id: 'invalid-editor',
      schema: '{not-valid',
    });

    expect(container.textContent).toContain('Schema not loaded');
  });

  test('forwards a custom class name to the root', () => {
    const { container } = render(JsonSchemaEditor, {
      id: 'class-editor',
      schema: '{not-valid',
      class: 'my-custom-class',
    });

    const root = container.querySelector('#class-editor');
    expect(root?.className).toContain('my-custom-class');
  });
});
