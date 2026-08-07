import { expect, test } from 'bun:test';

import type {
  AreaChartDataTableVisibility,
  BarChartDataTableVisibility,
  FeedBoundaryProps,
  FeedConnectionState,
  LineChartDataTableVisibility,
  MatrixChartDataTableVisibility,
  PopoverFocusManagement,
  PopoverWidthMode,
  ResizablePanelSizeUnit,
  RunStepLink,
  SegmentCurrentToken,
  SpectrogramDataTableVisibility,
  SpectrumChartDataTableVisibility,
  TreeItemSelectionState,
  TreeReorderTarget,
  WaveformDataTableVisibility,
} from './index.ts';

test('root barrel exposes Stardust agent-ops public helper types', () => {
  const boundaryProps: FeedBoundaryProps = {
    label: 'Reconnected — 2 events replayed',
    datetime: '2026-06-24T12:00:00.000Z',
  };
  const connectionState: FeedConnectionState = 'connected';
  const link: RunStepLink = {
    href: '/runs/run-123',
    label: 'Open run',
  };

  expect(boundaryProps.label).toContain('Reconnected');
  expect(connectionState).toBe('connected');
  expect(link.label).toBe('Open run');
});

test('root barrel exposes the five component barrel-gap public types', () => {
  const focusManagement: PopoverFocusManagement = 'panel';
  const widthMode: PopoverWidthMode = 'content';
  const currentToken: SegmentCurrentToken = 'page';
  const sizeUnit: ResizablePanelSizeUnit = 'px';
  const reorderTarget: TreeReorderTarget = {
    id: '1',
    position: 'before',
    fromParentId: null,
    toParentId: null,
  };
  const selectionState: TreeItemSelectionState = { checked: true, indeterminate: false };

  expect(focusManagement).toBe('panel');
  expect(widthMode).toBe('content');
  expect(currentToken).toBe('page');
  expect(sizeUnit).toBe('px');
  expect(reorderTarget.position).toBe('before');
  expect(selectionState.checked).toBe(true);
});

test('root barrel exposes ChartDataTableVisibility from all seven chart component barrels', () => {
  const areaChart: AreaChartDataTableVisibility = 'visible';
  const barChart: BarChartDataTableVisibility = 'hidden';
  const lineChart: LineChartDataTableVisibility = 'screen-reader-only';
  const matrixChart: MatrixChartDataTableVisibility = 'visible';
  const spectrogram: SpectrogramDataTableVisibility = 'hidden';
  const spectrumChart: SpectrumChartDataTableVisibility = 'screen-reader-only';
  const waveform: WaveformDataTableVisibility = 'visible';

  expect(areaChart).toBe('visible');
  expect(barChart).toBe('hidden');
  expect(lineChart).toBe('screen-reader-only');
  expect(matrixChart).toBe('visible');
  expect(spectrogram).toBe('hidden');
  expect(spectrumChart).toBe('screen-reader-only');
  expect(waveform).toBe('visible');
});
