/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Source: packages/components/src/tokens/cinder.resolver.json (the
 * foundation set's com.lostgradient.cinder.playgroundGroups extension).
 * Regenerate: bun run --filter=@lostgradient/cinder tokens:generate
 */

export type ColorToken = {
  name: string;
  label: string;
};

export type ColorTokenGroup = {
  id: string;
  label: string;
  tokens: readonly ColorToken[];
};

export const COLOR_TOKEN_GROUPS = [
  {
    id: 'accent',
    label: 'Accent',
    tokens: [
      { name: '--cinder-accent', label: 'Accent fill' },
      { name: '--cinder-accent-contrast', label: 'Accent contrast' },
      { name: '--cinder-accent-text', label: 'Accent text' },
      { name: '--cinder-accent-text-hover', label: 'Accent text hover' },
      { name: '--cinder-accent-hover', label: 'Accent fill hover' },
      { name: '--cinder-accent-active', label: 'Accent fill active' },
      { name: '--cinder-accent-active-on-fill', label: 'Accent active on fill' },
    ],
  },
  {
    id: 'status-solid',
    label: 'Status Solids',
    tokens: [
      { name: '--cinder-info', label: 'Info' },
      { name: '--cinder-success', label: 'Success' },
      { name: '--cinder-warning', label: 'Warning' },
      { name: '--cinder-danger', label: 'Danger' },
      { name: '--cinder-info-contrast', label: 'Info contrast' },
      { name: '--cinder-success-contrast', label: 'Success contrast' },
      { name: '--cinder-warning-contrast', label: 'Warning contrast' },
      { name: '--cinder-danger-contrast', label: 'Danger contrast' },
      { name: '--cinder-danger-hover', label: 'Danger hover' },
      { name: '--cinder-danger-active', label: 'Danger active' },
      { name: '--cinder-info-hover', label: 'Info hover' },
      { name: '--cinder-info-active', label: 'Info active' },
      { name: '--cinder-success-hover', label: 'Success hover' },
      { name: '--cinder-success-active', label: 'Success active' },
      { name: '--cinder-warning-hover', label: 'Warning hover' },
      { name: '--cinder-warning-active', label: 'Warning active' },
    ],
  },
  {
    id: 'charts',
    label: 'Chart Series',
    tokens: [
      { name: '--cinder-chart-series-1', label: 'Series 1' },
      { name: '--cinder-chart-series-2', label: 'Series 2' },
      { name: '--cinder-chart-series-3', label: 'Series 3' },
      { name: '--cinder-chart-series-4', label: 'Series 4' },
      { name: '--cinder-chart-series-5', label: 'Series 5' },
      { name: '--cinder-chart-series-6', label: 'Series 6' },
      { name: '--cinder-chart-series-7', label: 'Series 7' },
      { name: '--cinder-chart-series-8', label: 'Series 8' },
    ],
  },
  {
    id: 'status-triples',
    label: 'Status Surfaces',
    tokens: [
      { name: '--cinder-color-info-bg', label: 'Info background' },
      { name: '--cinder-color-info-fg', label: 'Info foreground' },
      { name: '--cinder-color-info-border', label: 'Info border' },
      { name: '--cinder-color-success-bg', label: 'Success background' },
      { name: '--cinder-color-success-fg', label: 'Success foreground' },
      { name: '--cinder-color-success-border', label: 'Success border' },
      { name: '--cinder-color-warning-bg', label: 'Warning background' },
      { name: '--cinder-color-warning-fg', label: 'Warning foreground' },
      { name: '--cinder-color-warning-border', label: 'Warning border' },
      { name: '--cinder-color-danger-bg', label: 'Danger background' },
      { name: '--cinder-color-danger-fg', label: 'Danger foreground' },
      { name: '--cinder-color-danger-border', label: 'Danger border' },
      { name: '--cinder-color-neutral-bg', label: 'Neutral background' },
      { name: '--cinder-color-neutral-fg', label: 'Neutral foreground' },
      { name: '--cinder-color-neutral-border', label: 'Neutral border' },
      { name: '--cinder-color-accent-bg', label: 'Accent background' },
      { name: '--cinder-color-accent-fg', label: 'Accent foreground' },
      { name: '--cinder-color-accent-border', label: 'Accent border' },
      { name: '--cinder-color-info-muted', label: 'Muted info' },
      { name: '--cinder-color-info-subtle', label: 'Subtle info' },
      { name: '--cinder-color-success-muted', label: 'Muted success' },
      { name: '--cinder-color-success-subtle', label: 'Subtle success' },
      { name: '--cinder-color-warning-muted', label: 'Muted warning' },
      { name: '--cinder-color-warning-subtle', label: 'Subtle warning' },
      { name: '--cinder-color-danger-muted', label: 'Muted danger' },
      { name: '--cinder-color-danger-subtle', label: 'Subtle danger' },
    ],
  },
  {
    id: 'surfaces',
    label: 'Surfaces',
    tokens: [
      { name: '--cinder-bg', label: 'Page background' },
      { name: '--cinder-surface', label: 'Surface' },
      { name: '--cinder-surface-raised', label: 'Raised surface' },
      { name: '--cinder-surface-raised-hover', label: 'Raised surface hover' },
      { name: '--cinder-surface-raised-pressed', label: 'Raised surface pressed' },
      { name: '--cinder-surface-inset', label: 'Inset surface' },
      { name: '--cinder-surface-hover', label: 'Surface hover' },
      { name: '--cinder-surface-pressed', label: 'Surface pressed' },
      { name: '--cinder-surface-inverse', label: 'Inverse surface' },
    ],
  },
  {
    id: 'text',
    label: 'Text and Disabled Fill',
    tokens: [
      { name: '--cinder-text', label: 'Text' },
      { name: '--cinder-text-muted', label: 'Muted text' },
      { name: '--cinder-text-subtle', label: 'Subtle text' },
      { name: '--cinder-text-disabled', label: 'Disabled text' },
      { name: '--cinder-fill-disabled', label: 'Disabled fill' },
      { name: '--cinder-text-inverse', label: 'Inverse text' },
    ],
  },
  {
    id: 'borders',
    label: 'Borders',
    tokens: [
      { name: '--cinder-border', label: 'Border' },
      { name: '--cinder-border-faint', label: 'Faint border' },
      { name: '--cinder-border-muted', label: 'Muted border' },
      { name: '--cinder-border-strong', label: 'Strong border' },
      { name: '--cinder-border-inverse', label: 'Inverse border' },
    ],
  },
  {
    id: 'focus',
    label: 'Focus Ring',
    tokens: [
      { name: '--cinder-ring-offset-color', label: 'Ring offset color' },
      { name: '--cinder-ring-color', label: 'Ring color' },
      { name: '--cinder-ring-on-accent', label: 'Ring on accent' },
    ],
  },
  {
    id: 'overlay',
    label: 'Overlay',
    tokens: [{ name: '--cinder-overlay-backdrop', label: 'Backdrop' }],
  },
  {
    id: 'scrollbars',
    label: 'Scrollbars',
    tokens: [
      { name: '--cinder-scrollbar-track', label: 'Track' },
      { name: '--cinder-scrollbar-thumb', label: 'Thumb' },
      { name: '--cinder-scrollbar-thumb-hover', label: 'Thumb hover' },
    ],
  },
] as const;
