/**
 * The token pairing table: which foreground token is painted on which background token, how
 * the pairing is classified, and which rule scope owns its threshold.
 *
 * It is declarative data. The Cinder contrast suites and the theme builder's accessibility
 * engine both read it, so a pairing is added in one place. A pairing names CSS custom
 * properties because that is what a context's property map is keyed by; the registry maps them
 * to token paths.
 */

import { DECORATIVE_BORDER, FAINT_BORDER, type ContrastClassification } from './thresholds.ts';

/** `wcag` pairings set a normative threshold; `cinder-advisory` ones are Cinder's stricter floors. */
export type PairingScope = 'wcag' | 'cinder-advisory';

export type PairingGroup =
  | 'text'
  | 'accent'
  | 'status'
  | 'severity'
  | 'terminal'
  | 'focus'
  | 'control-border'
  | 'chart'
  | 'decorative-border'
  | 'polarity'
  | 'disabled';

export type ContrastPairing = {
  /** Stable across releases; findings key on it. */
  id: string;
  group: PairingGroup;
  classification: ContrastClassification;
  scope: PairingScope;
  /** WCAG success criterion the pairing is evidence for, when it has one. */
  criterion: '1.4.3' | '1.4.11' | null;
  foreground: string;
  background: string;
  /** What a translucent background is painted over. Required when `background` has alpha. */
  backdrop?: string;
  /** A number property multiplying the foreground's alpha (the disabled opacity). */
  opacity?: string;
  /** Cinder's floor for an advisory pairing. WCAG pairings take theirs from the classification. */
  advisoryFloor?: number;
  description: string;
};

export const SURFACE_PROPERTIES = [
  '--cinder-surface-canvas',
  '--cinder-surface',
  '--cinder-surface-raised',
  '--cinder-surface-inset',
] as const;

const SURFACE_LABELS: Record<(typeof SURFACE_PROPERTIES)[number], string> = {
  '--cinder-surface-canvas': 'canvas',
  '--cinder-surface': 'surface',
  '--cinder-surface-raised': 'raised',
  '--cinder-surface-inset': 'inset',
};

export const STATUSES = ['info', 'success', 'warning', 'danger'] as const;
export const ANSI_COLORS = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'bright-black',
  'bright-red',
  'bright-green',
  'bright-yellow',
  'bright-blue',
  'bright-magenta',
  'bright-cyan',
  'bright-white',
] as const;
export const CHART_SERIES_COUNT = 8;

const onSurfaces = (
  idPrefix: string,
  foreground: string,
  base: Omit<ContrastPairing, 'id' | 'foreground' | 'background' | 'backdrop' | 'description'>,
  description: string,
): ContrastPairing[] =>
  SURFACE_PROPERTIES.map((surface) => ({
    ...base,
    id: `${idPrefix}:${SURFACE_LABELS[surface]}`,
    foreground,
    background: surface,
    description: `${description} on ${SURFACE_LABELS[surface]}`,
  }));

const text = (
  group: PairingGroup,
  scope: PairingScope = 'wcag',
): Pick<ContrastPairing, 'group' | 'classification' | 'scope' | 'criterion'> => ({
  group,
  classification: 'text',
  scope,
  criterion: scope === 'wcag' ? '1.4.3' : null,
});

function statusPairings(): ContrastPairing[] {
  const pairings: ContrastPairing[] = [
    {
      id: 'status:neutral:text',
      ...text('status'),
      foreground: '--cinder-status-neutral-text',
      background: '--cinder-status-neutral-background',
      description: 'Neutral status text on its background',
    },
  ];
  for (const status of STATUSES) {
    const prefix = `--cinder-status-${status}`;
    pairings.push({
      id: `status:${status}:text`,
      ...text('status'),
      foreground: `${prefix}-text`,
      background: `${prefix}-background`,
      description: `${status} status text on its background`,
    });
    for (const state of ['solid', 'solid-hover', 'solid-active'] as const) {
      pairings.push({
        id: `status:${status}:contrast:${state}`,
        ...text('status'),
        foreground: `${prefix}-contrast`,
        background: `${prefix}-${state}`,
        description: `${status} label on the ${state} fill`,
      });
    }
  }
  return pairings;
}

function decorativePairings(): ContrastPairing[] {
  const advisory = (floor: number, group: PairingGroup = 'decorative-border') => ({
    group,
    classification: 'decorative-separator' as const,
    scope: 'cinder-advisory' as const,
    criterion: null,
    advisoryFloor: floor,
  });
  const pairings: ContrastPairing[] = [
    ...onSurfaces(
      'border:muted',
      '--cinder-border-muted',
      advisory(DECORATIVE_BORDER),
      'Muted border',
    ),
    ...onSurfaces('border:faint', '--cinder-border-faint', advisory(FAINT_BORDER), 'Faint border'),
    {
      id: 'border:accent',
      ...advisory(DECORATIVE_BORDER, 'accent'),
      foreground: '--cinder-accent-border',
      background: '--cinder-accent-background',
      description: 'Accent border on the accent background',
    },
    {
      id: 'border:neutral-status',
      ...advisory(DECORATIVE_BORDER, 'status'),
      foreground: '--cinder-status-neutral-border',
      background: '--cinder-status-neutral-background',
      description: 'Neutral status border on its background',
    },
  ];
  for (const status of STATUSES) {
    pairings.push({
      id: `border:${status}-status`,
      ...advisory(DECORATIVE_BORDER, 'status'),
      foreground: `--cinder-status-${status}-border`,
      background: `--cinder-status-${status}-background`,
      description: `${status} status border on its background`,
    });
  }
  return pairings;
}

