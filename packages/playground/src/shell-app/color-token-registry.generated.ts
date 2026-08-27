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
      { name: '--cinder-accent-solid', label: 'Accent fill' },
      { name: '--cinder-accent-contrast', label: 'Accent contrast' },
      { name: '--cinder-accent-text', label: 'Accent text' },
      { name: '--cinder-accent-text-hover', label: 'Accent text hover' },
      { name: '--cinder-accent-solid-hover', label: 'Accent fill hover' },
      { name: '--cinder-accent-solid-active', label: 'Accent fill active' },
      { name: '--cinder-accent-solid-active-on-fill', label: 'Accent active on fill' },
    ],
  },
  {
    id: 'status-solid',
    label: 'Status Solids',
    tokens: [
      { name: '--cinder-status-info-solid', label: 'Info' },
      { name: '--cinder-status-success-solid', label: 'Success' },
      { name: '--cinder-status-warning-solid', label: 'Warning' },
      { name: '--cinder-status-danger-solid', label: 'Danger' },
      { name: '--cinder-status-info-contrast', label: 'Info contrast' },
      { name: '--cinder-status-success-contrast', label: 'Success contrast' },
      { name: '--cinder-status-warning-contrast', label: 'Warning contrast' },
      { name: '--cinder-status-danger-contrast', label: 'Danger contrast' },
      { name: '--cinder-status-danger-solid-hover', label: 'Danger hover' },
      { name: '--cinder-status-danger-solid-active', label: 'Danger active' },
      { name: '--cinder-status-info-solid-hover', label: 'Info hover' },
      { name: '--cinder-status-info-solid-active', label: 'Info active' },
      { name: '--cinder-status-success-solid-hover', label: 'Success hover' },
      { name: '--cinder-status-success-solid-active', label: 'Success active' },
      { name: '--cinder-status-warning-solid-hover', label: 'Warning hover' },
      { name: '--cinder-status-warning-solid-active', label: 'Warning active' },
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
      { name: '--cinder-status-info-background', label: 'Info background' },
      { name: '--cinder-status-info-text', label: 'Info foreground' },
      { name: '--cinder-status-info-border', label: 'Info border' },
      { name: '--cinder-status-success-background', label: 'Success background' },
      { name: '--cinder-status-success-text', label: 'Success foreground' },
      { name: '--cinder-status-success-border', label: 'Success border' },
      { name: '--cinder-status-warning-background', label: 'Warning background' },
      { name: '--cinder-status-warning-text', label: 'Warning foreground' },
      { name: '--cinder-status-warning-border', label: 'Warning border' },
      { name: '--cinder-status-danger-background', label: 'Danger background' },
      { name: '--cinder-status-danger-text', label: 'Danger foreground' },
      { name: '--cinder-status-danger-border', label: 'Danger border' },
      { name: '--cinder-status-neutral-background', label: 'Neutral background' },
      { name: '--cinder-status-neutral-text', label: 'Neutral foreground' },
      { name: '--cinder-status-neutral-border', label: 'Neutral border' },
      { name: '--cinder-accent-background', label: 'Accent background' },
      { name: '--cinder-accent-border', label: 'Accent border' },
      { name: '--cinder-status-info-muted', label: 'Muted info' },
      { name: '--cinder-status-info-subtle', label: 'Subtle info' },
      { name: '--cinder-status-success-muted', label: 'Muted success' },
      { name: '--cinder-status-success-subtle', label: 'Subtle success' },
      { name: '--cinder-status-warning-muted', label: 'Muted warning' },
      { name: '--cinder-status-warning-subtle', label: 'Subtle warning' },
      { name: '--cinder-status-danger-muted', label: 'Muted danger' },
      { name: '--cinder-status-danger-subtle', label: 'Subtle danger' },
    ],
  },
  {
    id: 'surfaces',
    label: 'Surfaces',
    tokens: [
      { name: '--cinder-surface-canvas', label: 'Page background' },
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
      { name: '--cinder-text-default', label: 'Text' },
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
