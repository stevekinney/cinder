import { requireElement } from '../../../tests/dom-test-support.ts';

/**
 * Component tests for `ArtifactView` (plan §9.5, Track D). `bun test` +
 * happy-dom + `@testing-library/svelte` (plan §11.2) — run via
 * `bun run test`, never bare `bun test` (README "Toolchain decisions").
 */
import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import ArtifactView from './artifact-view.svelte';

describe('ArtifactView', () => {
  test('renders a bare string as plain text', async () => {
    const { getByText } = render(ArtifactView, { props: { value: 'Please approve this.' } });
    expect(getByText('Please approve this.').tagName).toBe('P');
  });

  test('renders a markdown key as sanitized HTML', async () => {
    const { container } = render(ArtifactView, {
      props: { value: { markdown: '# Heading\n\nSome **bold** text.' } },
    });
    expect(container.querySelector('h1')?.textContent).toBe('Heading');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  test('sanitizes a script tag out of markdown content', async () => {
    const { container } = render(ArtifactView, {
      props: { value: { markdown: 'Hello <script>window.__pwned = true</script>' } },
    });
    expect(container.querySelector('script')).toBeNull();
  });

  test('renders an imageUrl key as an image', async () => {
    const { getByAltText } = render(ArtifactView, {
      props: { value: { imageUrl: 'https://example.com/chart.png' } },
    });
    const image = requireElement(getByAltText('Review artifact'), HTMLImageElement);
    expect(image.src).toBe('https://example.com/chart.png');
  });

  test('renders an htmlContent key as a sandboxed iframe', async () => {
    const { container } = render(ArtifactView, {
      props: { value: { htmlContent: '<p>Rich content</p>' } },
    });
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('sandbox')).toBe('');
    expect(iframe?.getAttribute('srcdoc')).toBe('<p>Rich content</p>');
  });

  test('falls back to PayloadInspector with humanized keys for a plain object', async () => {
    const { getByText, queryByText } = render(ArtifactView, {
      props: { value: { annualValue: 248_000, term: '24 months' }, label: 'Contract terms' },
    });
    expect(getByText('Contract terms')).not.toBeNull();
    expect(queryByText('annualValue')).toBeNull();
  });

  test('falls back to PayloadInspector for an array value', async () => {
    const { getByText } = render(ArtifactView, {
      props: { value: [1, 2, 3], label: 'List artifact' },
    });
    expect(getByText('List artifact')).not.toBeNull();
  });
});
