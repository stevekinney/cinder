/// <reference lib="dom" />
import { afterAll, afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

class TestResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

// Capture the original so it can be restored — overwriting globalThis without
// restoring leaks the stub into any later test file that relies on the real one.
const originalResizeObserver = globalThis.ResizeObserver;
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

const { cleanup, render } = await import('@testing-library/svelte');
const { default: Spectrogram } = await import('./spectrogram.svelte');

afterEach(() => cleanup());
afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

// 4 frames × 6 bins
const mockFrames = [
  { label: '0 ms', bins: [0.1, 0.5, 0.9, 0.7, 0.3, 0.1] },
  { label: '10 ms', bins: [0.2, 0.6, 0.8, 0.6, 0.2, 0.05] },
  { label: '20 ms', bins: [0.15, 0.4, 0.7, 0.8, 0.4, 0.2] },
  { label: '30 ms', bins: [0.05, 0.3, 0.6, 0.9, 0.5, 0.25] },
];

describe('Spectrogram', () => {
  test('uses the custom theme palette and background for heatmap fills', () => {
    const { container } = render(Spectrogram, {
      label: 'Themed spectrogram',
      frames: mockFrames,
      theme: { palette: ['custom-palette'], background: 'custom-background' },
    });
    const fill = container.querySelector('.cinder-spectrogram__cell')?.getAttribute('fill');
    expect(fill).toContain('custom-palette');
    expect(fill).toContain('custom-background');
  });

  test('keeps cells inside the plot with long frequency labels', () => {
    const { container } = render(Spectrogram, {
      label: 'Long labels',
      frames: [{ label: 'A very long time label', bins: [1] }],
      frequencyLabels: ['An extremely long frequency label'],
    });
    const cell = container.querySelector<SVGRectElement>('.cinder-spectrogram__cell');
    expect(cell?.getAttribute('x')).toBe('0');
    expect(Number(cell?.getAttribute('width'))).toBeGreaterThan(0);
  });

  test('measures only sampled time labels that are rendered', () => {
    const shortFrames = Array.from({ length: 11 }, (_, index) => ({
      label: `T${index}`,
      bins: [1],
    }));
    const shortView = render(Spectrogram, { label: 'Short labels', frames: shortFrames });
    const shortCellHeight = Number(
      shortView.container.querySelector('.cinder-spectrogram__cell')?.getAttribute('height'),
    );
    shortView.unmount();

    const framesWithHiddenLongLabel = shortFrames.map((frame, index) =>
      index === 1 ? { ...frame, label: 'This unsampled label should not affect geometry' } : frame,
    );
    const longView = render(Spectrogram, {
      label: 'Hidden long label',
      frames: framesWithHiddenLongLabel,
    });
    const longCellHeight = Number(
      longView.container.querySelector('.cinder-spectrogram__cell')?.getAttribute('height'),
    );

    expect(longView.queryByText('This unsampled label should not affect geometry')).toBeNull();
    expect(longCellHeight).toBe(shortCellHeight);
  });

  test('renders cells for each frame × bin combination', () => {
    const { container } = render(Spectrogram, {
      label: 'Audio spectrogram',
      frames: mockFrames,
    });

    const cells = container.querySelectorAll('.cinder-spectrogram__cell');
    // 4 frames × 6 bins = 24 cells
    expect(cells.length).toBe(24);
  });

  test('renders accessible SVG title when data is present', () => {
    const { container } = render(Spectrogram, {
      label: 'Audio spectrogram',
      frames: mockFrames,
    });

    const svgTitle = container.querySelector('svg > title');
    expect(svgTitle?.textContent).toBe('Audio spectrogram');
    expect(container.querySelector('svg')?.getAttribute('aria-labelledby')).toBeTruthy();
  });

  test('SVG is aria-hidden when loading', () => {
    const { container } = render(Spectrogram, {
      label: 'Loading spectrogram',
      loading: true,
      frames: [],
    });

    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('svg > title')).toBeNull();
  });

  test('does not draw the heatmap under the loading overlay when frames are present', () => {
    // frames may be present while loading — the cells/labels must stay hidden
    // until loading ends, rather than drawing under the loading overlay.
    const { container } = render(Spectrogram, {
      label: 'Loading spectrogram',
      loading: true,
      frames: mockFrames,
    });
    expect(container.querySelectorAll('.cinder-spectrogram__cell').length).toBe(0);
    expect(container.querySelectorAll('.cinder-spectrogram__tick-label').length).toBe(0);
  });

  test('shows loading state', () => {
    const { getByText } = render(Spectrogram, {
      label: 'Loading spectrogram',
      loading: true,
      frames: [],
    });

    expect(getByText('Loading…')).toBeTruthy();
  });

  test('shows empty state when frames array is empty', () => {
    const { getByText, container } = render(Spectrogram, {
      label: 'Empty spectrogram',
      frames: [],
    });

    expect(getByText('No spectrogram data')).toBeTruthy();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  test('renders accessible data table when dataTableVisibility is visible', () => {
    const { container } = render(Spectrogram, {
      label: 'Audio spectrogram',
      frames: mockFrames,
      dataTableVisibility: 'visible',
    });

    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('caption')?.textContent).toBe('Audio spectrogram');
  });

  test('hides data table when dataTableVisibility is hidden', () => {
    const { container } = render(Spectrogram, {
      label: 'Audio spectrogram',
      frames: mockFrames,
      dataTableVisibility: 'hidden',
    });

    expect(container.querySelector('table')).toBeNull();
  });

  test('uses screen-reader-only class by default', () => {
    const { container } = render(Spectrogram, {
      label: 'Audio spectrogram',
      frames: mockFrames,
    });

    expect(container.querySelector('table.cinder-sr-only')).not.toBeNull();
  });

  test('renders frequency labels on y-axis when provided', () => {
    const { getAllByText } = render(Spectrogram, {
      label: 'Audio spectrogram',
      frames: mockFrames,
      frequencyLabels: ['100 Hz', '200 Hz', '400 Hz', '800 Hz', '1.6 kHz', '3.2 kHz'],
    });

    expect(getAllByText('100 Hz').length).toBeGreaterThan(0);
  });

  test('uses numeric bin indices for y-axis when frequencyLabels is omitted', () => {
    const { getAllByText } = render(Spectrogram, {
      label: 'Audio spectrogram',
      frames: mockFrames,
    });

    // Bin indices 0-5 appear as y-axis labels
    expect(getAllByText('0').length).toBeGreaterThan(0);
  });

  test('uses custom dataTableCaption when provided', () => {
    const { container } = render(Spectrogram, {
      label: 'Audio spectrogram',
      frames: mockFrames,
      dataTableVisibility: 'visible',
      dataTableCaption: 'Spectrogram data table',
    });

    expect(container.querySelector('caption')?.textContent).toBe('Spectrogram data table');
  });

  test('table rows use frequency labels as row headers when provided', () => {
    const { container } = render(Spectrogram, {
      label: 'Audio spectrogram',
      frames: mockFrames,
      frequencyLabels: ['100 Hz', '200 Hz', '400 Hz', '800 Hz', '1.6 kHz', '3.2 kHz'],
      dataTableVisibility: 'visible',
    });

    const rowHeaders = [...container.querySelectorAll('tbody th[scope="row"]')];
    // The table lists bins top-to-bottom to MATCH the visual (bin 0 / lowest
    // frequency at the BOTTOM), so the first row is the highest bin and the last
    // row is the lowest.
    expect(rowHeaders[0]?.textContent).toBe('3.2 kHz');
    expect(rowHeaders[rowHeaders.length - 1]?.textContent).toBe('100 Hz');
  });

  test('renders a full rectangular grid for ragged frames (no overflow, missing cells)', () => {
    const { container } = render(Spectrogram, {
      label: 'Ragged',
      frames: [
        { label: 'a', bins: [0.2, 0.4] },
        { label: 'b', bins: [0.5, 0.6, 0.7, 0.8] }, // longer frame sets binCount=4
      ],
    });
    // 2 frames × max binCount 4 = 8 cells (short frame's missing cells still drawn).
    expect(container.querySelectorAll('.cinder-spectrogram__cell').length).toBe(8);
  });

  test('treats zero-bin frames as empty', () => {
    const { container } = render(Spectrogram, {
      label: 'No bins',
      frames: [{ label: '0 ms', bins: [] }],
    });
    expect(container.querySelector('.cinder-spectrogram__state')?.textContent).toContain(
      'No spectrogram data',
    );
    expect(container.querySelectorAll('.cinder-spectrogram__cell').length).toBe(0);
  });

  test('low-frequency bin 0 renders below high-frequency bins (audio Y orientation)', () => {
    const { container } = render(Spectrogram, {
      label: 'Orientation',
      frames: [{ label: 't', bins: [0.1, 0.9] }], // bin 0 low, bin 1 high
      height: 200,
    });
    const cells = [...container.querySelectorAll<SVGRectElement>('.cinder-spectrogram__cell')];
    // bin 0 (first cell) should have a LARGER y (lower on screen) than bin 1.
    const y0 = Number(cells[0]?.getAttribute('y'));
    const y1 = Number(cells[1]?.getAttribute('y'));
    expect(y0).toBeGreaterThan(y1);
  });

  test('non-finite cell values render as missing without invalid geometry', () => {
    const { container } = render(Spectrogram, {
      label: 'Glitchy',
      frames: [{ label: 't', bins: [NaN, 0.5, Infinity] }],
      dataTableVisibility: 'visible',
    });
    for (const cell of container.querySelectorAll<SVGRectElement>('.cinder-spectrogram__cell')) {
      expect(Number.isFinite(Number(cell.getAttribute('y')))).toBe(true);
      expect(cell.getAttribute('fill') ?? '').not.toContain('NaN');
    }
    // The data table shows the missing marker for non-finite cells.
    expect(container.querySelector('tbody')?.textContent).toContain('—');
  });

  test('the SVG exposes role="img"', () => {
    const { container } = render(Spectrogram, { label: 'Spectrogram', frames: mockFrames });
    expect(container.querySelector('svg')?.getAttribute('role')).toBe('img');
  });

  test('a partial frequencyLabels list is honoured per-index (not discarded)', () => {
    const { container } = render(Spectrogram, {
      label: 'Partial labels',
      frames: [{ label: 't', bins: [0.1, 0.2, 0.3] }], // 3 bins
      frequencyLabels: ['Low', 'Mid'], // only 2 labels provided
      dataTableVisibility: 'visible',
    });
    const rowHeaders = [...container.querySelectorAll('tbody th[scope="row"]')].map(
      (th) => th.textContent,
    );
    // Provided labels used where present; the third bin falls back to its index.
    expect(rowHeaders).toContain('Low');
    expect(rowHeaders).toContain('Mid');
    expect(rowHeaders).toContain('2');
  });

  test('caps and samples the primary plot instead of an unbounded frame*bin grid (#1186 row 11)', () => {
    const frameCount = 401;
    const binCount = 257;
    const denseFrames = Array.from({ length: frameCount }, (_, frameIndex) => ({
      label: `frame-${frameIndex}`,
      bins: Array.from({ length: binCount }, (_, binIndex) => ((frameIndex + binIndex) % 10) / 10),
    }));

    const { container } = render(Spectrogram, {
      label: 'Dense spectrogram',
      frames: denseFrames,
    });

    const maxPlotFrames = 400;
    const maxPlotBins = 256;
    const frameStep = Math.max(1, Math.ceil(frameCount / maxPlotFrames));
    const binStep = Math.max(1, Math.ceil(binCount / maxPlotBins));
    const expectedCellCount = Math.ceil(frameCount / frameStep) * Math.ceil(binCount / binStep);

    const cells = container.querySelectorAll('.cinder-spectrogram__cell');
    expect(cells.length).toBe(expectedCellCount);
    expect(cells.length).toBeLessThanOrEqual(maxPlotFrames * maxPlotBins);

    const plotFrameCount = Math.ceil(frameCount / frameStep);
    const plotBinCount = Math.ceil(binCount / binStep);
    const firstFrameCells = [...cells].slice(0, plotBinCount) as SVGRectElement[];
    const frameBuckets = Array.from({ length: plotFrameCount }, (_, frameIndex) =>
      cells.item(frameIndex * plotBinCount),
    );

    for (let index = 1; index < frameBuckets.length; index += 1) {
      const previous = frameBuckets[index - 1]!;
      const current = frameBuckets[index]!;
      expect(Number(current.getAttribute('x'))).toBeCloseTo(
        Number(previous.getAttribute('x')) + Number(previous.getAttribute('width')),
      );
    }

    const binsFromTop = [...firstFrameCells].sort(
      (left, right) => Number(left.getAttribute('y')) - Number(right.getAttribute('y')),
    );
    expect(Number(binsFromTop[0]?.getAttribute('y'))).toBeCloseTo(0);
    for (let index = 1; index < binsFromTop.length; index += 1) {
      const previous = binsFromTop[index - 1]!;
      const current = binsFromTop[index]!;
      expect(Number(current.getAttribute('y'))).toBeCloseTo(
        Number(previous.getAttribute('y')) + Number(previous.getAttribute('height')),
      );
    }
  });

  test('sampled plot buckets preserve a high-intensity value beyond the first source cell', () => {
    const frameCount = 401;
    const binCount = 257;
    const denseFrames = Array.from({ length: frameCount }, (_, frameIndex) => ({
      label: `frame-${frameIndex}`,
      bins: Array.from({ length: binCount }, (_, binIndex) =>
        frameIndex === 1 && binIndex === 1 ? 1 : 0,
      ),
    }));

    const { container } = render(Spectrogram, {
      label: 'Transient spectrogram',
      frames: denseFrames,
    });

    // frame 1/bin 1 is covered by the first frame/bin bucket, but is not its
    // first source cell. Maximum aggregation must preserve its full intensity.
    const firstCell = container.querySelector<SVGRectElement>('.cinder-spectrogram__cell');
    expect(firstCell?.getAttribute('fill')).toContain('100%');
  });
});
