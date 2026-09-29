import { expect, expectTypeOf, test } from 'bun:test';

import { isRedispatchedPortaledEvent as ownedPortalEventPredicate } from './components/portal/index.ts';
import {
  createBodyScrollLock,
  isRedispatchedPortaledEvent,
  Toolbar,
  ToolbarGroup,
  ToolbarSpacer,
} from './index.ts';
import { createBodyScrollLock as ownedBodyScrollLock } from './utilities/attachments.ts';

import type {
  AreaChartDataTableVisibility,
  BarChartDataTableVisibility,
  FeedBoundaryProps,
  FeedConnectionState,
  FormFieldManaged,
  LineChartDataTableVisibility,
  MatrixChartDataTableVisibility,
  MeterVerdict,
  MeterVerdictLevel,
  PopoverFocusManagement,
  PopoverWidthMode,
  ResizablePanelSizeUnit,
  RunStepLink,
  SegmentCurrentToken,
  SpectrogramDataTableVisibility,
  SpectrumChartDataTableVisibility,
  SpinnerVariant,
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

test('root barrel exposes standalone-component foundation public types', () => {
  const managed: FormFieldManaged = { by: 'Organization policy' };
  const verdictLevel: MeterVerdictLevel = 'unknown';
  const verdict: MeterVerdict = { level: verdictLevel, label: 'Awaiting estimate' };
  const spinnerVariant: SpinnerVariant = 'arc';

  expect(managed.by).toBe('Organization policy');
  expect(verdict.label).toBe('Awaiting estimate');
  expect(spinnerVariant).toBe('arc');
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

// These are authored component contracts, available through the sole package entry.
test('root exports retain the component contract types formerly exposed through subpaths', () => {
  expectTypeOf<import('./index.ts').JsonLint>().toEqualTypeOf<
    import('./components/json-editor/json-editor-enhancement.ts').JsonLint
  >();
  expectTypeOf<import('./index.ts').CarouselSlideContext>().toEqualTypeOf<
    import('./components/carousel/index.ts').CarouselSlideContext
  >();
  expectTypeOf<import('./index.ts').ConnectionIndicatorSchemaProps>().toEqualTypeOf<
    import('./components/connection-indicator/index.ts').ConnectionIndicatorSchemaProps
  >();
  expectTypeOf<import('./index.ts').DataGridSelectionMode>().toEqualTypeOf<
    import('./components/data-grid/index.ts').DataGridSelectionMode
  >();
  expectTypeOf<import('./index.ts').DataGridSelectionModel>().toEqualTypeOf<
    import('./components/data-grid/index.ts').DataGridSelectionModel
  >();
  expectTypeOf<import('./index.ts').DescriptionListDefinition>().toEqualTypeOf<
    import('./components/description-list/index.ts').DescriptionListDefinition
  >();
  expectTypeOf<import('./index.ts').InvocationRuleBuilderSchemaProps>().toEqualTypeOf<
    import('./components/invocation-rule-builder/index.ts').InvocationRuleBuilderSchemaProps
  >();
  expectTypeOf<import('./index.ts').KbdSize>().toEqualTypeOf<
    import('./components/kbd/index.ts').KbdSize
  >();
  expectTypeOf<import('./index.ts').PayloadInspectorSchemaProps>().toEqualTypeOf<
    import('./components/payload-inspector/index.ts').PayloadInspectorSchemaProps
  >();
  expectTypeOf<import('./index.ts').PayloadInspectorSchemaValue>().toEqualTypeOf<
    import('./components/payload-inspector/index.ts').PayloadInspectorSchemaValue
  >();
  expectTypeOf<import('./index.ts').RunStepTimelineSchemaBranchGroup>().toEqualTypeOf<
    import('./components/run-step-timeline/index.ts').RunStepTimelineSchemaBranchGroup
  >();
  expectTypeOf<import('./index.ts').RunStepTimelineSchemaBranchLane>().toEqualTypeOf<
    import('./components/run-step-timeline/index.ts').RunStepTimelineSchemaBranchLane
  >();
  expectTypeOf<import('./index.ts').RunStepTimelineSchemaChildStep>().toEqualTypeOf<
    import('./components/run-step-timeline/index.ts').RunStepTimelineSchemaChildStep
  >();
  expectTypeOf<import('./index.ts').RunStepTimelineSchemaEntry>().toEqualTypeOf<
    import('./components/run-step-timeline/index.ts').RunStepTimelineSchemaEntry
  >();
  expectTypeOf<import('./index.ts').RunStepTimelineSchemaGrandchildStep>().toEqualTypeOf<
    import('./components/run-step-timeline/index.ts').RunStepTimelineSchemaGrandchildStep
  >();
  expectTypeOf<import('./index.ts').RunStepTimelineSchemaGreatGrandchildStep>().toEqualTypeOf<
    import('./components/run-step-timeline/index.ts').RunStepTimelineSchemaGreatGrandchildStep
  >();
  expectTypeOf<import('./index.ts').RunStepTimelineSchemaLaneStep>().toEqualTypeOf<
    import('./components/run-step-timeline/index.ts').RunStepTimelineSchemaLaneStep
  >();
  expectTypeOf<import('./index.ts').RunStepTimelineSchemaProps>().toEqualTypeOf<
    import('./components/run-step-timeline/index.ts').RunStepTimelineSchemaProps
  >();
  expectTypeOf<import('./index.ts').RunStepTimelineSchemaStep>().toEqualTypeOf<
    import('./components/run-step-timeline/index.ts').RunStepTimelineSchemaStep
  >();
  expectTypeOf<import('./index.ts').ScheduleBuilderSchemaProps>().toEqualTypeOf<
    import('./components/schedule-builder/index.ts').ScheduleBuilderSchemaProps
  >();
  expectTypeOf<import('./index.ts').ScheduleValueSchema>().toEqualTypeOf<
    import('./components/schedule-builder/index.ts').ScheduleValueSchema
  >();
  expectTypeOf<import('./index.ts').SliderRangeProps>().toEqualTypeOf<
    import('./components/slider/index.ts').SliderRangeProps
  >();
  expectTypeOf<import('./index.ts').SliderSingleProps>().toEqualTypeOf<
    import('./components/slider/index.ts').SliderSingleProps
  >();
  expectTypeOf<import('./index.ts').SpeedDialSchemaProps>().toEqualTypeOf<
    import('./components/speed-dial/index.ts').SpeedDialSchemaProps
  >();
  expectTypeOf<import('./index.ts').TimelineEntry>().toEqualTypeOf<
    import('./components/timeline/index.ts').TimelineEntry
  >();
  expectTypeOf<import('./index.ts').TimelineGroupBy>().toEqualTypeOf<
    import('./components/timeline/index.ts').TimelineGroupBy
  >();
  expectTypeOf<import('./index.ts').TimelineHeadingLevel>().toEqualTypeOf<
    import('./components/timeline/index.ts').TimelineHeadingLevel
  >();
  expectTypeOf<import('./index.ts').TimelineOrientation>().toEqualTypeOf<
    import('./components/timeline/index.ts').TimelineOrientation
  >();
  expectTypeOf<import('./index.ts').TimelineTone>().toEqualTypeOf<
    import('./components/timeline/index.ts').TimelineTone
  >();
  expectTypeOf<import('./index.ts').TimelineWeekStartsOn>().toEqualTypeOf<
    import('./components/timeline/index.ts').TimelineWeekStartsOn
  >();
  expectTypeOf<import('./index.ts').FlattenedTreeDataItem>().toEqualTypeOf<
    import('./components/tree/index.ts').FlattenedTreeDataItem
  >();
  expectTypeOf<import('./index.ts').TreeDataItem>().toEqualTypeOf<
    import('./components/tree/index.ts').TreeDataItem
  >();
  expectTypeOf<import('./index.ts').TreeExpandAllProps>().toEqualTypeOf<
    import('./components/tree/index.ts').TreeExpandAllProps
  >();
  expectTypeOf<import('./index.ts').TreeFilterPredicate>().toEqualTypeOf<
    import('./components/tree/index.ts').TreeFilterPredicate
  >();
  expectTypeOf<import('./index.ts').TreeRef>().toEqualTypeOf<
    import('./components/tree/index.ts').TreeRef
  >();
  expectTypeOf<import('./index.ts').TreeSelectAllProps>().toEqualTypeOf<
    import('./components/tree/index.ts').TreeSelectAllProps
  >();
  expectTypeOf<import('./index.ts').TreeVirtualizedItemRenderState>().toEqualTypeOf<
    import('./components/tree/index.ts').TreeVirtualizedItemRenderState
  >();
});

test('root exports expose the existing toolbar parts and DOM utility owners', () => {
  expect(ToolbarGroup).toBe(Toolbar.Group);
  expect(ToolbarSpacer).toBe(Toolbar.Spacer);
  expect(createBodyScrollLock).toBe(ownedBodyScrollLock);
  expect(isRedispatchedPortaledEvent).toBe(ownedPortalEventPredicate);
});
