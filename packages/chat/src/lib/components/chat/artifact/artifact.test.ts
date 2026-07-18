/// <reference lib="dom" />
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, mock, test } from 'bun:test';

import ArtifactPanelFixture from './artifact-panel-fixture.svelte';
import ArtifactViewer from './artifact-viewer.svelte';
import ChatArtifactLayoutFixture from './chat-artifact-layout-fixture.svelte';

describe('Chat artifact components', () => {
  test('renders every supported artifact content type', async () => {
    const { container, rerender } = render(ArtifactViewer, {
      props: { type: 'html', content: '<strong>HTML</strong>', title: 'Preview' },
    });
    expect(container.querySelector('iframe')?.getAttribute('sandbox')).toBe('');
    expect(container.querySelector('iframe')?.getAttribute('title')).toBe('Preview');

    await rerender({ type: 'svg', content: '<svg></svg>' });
    expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toContain('<svg></svg>');

    await rerender({ type: 'code', content: 'const value = 1;', language: 'typescript' });
    expect(container.querySelector('pre')?.dataset['language']).toBe('typescript');

    await rerender({ type: 'mermaid', content: 'graph TD; A-->B;' });
    expect(container.textContent).toContain('Mermaid diagram source');
  });

  test('renders panel content, focuses close, and dispatches close', async () => {
    const onclose = mock(() => {});
    const { container } = render(ArtifactPanelFixture, { props: { onclose } });
    const close = container.querySelector<HTMLButtonElement>('.artifact-panel-close')!;
    expect(container.textContent).toContain('Artifact content');
    expect(document.activeElement).toBe(close);
    await fireEvent.click(close);
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  test('shows the layout panel only while open', async () => {
    const { container, rerender } = render(ChatArtifactLayoutFixture, {
      props: { open: false },
    });
    expect(container.textContent).toContain('Chat content');
    expect(container.querySelector('.artifact-panel')).toBeNull();
    await rerender({ open: true });
    expect(container.textContent).toContain('Panel content');
    expect(container.querySelector('.chat-artifact-layout')?.classList.contains('custom')).toBe(
      true,
    );
  });
});
