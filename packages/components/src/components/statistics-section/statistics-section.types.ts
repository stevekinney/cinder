import type { HTMLAttributes } from 'svelte/elements';
import type { ContainerMaxWidth } from '../container/container.types.ts';
import type {
  StatisticGroupColumns,
  StatisticGroupVariant,
} from '../statistic-group/statistic-group.types.ts';
import type { StatisticChangeDirection } from '../statistic/statistic.types.ts';

/** @schemaObject */
export type StatisticsSectionItem = {
  /** Metric label text. */
  label: string;
  /** Metric value. */
  value: string | number;
  /** Optional change value, e.g. "+12%". */
  changeValue?: string;
  /** Direction for change indicator. */
  changeDirection?: StatisticChangeDirection;
  /** Optional descriptor for change value. */
  changeDescription?: string;
};

/** Props for the StatisticsSection component. */
export type StatisticsSectionProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Optional section heading text. */
  title?: string;
  /** Optional section description text. */
  description?: string;
  /** Statistics to render via StatisticGroup + Statistic. */
  stats: StatisticsSectionItem[];
  /** Columns forwarded to StatisticGroup. @default "auto" */
  columns?: StatisticGroupColumns;
  /** Variant forwarded to StatisticGroup. @default "cards" */
  variant?: StatisticGroupVariant;
  /** Accessible label forwarded to StatisticGroup. @default "Key metrics" */
  label?: string;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-statistics-section`. */
  class?: string;
};

export interface StatisticsSectionSchemaProps {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Optional section heading text. */
  title?: string;
  /** Optional section description text. */
  description?: string;
  /** Statistics to render via StatisticGroup + Statistic. */
  stats: StatisticsSectionItem[];
  /** Columns forwarded to StatisticGroup. @default "auto" */
  columns?: StatisticGroupColumns;
  /** Variant forwarded to StatisticGroup. @default "cards" */
  variant?: StatisticGroupVariant;
  /** Accessible label forwarded to StatisticGroup. @default "Key metrics" */
  label?: string;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-statistics-section`. */
  class?: string;
}
