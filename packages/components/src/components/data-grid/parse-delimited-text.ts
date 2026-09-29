import type { DataGridColumnDef } from './data-grid.types.ts';

/**
 * A single parsed CSV/TSV data row. Every value is the raw parsed string —
 * `parseDelimitedText` never infers or coerces types (numbers, dates, …).
 * Convert a column's values yourself, either by mapping `rows` before
 * handing them to DataGrid or with that column's `getValue`.
 */
export type DelimitedTextRow = Record<string, string>;

export type ParseDelimitedTextOptions = {
  /**
   * The field separator, e.g. `','` for CSV or `'\t'` for TSV. Required and
   * used exactly as given — `parseDelimitedText` never guesses a delimiter
   * from the input.
   */
  delimiter: string;
};

/**
 * `columns`/`rows` are handed to DataGrid's `columns`/`rows` props
 * unchanged — see the DataGrid README's "Parsing CSV/TSV text" section for
 * `getRowId` guidance, since parsed rows have no built-in stable identity.
 */
export type ParsedDelimitedText = {
  columns: DataGridColumnDef<DelimitedTextRow>[];
  rows: DelimitedTextRow[];
};

/**
 * Parses delimiter-separated text (CSV, TSV, or any single-character
 * delimiter) into `{ columns, rows }` for DataGrid's existing `columns` and
 * `rows` props — no new component, no props-driven preset.
 *
 * - The first parsed row is always the header row: it supplies both `key`
 *   and `header` for every derived `DataGridColumnDef`. There is no
 *   positional/headerless mode.
 * - A quoted field (`"…"`) may contain the delimiter, embedded newlines
 *   (`\n` or `\r\n`), and an escaped double quote written as `""`.
 * - Both `\n` and `\r\n` line endings are accepted, including a mix of the
 *   two in the same input.
 * - A blank line (nothing at all between two line endings) is skipped —
 *   including as the header — rather than becoming an empty row/column.
 *   A line that has delimiters but empty field values (e.g. `,,`) is *not*
 *   blank and is kept.
 * - Header names are trimmed when deriving each column's `key`. An empty
 *   header (after trimming) falls back to `column_<n>` (1-indexed by
 *   position). A `key` that collides with one already assigned gets `_2`,
 *   `_3`, … appended until it is unique — deterministic by left-to-right
 *   header order, not alphabetical. A column's displayed `header` keeps the
 *   original text (even duplicated or, once defaulted, empty) — only the
 *   internal `key` is disambiguated, since DataGrid requires unique column
 *   keys but not unique header text.
 * - A data row with fewer fields than the header has empty strings for its
 *   missing trailing columns; a data row with more fields than the header
 *   has its extra fields dropped.
 */
export function parseDelimitedText(
  text: string,
  options: ParseDelimitedTextOptions,
): ParsedDelimitedText {
  const { delimiter } = options;
  if (delimiter.length !== 1) {
    throw new Error(
      `[cinder-data-grid] parseDelimitedText requires a single-character delimiter. Received ${JSON.stringify(delimiter)}.`,
    );
  }

  const records = parseDelimitedRecords(text, delimiter);
  const [headerRecord, ...dataRecords] = records;
  if (!headerRecord) return { columns: [], rows: [] };

  const keys = resolveDelimitedTextColumnKeys(headerRecord);
  const columns: DataGridColumnDef<DelimitedTextRow>[] = keys.map((key, index) => ({
    key,
    header: headerRecord[index] ?? key,
  }));
  const rows: DelimitedTextRow[] = dataRecords.map((record) =>
    Object.fromEntries(keys.map((key, index) => [key, record[index] ?? ''])),
  );

  return { columns, rows };
}

/**
 * Derives a unique, deterministic column `key` for every header cell.
 * Exported for its own focused test coverage; not part of the documented
 * public surface.
 */
export function resolveDelimitedTextColumnKeys(headers: readonly string[]): string[] {
  const usedKeys = new Set<string>();
  return headers.map((header, index) => {
    const trimmed = header.trim();
    const base = trimmed === '' ? `column_${index + 1}` : trimmed;
    let candidate = base;
    let suffix = 2;
    while (usedKeys.has(candidate)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    usedKeys.add(candidate);
    return candidate;
  });
}

/**
 * Tokenizes delimited text into records of raw field strings, honoring
 * quoted fields (embedded delimiters/newlines, `""` escaped quotes), `\n`
 * and `\r\n` line endings, and dropping blank lines.
 */
function parseDelimitedRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let index = 0;
  const length = text.length;

  const pushField = (): void => {
    currentRecord.push(currentField);
    currentField = '';
  };
  const pushRecord = (): void => {
    pushField();
    const isBlankRecord = currentRecord.length === 1 && currentRecord[0] === '';
    if (!isBlankRecord) records.push(currentRecord);
    currentRecord = [];
  };

  while (index < length) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          currentField += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      currentField += character;
      index += 1;
      continue;
    }

    if (character === '"' && currentField === '') {
      inQuotes = true;
      index += 1;
      continue;
    }

    if (character === delimiter) {
      pushField();
      index += 1;
      continue;
    }

    if (character === '\r') {
      pushRecord();
      index += text[index + 1] === '\n' ? 2 : 1;
      continue;
    }

    if (character === '\n') {
      pushRecord();
      index += 1;
      continue;
    }

    currentField += character;
    index += 1;
  }

  if (currentField !== '' || currentRecord.length > 0) pushRecord();

  return records;
}
