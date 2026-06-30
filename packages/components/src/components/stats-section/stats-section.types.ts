import type { HTMLAttributes } from 'svelte/elements';
import type { ContainerMaxWidth } from '../container/container.types.ts';
import type { StatGroupColumns, StatGroupVariant } from '../stat-group/stat-group.types.ts';
import type { StatChangeDirection } from '../stat/stat.types.ts';

/** @schemaObject */
export type StatsSectionItem = {
  /** Metric label text. */
  label: string;
  /** Metric value. */
  value: string | number;
  /** Optional change value, e.g. "+12%". */
  changeValue?: string;
  /** Direction for change indicator. */
  changeDirection?: StatChangeDirection;
  /** Optional descriptor for change value. */
  changeDescription?: string;
};

/** Props for the StatsSection component. */
export type StatsSectionProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Optional section heading text. */
  title?: string;
  /** Optional section description text. */
  description?: string;
  /** Stats to render via StatGroup + Stat. */
  stats: StatsSectionItem[];
  /** Columns forwarded to StatGroup. @default "auto" */
  columns?: StatGroupColumns;
  /** Variant forwarded to StatGroup. @default "cards" */
  variant?: StatGroupVariant;
  /** Accessible label forwarded to StatGroup. @default "Key metrics" */
  label?: string;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-stats-section`. */
  class?: string;
};

export interface StatsSectionSchemaProps {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Optional section heading text. */
  title?: string;
  /** Optional section description text. */
  description?: string;
  /** Stats to render via StatGroup + Stat. */
  stats: StatsSectionItem[];
  /** Columns forwarded to StatGroup. @default "auto" */
  columns?: StatGroupColumns;
  /** Variant forwarded to StatGroup. @default "cards" */
  variant?: StatGroupVariant;
  /** Accessible label forwarded to StatGroup. @default "Key metrics" */
  label?: string;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-stats-section`. */
  class?: string;
}
