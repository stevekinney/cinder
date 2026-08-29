/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { setupHappyDom } from '../../test/happy-dom.ts';
setupHappyDom();
const { render } = await import('@testing-library/svelte');
const { default: KeyValueEditor } = await import('./key-value-editor.svelte');
describe('KeyValueEditor', () => {
  test('renders editable rows', () => {
    const { container } = render(KeyValueEditor, {
      entries: [{ key: 'Host', value: 'localhost' }],
    });
    expect(container.querySelectorAll('input')).toHaveLength(2);
  });
  test('routes secret cells through SecretValueField', () => {
    const { container } = render(KeyValueEditor, {
      entries: [{ key: 'TOKEN', value: 'private' }],
      secret: (key: string) => key === 'TOKEN',
    });
    expect(container.querySelector('.cinder-secret-value-field')).not.toBeNull();
    expect(container.textContent).not.toContain('private');
  });
});
