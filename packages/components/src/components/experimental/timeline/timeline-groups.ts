import type { TimelineEntry, TimelineGroupBy, TimelineWeekStartsOn } from './timeline.types.ts';

export type ParsedTimelineEntry = {
  entry: TimelineEntry;
  index: number;
  parsedTime: number | undefined;
  groupKey: string;
  groupLabel: string;
};

export type TimelineRenderEntry = ParsedTimelineEntry & {
  connectorAfter: 'visible' | 'hidden';
};

export type TimelineRenderGroup = {
  key: string;
  label: string | undefined;
  entries: TimelineRenderEntry[];
};

export type TimelineRenderPlanOptions = {
  entries: TimelineEntry[];
  groupBy?: TimelineGroupBy | undefined;
  weekStartsOn?: TimelineWeekStartsOn | undefined;
  gapThresholdMinutes?: number | undefined;
};

const isoDatetimePattern =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

const millisecondsPerMinute = 60_000;
const millisecondsPerDay = 86_400_000;

export function parseTimelineDatetime(datetime: string): number | undefined {
  if (!isoDatetimePattern.test(datetime)) return undefined;

  const parsedTime = Date.parse(datetime);
  return Number.isFinite(parsedTime) ? parsedTime : undefined;
}

function formatUtcDayKey(parsedTime: number): string {
  return new Date(parsedTime).toISOString().slice(0, 10);
}

function getUtcMidnight(parsedTime: number): number {
  const date = new Date(parsedTime);

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function formatUtcWeekKey(parsedTime: number, weekStartsOn: TimelineWeekStartsOn): string {
  const midnight = getUtcMidnight(parsedTime);
  const day = new Date(midnight).getUTCDay();
  const startDay = weekStartsOn === 'sunday' ? 0 : 1;
  const daysSinceWeekStart = (day - startDay + 7) % 7;

  return formatUtcDayKey(midnight - daysSinceWeekStart * millisecondsPerDay);
}

function normalizeGapThresholdMinutes(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function getGroupData(
  entry: TimelineEntry,
  parsedTime: number | undefined,
  groupBy: TimelineGroupBy,
  weekStartsOn: TimelineWeekStartsOn,
): { key: string; label: string } {
  if (groupBy === 'none') {
    return { key: 'all', label: '' };
  }

  if (parsedTime === undefined) {
    return { key: 'undated', label: entry.groupLabel ?? 'Undated' };
  }

  const key =
    groupBy === 'day' ? formatUtcDayKey(parsedTime) : formatUtcWeekKey(parsedTime, weekStartsOn);

  return { key, label: entry.groupLabel ?? key };
}

function getConnectorAfter(
  current: ParsedTimelineEntry,
  next: ParsedTimelineEntry | undefined,
  gapThresholdMinutes: number | undefined,
): 'visible' | 'hidden' {
  if (next === undefined) return 'hidden';
  if (next.groupKey !== current.groupKey) return 'hidden';
  if (gapThresholdMinutes === undefined) return 'visible';
  if (current.parsedTime === undefined || next.parsedTime === undefined) return 'visible';

  const gapInMinutes = Math.abs(next.parsedTime - current.parsedTime) / millisecondsPerMinute;

  return gapInMinutes > gapThresholdMinutes ? 'hidden' : 'visible';
}

export function buildTimelineRenderPlan({
  entries,
  groupBy = 'none',
  weekStartsOn = 'monday',
  gapThresholdMinutes,
}: TimelineRenderPlanOptions): TimelineRenderGroup[] {
  const normalizedGapThresholdMinutes = normalizeGapThresholdMinutes(gapThresholdMinutes);
  const parsedEntries = entries.map((entry, index): ParsedTimelineEntry => {
    const parsedTime = parseTimelineDatetime(entry.datetime);
    const groupData = getGroupData(entry, parsedTime, groupBy, weekStartsOn);

    return {
      entry,
      index,
      parsedTime,
      groupKey: groupData.key,
      groupLabel: groupData.label,
    };
  });

  const renderEntries = parsedEntries.map((entry, index): TimelineRenderEntry => {
    return {
      ...entry,
      connectorAfter: getConnectorAfter(
        entry,
        parsedEntries[index + 1],
        normalizedGapThresholdMinutes,
      ),
    };
  });

  if (groupBy === 'none') {
    return [
      {
        key: 'group:none:all:0:root',
        label: undefined,
        entries: renderEntries,
      },
    ];
  }

  const groups: TimelineRenderGroup[] = [];

  for (const entry of renderEntries) {
    const previousGroup = groups.at(-1);

    if (previousGroup && previousGroup.entries.at(-1)?.groupKey === entry.groupKey) {
      previousGroup.entries.push(entry);
      continue;
    }

    groups.push({
      key: `group:${groupBy}:${entry.groupKey}:${entry.index}:${entry.entry.id}`,
      label: entry.groupLabel,
      entries: [entry],
    });
  }

  return groups;
}
