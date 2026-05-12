export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const localNoon = 12;
const daysPerWeek = 7;
const monthMatrixWeekCount = 6;
const sundayFirstRegions = new Set(['US', 'CA', 'JP', 'BR', 'IL', 'KR', 'MX']);
const saturdayFirstRegions = new Set(['SA', 'EG', 'AE', 'YE', 'OM', 'QA', 'BH']);

type LocaleWeekInfo = {
  readonly firstDay?: number;
};

function hasLocaleWeekInfo(locale: Intl.Locale): locale is Intl.Locale & {
  getWeekInfo: () => LocaleWeekInfo;
} {
  return 'getWeekInfo' in locale && typeof locale.getWeekInfo === 'function';
}

function toWeekday(value: number): Weekday {
  const normalized = ((value % daysPerWeek) + daysPerWeek) % daysPerWeek;
  switch (normalized) {
    case 0:
      return 0;
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    case 4:
      return 4;
    case 5:
      return 5;
    case 6:
      return 6;
    default:
      return 1;
  }
}

function createLocalNoonDate(year: number, month: number, day: number): Date {
  return new Date(year, month, day, localNoon, 0, 0, 0);
}

function daysInMonth(year: number, month: number): number {
  return createLocalNoonDate(year, month + 1, 0).getDate();
}

function compareCalendarDates(a: Date, b: Date): number {
  const yearDifference = a.getFullYear() - b.getFullYear();
  if (yearDifference !== 0) return yearDifference;

  const monthDifference = a.getMonth() - b.getMonth();
  if (monthDifference !== 0) return monthDifference;

  return a.getDate() - b.getDate();
}

function localeRegion(locale: string | undefined): string | undefined {
  const canonicalLocale = validateLocale(locale);
  if (canonicalLocale === undefined) return undefined;

  try {
    const localeObject = new Intl.Locale(canonicalLocale);
    return localeObject.region ?? localeObject.maximize().region;
  } catch {
    return undefined;
  }
}

/**
 * Returns the first day of the month at local noon.
 */
export function startOfMonth(date: Date): Date {
  return createLocalNoonDate(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Returns the last day of the month at local noon.
 */
export function endOfMonth(date: Date): Date {
  return createLocalNoonDate(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Adds whole calendar days and normalizes the result to local noon.
 */
export function addDays(date: Date, count: number): Date {
  return createLocalNoonDate(date.getFullYear(), date.getMonth(), date.getDate() + count);
}

/**
 * Adds whole calendar months, clamps the day to the target month, and normalizes to local noon.
 */
export function addMonths(date: Date, count: number): Date {
  const targetMonth = createLocalNoonDate(date.getFullYear(), date.getMonth() + count, 1);
  const day = Math.min(
    date.getDate(),
    daysInMonth(targetMonth.getFullYear(), targetMonth.getMonth()),
  );

  return createLocalNoonDate(targetMonth.getFullYear(), targetMonth.getMonth(), day);
}

/**
 * Adds whole calendar years, clamps the day to the target month, and normalizes to local noon.
 */
export function addYears(date: Date, count: number): Date {
  const targetYear = date.getFullYear() + count;
  const day = Math.min(date.getDate(), daysInMonth(targetYear, date.getMonth()));

  return createLocalNoonDate(targetYear, date.getMonth(), day);
}

/**
 * Returns whether two dates share the same local calendar day.
 */
export function isSameDay(a: Date, b: Date): boolean {
  return compareCalendarDates(a, b) === 0;
}

/**
 * Returns whether `a` is strictly before `b` at local calendar-day granularity.
 */
export function isBefore(a: Date, b: Date): boolean {
  return compareCalendarDates(a, b) < 0;
}

/**
 * Returns whether `a` is strictly after `b` at local calendar-day granularity.
 */
export function isAfter(a: Date, b: Date): boolean {
  return compareCalendarDates(a, b) > 0;
}

/**
 * Returns the locale's first day of week as a weekday index where Sunday is 0.
 */
export function firstDayOfWeek(locale: string | undefined): Weekday {
  const canonicalLocale = validateLocale(locale);

  if (canonicalLocale !== undefined) {
    try {
      const localeObject = new Intl.Locale(canonicalLocale);
      if (hasLocaleWeekInfo(localeObject)) {
        const firstDay = localeObject.getWeekInfo().firstDay;
        if (typeof firstDay === 'number' && firstDay >= 1 && firstDay <= 7) {
          return toWeekday(firstDay);
        }
      }
    } catch {
      return 1;
    }
  }

  const region = localeRegion(canonicalLocale);
  if (region !== undefined && sundayFirstRegions.has(region)) return 0;
  if (region !== undefined && saturdayFirstRegions.has(region)) return 6;
  return 1;
}

/**
 * Returns seven localized weekday headers, rotated to the locale's first day of week.
 */
export function dayOfWeekHeaders(locale: string | undefined): string[] {
  const canonicalLocale = validateLocale(locale);
  const formatter = new Intl.DateTimeFormat(canonicalLocale, { weekday: 'short' });
  const monday = createLocalNoonDate(2024, 0, 1);
  const headersByWeekday = Array.from({ length: daysPerWeek }, (_, weekday) =>
    formatter.format(addDays(monday, weekday === 0 ? 6 : weekday - 1)),
  );
  const firstDay = firstDayOfWeek(canonicalLocale);

  return Array.from(
    { length: daysPerWeek },
    (_, offset) => headersByWeekday[(firstDay + offset) % daysPerWeek] ?? '',
  );
}

/**
 * Builds a six-week calendar grid for the anchor month, including leading and trailing padding days.
 */
export function buildMonthMatrix(anchor: Date, locale: string | undefined): Date[][] {
  const firstOfMonth = startOfMonth(anchor);
  const firstDay = firstDayOfWeek(locale);
  const leadingDayCount = (firstOfMonth.getDay() - firstDay + daysPerWeek) % daysPerWeek;
  const firstCell = addDays(firstOfMonth, -leadingDayCount);

  return Array.from({ length: monthMatrixWeekCount }, (_week, weekIndex) =>
    Array.from({ length: daysPerWeek }, (_day, dayIndex) =>
      addDays(firstCell, weekIndex * daysPerWeek + dayIndex),
    ),
  );
}

/**
 * Serializes a date as YYYY-MM-DD using local calendar fields.
 */
export function serializeDate(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Returns a canonical BCP-47 locale tag, or undefined for empty or invalid input.
 */
export function validateLocale(input: string | undefined): string | undefined {
  if (input === undefined || input.trim() === '') return undefined;

  try {
    return Intl.getCanonicalLocales(input)[0];
  } catch {
    return undefined;
  }
}
