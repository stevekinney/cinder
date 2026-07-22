/// <reference lib="dom" />
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, mock, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import type { ArtifactViewerProps, MermaidRenderer } from '../index.ts';
import ArtifactPanelFixture from './artifact-panel-fixture.svelte';
import ArtifactViewer from './artifact-viewer.svelte';
import ChatArtifactLayoutFixture from './chat-artifact-layout-fixture.svelte';

describe('Chat artifact components', () => {
  test('renders the built-in HTML, SVG, and code content types without invoking the Mermaid renderer', async () => {
    const rendererInvocation = mock((_getContent: () => string, _getType: () => 'mermaid') => ({
      render: () => '<output>Rendered Mermaid</output>',
    }));
    const mermaidRenderer: MermaidRenderer = createRawSnippet(rendererInvocation);
    const { container, rerender } = render(ArtifactViewer, {
      props: {
        type: 'html',
        content: '<strong>HTML</strong>',
        title: 'Preview',
        mermaidRenderer,
      },
    });
    expect(container.querySelector('iframe')?.getAttribute('sandbox')).toBe('');
    expect(container.querySelector('iframe')?.getAttribute('title')).toBe('Preview');

    await rerender({ type: 'svg', content: '<svg></svg>' });
    expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toContain('<svg></svg>');

    await rerender({ type: 'code', content: 'const value = 1;', language: 'typescript' });
    expect(container.querySelector('pre')?.dataset['language']).toBe('typescript');
    expect(container.querySelector('code')?.textContent).toBe('const value = 1;');
    expect(rendererInvocation).not.toHaveBeenCalled();
  });

  test('renders Mermaid source with an honest fallback when no renderer is provided', () => {
    const { container } = render(ArtifactViewer, {
      props: { type: 'mermaid', content: 'graph TD; A-->B;' },
    });

    expect(container.querySelector('pre')?.dataset['language']).toBe('mermaid');
    expect(container.querySelector('code')?.textContent).toBe('graph TD; A-->B;');
    expect(container.textContent).toContain('No Mermaid renderer was provided');
  });

  test('invokes a custom Mermaid renderer with the content and content type', () => {
    const rendererInvocation = mock((getContent: () => string, getType: () => 'mermaid') => ({
      render: () =>
        `<output data-testid="mermaid-renderer" data-type="${getType()}">${getContent()}</output>`,
    }));
    const mermaidRenderer: MermaidRenderer = createRawSnippet(rendererInvocation);
    const props = {
      type: 'mermaid',
      content: 'graph TD; Start-->Finish;',
      mermaidRenderer,
    } satisfies ArtifactViewerProps;
    const { container } = render(ArtifactViewer, {
      props,
    });

    const renderedDiagram = container.querySelector('[data-testid="mermaid-renderer"]');
    expect(rendererInvocation).toHaveBeenCalledTimes(1);
    expect(renderedDiagram?.getAttribute('data-type')).toBe('mermaid');
    expect(renderedDiagram?.textContent).toBe('graph TD; Start-->Finish;');
    expect(container.querySelector('.artifact-mermaid-note')).toBeNull();
    expect(container.querySelector('pre')).toBeNull();
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
