import { describe, expect, it } from 'bun:test';

import { wrapReadmeTables } from './readme-table-scroll.ts';

describe('wrapReadmeTables', () => {
  it('wraps every table while preserving table semantics and contents', () => {
    const html = wrapReadmeTables(
      '<h2>Example</h2><table data-source="workspace"><thead><tr><th scope="col">Name</th></tr></thead><tbody><tr><td>One</td></tr></tbody></table><table><tbody><tr><td>Two</td></tr></tbody></table>',
    );

    expect(html.match(/class="readme-table-scroll"/g)).toHaveLength(2);
    expect(html.match(/role="region"/g)).toHaveLength(2);
    expect(html.match(/aria-label="README table"/g)).toHaveLength(2);
    expect(html.match(/tabindex="0"/g)).toHaveLength(2);
    expect(html).toContain('<table data-source="workspace">');
    expect(html).toContain('<th scope="col">Name</th>');
    expect(html).toContain('<td>One</td>');
    expect(html).toContain('<td>Two</td>');
  });
});
