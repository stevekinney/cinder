/**
 * Regression test for `03-defaults-pipeline` part C: replaces the manual
 * spot-check with an automated one. For every `component: prop` pair below,
 * reads the regenerated README's generated Props table and asserts the
 * prop's row has a non-empty (not `—`) Default cell.
 *
 * Parses the table the same way `render-component-readme.ts`'s
 * `renderPropsTable` emits it: a line-based split on `|`, matching the prop
 * name in the first column and checking the fourth (Default) column.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

const COMPONENTS_DIR = join(import.meta.dir, '..', 'src', 'components');

/** Reads a component's README's Default column value for a given prop. */
function defaultCellFor(componentId: string, propName: string): string | undefined {
  const readmePath = join(COMPONENTS_DIR, componentId, 'README.md');
  const readme = readFileSync(readmePath, 'utf8');

  for (const line of readme.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((cell) => cell.trim());
    // cells[0] is '' (text before the leading `|`); cells[1] is the Prop column.
    const cellPropName = cells[1]?.replace(/^`|`$/g, '');
    if (cellPropName === propName) {
      return cells[3];
    }
  }
  return undefined;
}

const CASES: Record<string, string[]> = {
  'approval-card': ['editableArgs', 'headingLevel'],
  banner: ['dismissible', 'variant'],
  calendar: ['firstDayOfWeek', 'locale', 'label', 'disabled'],
  'button-group': ['orientation'],
  'hover-card': ['openDelay', 'closeDelay', 'placement', 'offset'],
  'json-editor': ['rows', 'validFeedbackVisible', 'highlight'],
  'kanban-board': ['collapsible', 'reorderColumns'],
  'load-more': ['buttonLabel', 'retryLabel', 'endOfListMessage', 'maxRetries'],
  'matrix-chart': ['colorScale', 'cellLabelsVisible', 'height', 'loading', 'dataTableVisibility'],
  'menu-bar': ['label'],
  'navigation-bar': ['label'],
  'share-card': ['copyLinkLabel', 'copiedLabel', 'shareLabel'],
  steps: ['orientation', 'label', 'completedLabel', 'skippedLabel'],
  'table-cell': ['align', 'as'],
  'table-header-cell': ['sortable', 'scope', 'align'],
  table: ['stickyHeader', 'density', 'selectable', 'scrollable'],
  tab: ['disabled'],
  tabs: ['orientation', 'fill'],
  'tag-input': ['delimiter', 'duplicateValuesAllowed', 'commitOnSubmit', 'readonly'],
  tooltip: ['describe'],
  'mega-menu': ['openOnHover', 'viewportVisible', 'indicatorVisible', 'label'],
};

describe('regenerated READMEs — Default column backfill', () => {
  for (const [componentId, props] of Object.entries(CASES)) {
    for (const propName of props) {
      test(`${componentId}: ${propName} has a non-empty Default cell`, () => {
        const cell = defaultCellFor(componentId, propName);
        expect(cell).toBeDefined();
        expect(cell).not.toBe('—');
      });
    }
  }
});