/*
 * `--cinder-accent-solid-active` is deliberately not paired with the accent label: Cinder's buttons
 * paint the pressed fill with `--cinder-accent-solid-active-on-fill` instead, because the general
 * active tone drops the label below 4.5:1 in the dark arm.
 */
export const CONTRAST_PAIRINGS: readonly ContrastPairing[] = [
  ...onSurfaces('text:default', '--cinder-text-default', text('text'), 'Default text'),
  ...onSurfaces('text:muted', '--cinder-text-muted', text('text'), 'Muted text'),
  ...['--cinder-surface', '--cinder-surface-canvas', '--cinder-surface-inset'].map(
    (background): ContrastPairing => ({
      id: `accent:text:${background.replace('--cinder-', '')}`,
      ...text('accent'),
      foreground: '--cinder-accent-text',
      background,
      description: `Accent text on ${background.replace('--cinder-', '')}`,
    }),
  ),
  ...(['solid', 'solid-hover', 'solid-active-on-fill'] as const).map((state): ContrastPairing => ({
    id: `accent:contrast:${state}`,
    ...text('accent'),
    foreground: '--cinder-accent-contrast',
    background: `--cinder-accent-${state}`,
    description: `Accent label on the ${state} fill`,
  })),
  {
    id: 'accent:soft:text',
    ...text('accent'),
    foreground: '--cinder-accent-text',
    background: '--cinder-accent-background',
    description: 'Accent text on the soft accent background',
  },
  ...statusPairings(),
  {
    id: 'severity:critical',
    ...text('severity'),
    foreground: '--cinder-severity-critical',
    background: '--cinder-severity-critical-background',
    description: 'Critical severity text on its background',
  },
  {
    id: 'text:status-dot',
    ...text('text'),
    foreground: '--cinder-status-dot-color',
    background: '--cinder-surface-inset',
    description: 'Status dot color on the inset surface',
  },
  {
    id: 'text:toc-link',
    ...text('text'),
    foreground: '--cinder-table-of-contents-link-color',
    background: '--cinder-surface-canvas',
    description: 'Table of contents link on the canvas',
  },
  {
    id: 'text:toc-link-active',
    ...text('text'),
    foreground: '--cinder-table-of-contents-link-active-color',
    background: '--cinder-surface-hover',
    description: 'Active table of contents link on a hovered surface',
  },
  ...ANSI_COLORS.map((name): ContrastPairing => ({
    id: `terminal:ansi:${name}`,
    ...text('terminal'),
    foreground: `--cinder-terminal-ansi-${name}`,
    background: '--cinder-surface-inset',
    description: `Terminal ${name} on the inset surface`,
  })),
  ...(['--cinder-surface-canvas', '--cinder-surface'] as const).map(
    (background): ContrastPairing => ({
      id: `focus:ring:${SURFACE_LABELS[background]}`,
      group: 'focus',
      classification: 'non-text-indicator',
      scope: 'wcag',
      criterion: '1.4.11',
      foreground: '--cinder-ring-color',
      background,
      description: `Focus ring against ${SURFACE_LABELS[background]}`,
    }),
  ),
  ...onSurfaces(
    'border:control',
    '--cinder-border',
    {
      group: 'control-border',
      classification: 'non-text-indicator',
      scope: 'wcag',
      criterion: '1.4.11',
    },
    'Control border',
  ),
  ...onSurfaces(
    'border:strong',
    '--cinder-border-strong',
    {
      group: 'control-border',
      classification: 'non-text-indicator',
      scope: 'wcag',
      criterion: '1.4.11',
    },
    'Strong control border',
  ),
  ...Array.from({ length: CHART_SERIES_COUNT }, (_, index): ContrastPairing[] =>
    (['--cinder-surface-canvas', '--cinder-surface'] as const).map((background) => ({
      id: `chart:series-${index + 1}:${SURFACE_LABELS[background]}`,
      group: 'chart',
      classification: 'non-text-indicator',
      scope: 'wcag',
      criterion: '1.4.11',
      foreground: `--cinder-chart-series-${index + 1}`,
      background,
      description: `Chart series ${index + 1} against ${SURFACE_LABELS[background]}`,
    })),
  ).flat(),
  ...onSurfaces(
    'polarity-ink',
    '--cinder-polarity-ink',
    { ...text('polarity', 'cinder-advisory'), advisoryFloor: 4.5 },
    'Polarity ink',
  ),
  ...decorativePairings(),
  ...onSurfaces(
    'disabled:text',
    '--cinder-text-disabled',
    {
      group: 'disabled',
      classification: 'disabled',
      scope: 'wcag',
      criterion: null,
    },
    'Disabled text',
  ),
  {
    id: 'disabled:opacity',
    group: 'disabled',
    classification: 'disabled',
    scope: 'wcag',
    criterion: null,
    foreground: '--cinder-text-default',
    background: '--cinder-surface',
    opacity: '--cinder-opacity-disabled',
    description: 'Default text dimmed by the disabled opacity',
  },
];
