import { describe, expect, test } from 'bun:test';
import { findStaticStyleAttributes } from './check-no-static-style-attributes';

describe('findStaticStyleAttributes', () => {
  test('flags fully static style attributes', () => {
    expect(findStaticStyleAttributes('<svg style="color: var(--accent)"></svg>')).toEqual([
      { line: 1, column: 6 },
    ]);
  });

  test('allows CSSOM-backed dynamic styles', () => {
    expect(
      findStaticStyleAttributes(`
        <div style:color={accent}></div>
        <div style={positionStyle}></div>
        <div style="color: {accent}"></div>
      `),
    ).toEqual([]);
  });

  test('flags constant expressions and style directives', () => {
    const source =
      '<div style={"color: red"}></div><div style={' +
      '`display: block`' +
      '}></div><div style:color="red"></div>';
    expect(findStaticStyleAttributes(source)).toEqual([
      { line: 1, column: 6 },
      { line: 1, column: 38 },
      { line: 1, column: 74 },
    ]);
  });

  test('flags constant interpolations in style attributes', () => {
    expect(findStaticStyleAttributes(`<div style="color: {'red'}"></div>`)).toEqual([
      { line: 1, column: 6 },
    ]);
  });

  test('flags constant template interpolations and ignores component props', () => {
    expect(findStaticStyleAttributes(`<div style={\`color: red\`}></div>`)).toEqual([
      { line: 1, column: 6 },
    ]);
    expect(findStaticStyleAttributes('<Widget style="compact" />')).toEqual([]);
    expect(findStaticStyleAttributes('<div><Widget style="compact" /></div>')).toEqual([]);
  });

  test('flags numeric style directive literals', () => {
    expect(findStaticStyleAttributes('<div style:opacity={0.5}></div>')).toEqual([
      { line: 1, column: 6 },
    ]);
  });

  test('flags signed numeric style directive literals', () => {
    expect(findStaticStyleAttributes('<div style:z-index={-1}></div>')).toEqual([
      { line: 1, column: 6 },
    ]);
  });

  test('flags static object-valued style attributes', () => {
    expect(findStaticStyleAttributes('<div style={{ color: "red", opacity: 0.5 }}></div>')).toEqual(
      [{ line: 1, column: 6 }],
    );
  });
  test('allows object styles with dynamic computed keys', () => {
    expect(
      findStaticStyleAttributes(`<div {...{ style: { [propertyName]: 'red' } }}></div>`),
    ).toEqual([]);
  });
  test('flags folded constant expressions and object spreads', () => {
    expect(
      findStaticStyleAttributes(
        `<div style={'color: ' + 'red'}></div><div style:color={'r' + 'ed'}></div><div {...{ style: 'color: red' }}></div>`,
      ),
    ).toHaveLength(3);
  });

  test('finds nested static attributes without matching script strings', () => {
    expect(
      findStaticStyleAttributes(`
        <script>
          const example = '<div style="color: red">';
        </script>
        {#if visible}
          <section><span style="display: block"></span></section>
        {/if}
      `),
    ).toEqual([{ line: 6, column: 26 }]);
  });

  test('reports spread style violations at the spread location', () => {
    expect(
      findStaticStyleAttributes(
        '\n<section>\n  <div {...{ style: "color: red" }}></div>\n</section>',
      ),
    ).toEqual([{ line: 3, column: 8 }]);
  });
});
