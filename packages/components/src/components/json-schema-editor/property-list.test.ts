/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { JsonSchemaValue } from './json-schema-editor-types.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen, within } = await import('@testing-library/svelte');
const { default: PropertyList } = await import('./property-list.svelte');
const { EDITABLE_KEYWORDS } = await import('./property-editor.constants.ts');
const { calculatePropertyValidationErrorCount } = await import('./property-list-validation.ts');

// @testing-library/svelte v5's auto-cleanup does not register under bun:test (no
// global afterEach), so unmount the rendered list after each test. Without this
// the mounted list leaks into the shared happy-dom document.body and sibling
// files (e.g. json-schema-editor.test.ts) see duplicate elements.
afterEach(() => cleanup());

describe('PropertyList', () => {
  test('a 3-property schema renders 3 correctly-keyed, typed, and described rows at rest', () => {
    render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: {
        name: { type: 'string', description: 'Full name' },
        age: { type: 'integer', description: 'Years old' },
        email: { type: 'string', description: 'Contact address' },
      },
      required: [],
      onValueChange: () => {},
    });

    const table = screen.getByRole('table', { name: 'Schema properties' });
    const rows = within(table).getAllByRole('row');
    // Header row + 3 property rows.
    expect(rows).toHaveLength(4);

    const nameCells = within(rows[1]!).getAllByRole('cell');
    expect(within(rows[1]!).getByRole('rowheader').textContent).toContain('name');
    expect(nameCells[0]!.textContent).toContain('string');
    expect(nameCells[1]!.textContent).toContain('Full name');

    const ageCells = within(rows[2]!).getAllByRole('cell');
    expect(within(rows[2]!).getByRole('rowheader').textContent).toContain('age');
    expect(ageCells[0]!.textContent).toContain('integer');
    expect(ageCells[1]!.textContent).toContain('Years old');

    const emailCells = within(rows[3]!).getAllByRole('cell');
    expect(within(rows[3]!).getByRole('rowheader').textContent).toContain('email');
    expect(emailCells[0]!.textContent).toContain('string');
    expect(emailCells[1]!.textContent).toContain('Contact address');
  });

  // "expanding an object row reveals a nested properties table" and "a
  // duplicate rename surfaces a validation alert" are covered in
  // editors-complex-residual.playwright.ts rather than here — clicking a
  // disclosure trigger to mount the nested PropertyEditor trips a happy-dom
  // keyed-each reconciliation limitation the unit harness hits at this
  // nesting depth (see json-schema-editor.test.ts's note on the same issue).

  test('a validation error renders inline on the affected row only', () => {
    render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: {
        status: { type: 'string' },
        age: { type: 'integer' },
      },
      required: [],
      // A retained invalid enum draft is the mechanism that surfaces a
      // nested validation error onto a collapsed row without a live
      // validation round trip — see retainedDraftCount.
      enumDrafts: { '/properties/status/enum': { 0: { text: '{', error: 'invalid-json' } } },
      onValueChange: () => {},
    });

    const statusRow = screen.getByRole('row', { name: /status/ });
    const ageRow = screen.getByRole('row', { name: /age/ });
    expect(statusRow.getAttribute('data-cinder-invalid')).toBe('');
    expect(ageRow.getAttribute('data-cinder-invalid')).toBeNull();
    expect(statusRow.textContent).toMatch(/1\s+error/);
    expect(ageRow.textContent).not.toContain('error');
  });

  test('composes Collapsible for required names and avoids schema jargon', async () => {
    const source = await Bun.file(new URL('./property-list.svelte', import.meta.url)).text();

    expect(source).toContain("import Collapsible from '@lostgradient/cinder/collapsible'");
    expect(source).not.toContain("from '../collapsible/collapsible.svelte'");
    expect(source).toContain('Required fields not yet defined');
    expect(source).not.toContain('<details class="cinder-jse-required-only"');
    expect(source).not.toContain('Required without property schema');
  });

  test('uses a rotating Lucide chevron for property disclosure', async () => {
    const { container } = render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: { name: { type: 'string' } },
      required: [],
      onValueChange: () => {},
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Expand name property"]',
    );
    const chevron = trigger?.querySelector('.cinder-jse-property-row__chevron');
    expect(chevron?.tagName.toLowerCase()).toBe('svg');
    expect(trigger?.textContent).not.toContain('▸');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    const css = await Bun.file(new URL('./json-schema-editor.css', import.meta.url)).text();
    expect(css).toMatch(
      /\.cinder-jse-property-row__trigger\[aria-expanded='true'\]\s*>\s*\.cinder-jse-property-row__chevron\s*\{[^}]*transform:\s*rotate\(180deg\)/,
    );
    expect(css).toContain('background: var(--cinder-surface-raised-hover);');
  });

  test('the Type cell summarises array items inline at rest', () => {
    render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
        addresses: { type: 'array', items: { type: 'object' } },
        codes: { type: 'array', items: { enum: ['a', 'b'] } },
        untyped: { type: 'array' },
      },
      required: [],
      onValueChange: () => {},
    });

    expect(
      screen.getByRole('row', { name: /tags/ }).textContent,
    ).toContain('array of string');
    expect(
      screen.getByRole('row', { name: /addresses/ }).textContent,
    ).toContain('array of object');
    expect(
      screen.getByRole('row', { name: /codes/ }).textContent,
    ).toContain('array of enum');
    expect(
      screen.getByRole('row', { name: /^untyped/ }).textContent,
    ).toContain('array of any');
  });

  test('a multi-type schema including array does not get an "of <items>" suffix', () => {
    render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: {
        nullableList: { type: ['array', 'null'], items: { type: 'string' } },
      },
      required: [],
      onValueChange: () => {},
    });

    const rowText = screen.getByRole('row', { name: /nullableList/ }).textContent;
    expect(rowText).toContain('array | null');
    expect(rowText).not.toContain('of string');
  });

  test('can add the first required-only property name', async () => {
    let latestRequired: string[] = [];
    const { container } = render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: {},
      required: [],
      onValueChange: (_properties: unknown, required: string[]) => {
        latestRequired = required;
      },
    });

    const input = container.querySelector('#properties-required-only-add') as HTMLInputElement;
    const addButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Add required name',
    );

    expect(input).not.toBeNull();
    expect(addButton).not.toBeUndefined();

    await fireEvent.input(input, { target: { value: 'missingSchema' } });
    await fireEvent.click(addButton!);

    expect(latestRequired).toEqual(['missingSchema']);
  });

  test('identifies each property in the accessible names of its reorder controls', () => {
    const { container } = render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: {
        email: { type: 'string' },
        age: { type: 'integer' },
      },
      required: [],
      onValueChange: () => {},
    });

    expect(screen.getByRole('checkbox', { name: 'email' })).not.toBeNull();
    expect(screen.getByRole('checkbox', { name: 'age' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Move email up' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Move email down' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Move age up' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Move age down' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Move email up' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Move age down' })).toHaveProperty('disabled', true);
    expect(
      container
        .querySelector('[aria-label="Expand email property"]')
        ?.getAttribute('aria-controls'),
    ).toBeNull();
  });

  test('the required checkbox adds and removes the key from the required array', async () => {
    let latestRequired: string[] = [];
    const { rerender } = render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
      required: ['name'],
      onValueChange: (_properties: unknown, required: string[]) => {
        latestRequired = required;
      },
    });

    expect(screen.getByRole('checkbox', { name: 'name' })).toHaveProperty('checked', true);
    expect(screen.getByRole('checkbox', { name: 'age' })).toHaveProperty('checked', false);

    await fireEvent.click(screen.getByRole('checkbox', { name: 'age' }));
    expect(latestRequired).toEqual(['name', 'age']);

    await rerender({
      idPrefix: 'properties',
      path: '/properties',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
      required: latestRequired,
      onValueChange: (_properties: unknown, required: string[]) => {
        latestRequired = required;
      },
    });

    await fireEvent.click(screen.getByRole('checkbox', { name: 'name' }));
    expect(latestRequired).toEqual(['age']);
  });

  test('reorders properties through the row controls', async () => {
    let latestProperties: Record<string, JsonSchemaValue> = {};
    render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: {
        email: { type: 'string' },
        age: { type: 'integer' },
      },
      required: [],
      onValueChange: (properties: Record<string, JsonSchemaValue>) => {
        latestProperties = properties;
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Move age up' }));

    expect(Object.keys(latestProperties)).toEqual(['age', 'email']);
  });

  test('the committed reordered object is a real plain object, not a null-prototype one', async () => {
    // Chrome's structuredClone throws DataCloneError on a null-prototype
    // object — the undo-history commit uses structuredClone on the schema,
    // so a commit built via Object.create(null) silently breaks every
    // reorder in a real browser (bun's structuredClone does not reproduce
    // this, so this assertion checks prototype shape directly rather than
    // relying on a throw).
    let latestProperties: Record<string, JsonSchemaValue> = {};
    render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: {
        email: { type: 'string' },
        age: { type: 'integer' },
      },
      required: [],
      onValueChange: (properties: Record<string, JsonSchemaValue>) => {
        latestProperties = properties;
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Move age up' }));

    expect(Object.getPrototypeOf(latestProperties)).toBe(Object.prototype);
  });

  test('reordering preserves a literal __proto__ property as a real own data property', async () => {
    const properties = JSON.parse(
      '{"__proto__":{"type":"string"},"alpha":{"type":"string"},"beta":{"type":"string"}}',
    ) as Record<string, JsonSchemaValue>;
    let latestProperties: Record<string, JsonSchemaValue> = {};
    render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties,
      required: [],
      onValueChange: (next: Record<string, JsonSchemaValue>) => {
        latestProperties = next;
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Move beta up' }));

    expect(Object.getPrototypeOf(latestProperties)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(latestProperties, '__proto__')).toBe(true);
    expect(Object.keys(latestProperties)).toEqual(['__proto__', 'beta', 'alpha']);
  });

  test('only links a disclosure trigger to its panel while that panel is rendered', async () => {
    const source = await Bun.file(new URL('./property-list.svelte', import.meta.url)).text();

    expect(source).toContain('aria-controls={isOpen ? panelId : undefined}');
  });

  test('announces moves and restores focus after deletion', async () => {
    render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: { email: { type: 'string' }, age: { type: 'integer' } },
      required: [],
      onValueChange: () => {},
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Move age up' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain(
      'Moved age property to position 1 of 2.',
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Delete email' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain(
      'Deleted email property.',
    );
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Expand age property' }),
    );
  });

  test('disables reordering numeric property names whose object order cannot change', () => {
    render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: { 0: { type: 'string' }, 1: { type: 'integer' } },
      required: [],
      onValueChange: () => {},
    });

    expect(screen.getByRole('button', { name: 'Move 1 up' })).toHaveProperty('disabled', true);
  });

  test('keeps representable string-key moves available in mixed-key schemas', () => {
    render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: { 0: { type: 'string' }, alpha: { type: 'string' }, beta: { type: 'string' } },
      required: [],
      onValueChange: () => {},
    });

    expect(screen.getByRole('button', { name: 'Move beta up' })).toHaveProperty('disabled', false);
  });

  test('keeps reorderable properties available beside an own __proto__ key', () => {
    const properties = JSON.parse(
      '{"__proto__":{"type":"string"},"alpha":{"type":"string"},"beta":{"type":"string"}}',
    ) as Record<string, JsonSchemaValue>;
    render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties,
      required: [],
      onValueChange: () => {},
    });

    expect(screen.getByRole('button', { name: 'Move beta up' })).toHaveProperty('disabled', false);
  });

  test('keeps the Add property focus reference layout-neutral', async () => {
    const css = await Bun.file(new URL('./json-schema-editor.css', import.meta.url)).text();

    expect(css).toContain('.cinder-jse-property-list__add-property-reference');
    expect(css).toMatch(
      /\.cinder-jse-property-list__add-property-reference\s*\{[^}]*display:\s*contents/,
    );
  });

  test('treats enum as editable rather than a preserved keyword', () => {
    const loadedSchema = { type: 'string', enum: ['draft', 'published'] };
    const preservedKeys = Object.keys(loadedSchema).filter((key) => !EDITABLE_KEYWORDS.has(key));

    expect(preservedKeys).toEqual([]);
  });

  test('renders preserved keywords visibly beside a $ref editor', async () => {
    const source = await Bun.file(new URL('./property-editor.svelte', import.meta.url)).text();

    expect(source).toContain("Preserved keywords: {preservedKeys.join(', ')}");
  });

  test('aggregates local and nested validation error counts', async () => {
    expect(
      calculatePropertyValidationErrorCount(
        ['first', 'nested'],
        {
          first: 1,
          nested: 2,
          deleted: 4,
        },
        true,
      ),
    ).toBe(4);
  });

  test('renders a danger indicator on the row with nested validation errors', async () => {
    const source = await Bun.file(new URL('./property-list.svelte', import.meta.url)).text();

    expect(source).toContain("import Badge from '@lostgradient/cinder/badge'");
    expect(source).toContain('data-cinder-invalid={childValidationErrorCount > 0');
    expect(source).toMatch(/<Badge\s+variant="danger"/);
    expect(source).toContain('validation ${childValidationErrorCount');
  });

  test('property-list.svelte clears nested validation counts on collapse and unmount', async () => {
    const source = await Bun.file(new URL('./property-list.svelte', import.meta.url)).text();

    expect(source).toContain('onDestroy(() =>');
    expect(source).toContain('onvalidationErrorcount?.(0)');
    expect(source).toContain('function toggleExpanded');
    expect(source).toContain('if (isOpen) setChildValidationErrorCount(key, 0)');
  });

  test('property-list.svelte retains enum-draft error counts while a property is collapsed', async () => {
    const source = await Bun.file(new URL('./property-list.svelte', import.meta.url)).text();

    expect(source).toContain('function retainedDraftCount(key: string)');
    expect(source).toContain('retainedDraftCount(key)');
    expect(source).toContain('Math.max(');
  });
});
