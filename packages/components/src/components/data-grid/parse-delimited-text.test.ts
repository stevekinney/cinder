import { describe, expect, test } from 'bun:test';
import { parseDelimitedText, resolveDelimitedTextColumnKeys } from './parse-delimited-text.ts';

describe('parseDelimitedText', () => {
  test('parses comma-delimited text into columns and rows keyed by the header row', () => {
    const { columns, rows } = parseDelimitedText('id,customer,status\nORD-1,Ada,Packed\n', {
      delimiter: ',',
    });

    expect(columns).toEqual([
      { key: 'id', header: 'id' },
      { key: 'customer', header: 'customer' },
      { key: 'status', header: 'status' },
    ]);
    expect(rows).toEqual([{ id: 'ORD-1', customer: 'Ada', status: 'Packed' }]);
  });

  test('parses tab-delimited (TSV) text using an explicit delimiter', () => {
    const { columns, rows } = parseDelimitedText('id\tname\n1\tAda\n2\tGrace\n', {
      delimiter: '\t',
    });

    expect(columns.map((column) => column.key)).toEqual(['id', 'name']);
    expect(rows).toEqual([
      { id: '1', name: 'Ada' },
      { id: '2', name: 'Grace' },
    ]);
  });

  test('never auto-detects a delimiter — a comma delimiter does not split tab-separated text', () => {
    const { rows } = parseDelimitedText('id\tname\n1\tAda\n', { delimiter: ',' });

    // With ',' as the delimiter, the whole tab-containing line is one field.
    expect(rows).toEqual([{ 'id\tname': '1\tAda' }]);
  });

  test('skips blank lines, including a blank line before the header', () => {
    const { columns, rows } = parseDelimitedText('\n\nid,name\n\n1,Ada\n\n2,Grace\n\n', {
      delimiter: ',',
    });

    expect(columns.map((column) => column.key)).toEqual(['id', 'name']);
    expect(rows).toEqual([
      { id: '1', name: 'Ada' },
      { id: '2', name: 'Grace' },
    ]);
  });

  test('keeps a line with delimiters but empty values — that is not a blank line', () => {
    const { rows } = parseDelimitedText('a,b,c\n,,\n1,,3\n', { delimiter: ',' });

    expect(rows).toEqual([
      { a: '', b: '', c: '' },
      { a: '1', b: '', c: '3' },
    ]);
  });

  test('supports a quoted value containing the delimiter', () => {
    const { rows } = parseDelimitedText('name,note\n"Ada, Grace",vip\n', { delimiter: ',' });

    expect(rows).toEqual([{ name: 'Ada, Grace', note: 'vip' }]);
  });

  test('supports a quoted value containing an embedded newline', () => {
    const { rows } = parseDelimitedText('name,note\n"Ada\nLovelace",vip\n', { delimiter: ',' });

    expect(rows).toEqual([{ name: 'Ada\nLovelace', note: 'vip' }]);
  });

  test('supports an escaped double quote ("") inside a quoted value', () => {
    const source = ['name,note', '"5′ TV","Say ""hi"""', ''].join('\n');
    const { rows } = parseDelimitedText(source, { delimiter: ',' });

    expect(rows).toEqual([{ name: '5′ TV', note: 'Say "hi"' }]);
  });

  test('handles CRLF line endings', () => {
    const { columns, rows } = parseDelimitedText('id,name\r\n1,Ada\r\n2,Grace\r\n', {
      delimiter: ',',
    });

    expect(columns.map((column) => column.key)).toEqual(['id', 'name']);
    expect(rows).toEqual([
      { id: '1', name: 'Ada' },
      { id: '2', name: 'Grace' },
    ]);
  });

  test('handles a mix of CRLF and LF line endings in the same input', () => {
    const { rows } = parseDelimitedText('id,name\r\n1,Ada\n2,Grace\r\n', { delimiter: ',' });

    expect(rows).toEqual([
      { id: '1', name: 'Ada' },
      { id: '2', name: 'Grace' },
    ]);
  });

  test('handles a quoted field spanning a CRLF newline', () => {
    const { rows } = parseDelimitedText('name,note\r\n"Ada\r\nLovelace",vip\r\n', {
      delimiter: ',',
    });

    expect(rows).toEqual([{ name: 'Ada\r\nLovelace', note: 'vip' }]);
  });

  test('a data row shorter than the header gets empty strings for missing trailing columns', () => {
    const { rows } = parseDelimitedText('id,name,status\n1,Ada\n', { delimiter: ',' });

    expect(rows).toEqual([{ id: '1', name: 'Ada', status: '' }]);
  });

  test('a data row longer than the header drops its extra fields', () => {
    const { rows } = parseDelimitedText('id,name\n1,Ada,extra\n', { delimiter: ',' });

    expect(rows).toEqual([{ id: '1', name: 'Ada' }]);
  });

  test('empty input produces no columns and no rows', () => {
    expect(parseDelimitedText('', { delimiter: ',' })).toEqual({ columns: [], rows: [] });
  });

  test('a header-only input produces columns and no rows', () => {
    const { columns, rows } = parseDelimitedText('id,name\n', { delimiter: ',' });

    expect(columns.map((column) => column.key)).toEqual(['id', 'name']);
    expect(rows).toEqual([]);
  });

  test('rejects a multi-character delimiter', () => {
    expect(() => parseDelimitedText('a,b\n1,2\n', { delimiter: ', ' })).toThrow();
  });

  test('duplicate and empty header names resolve to unique, deterministic keys', () => {
    const { columns, rows } = parseDelimitedText('name,name,,name\nAda,Grace,x,Alan\n', {
      delimiter: ',',
    });

    expect(columns).toEqual([
      { key: 'name', header: 'name' },
      { key: 'name_2', header: 'name' },
      { key: 'column_3', header: '' },
      { key: 'name_3', header: 'name' },
    ]);
    expect(rows).toEqual([{ name: 'Ada', name_2: 'Grace', column_3: 'x', name_3: 'Alan' }]);
  });

  test('trims whitespace around header text when deriving a key, but not row values', () => {
    const { columns, rows } = parseDelimitedText(' id , name \n 1 , Ada \n', { delimiter: ',' });

    expect(columns.map((column) => column.key)).toEqual(['id', 'name']);
    // Row values are not trimmed — only header text used for key derivation is.
    expect(rows).toEqual([{ id: ' 1 ', name: ' Ada ' }]);
  });
});

describe('resolveDelimitedTextColumnKeys', () => {
  test('is deterministic and stable for a fixed input order', () => {
    const headers = ['a', 'a', '', 'a', ''];
    expect(resolveDelimitedTextColumnKeys(headers)).toEqual([
      'a',
      'a_2',
      'column_3',
      'a_3',
      'column_5',
    ]);
  });

  test('avoids colliding with a key an earlier header already generated', () => {
    // The second header, "a_2", would collide with what the first "a"
    // duplicate resolves to unless collision detection keeps checking.
    expect(resolveDelimitedTextColumnKeys(['a', 'a_2', 'a'])).toEqual(['a', 'a_2', 'a_3']);
  });
});
