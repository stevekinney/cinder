/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
import type { DiffReviewDraft } from '../../diff-review-state/index.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: DiffReviewDraftsInventory } =
  await import('./diff-review-drafts-inventory.svelte');

function draft(overrides: Partial<DiffReviewDraft>): DiffReviewDraft {
  return {
    draftId: 'd1',
    targetId: 't1',
    anchor: { kind: 'file', fileOccurrence: 0 },
    capturedContext: {
      targetKind: 'markdown',
      targetLabel: 'Target',
      repositoryLabel: undefined,
      baseRevisionLabel: undefined,
      headRevisionLabel: undefined,
      oldPath: null,
      newPath: null,
      fileOccurrence: 0,
      snapshotId: 's1',
      rawMapping: { status: 'exact' },
    },
    body: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    outdated: false,
    ...overrides,
  };
}

describe('DiffReview component drafts inventory', () => {
  test('renders nothing when there are no drafts', () => {
    const { container } = render(DiffReviewDraftsInventory, {
      drafts: [],
      onopen: () => {},
      onsave: () => {},
      ondiscard: () => {},
    });
    expect(container.querySelector('.diff-review-drafts-inventory')).toBeNull();
  });

  test('lists drafts with the pending (nonempty) count in its heading', () => {
    const drafts = [
      draft({ draftId: 'a', body: 'in progress' }),
      draft({ draftId: 'b', body: '  ' }),
    ];
    const { getByText } = render(DiffReviewDraftsInventory, {
      drafts,
      onopen: () => {},
      onsave: () => {},
      ondiscard: () => {},
    });
    expect(getByText('Unsaved drafts (1)')).not.toBeNull();
    expect(getByText('in progress')).not.toBeNull();
    expect(getByText('(empty draft)')).not.toBeNull();
  });

  test('Open calls onopen with the exact draft', async () => {
    const drafts = [draft({ draftId: 'a', body: 'x' })];
    let opened: DiffReviewDraft | undefined;
    const { getByText } = render(DiffReviewDraftsInventory, {
      drafts,
      onopen: (draft) => {
        opened = draft;
      },
      onsave: () => {},
      ondiscard: () => {},
    });
    await fireEvent.click(getByText('Open'));
    expect(opened?.draftId).toBe('a');
  });

  test('Save is disabled for an empty draft and enabled for a pending one', async () => {
    const drafts = [
      draft({ draftId: 'empty', body: '' }),
      draft({ draftId: 'full', body: 'text' }),
    ];
    let savedId: string | undefined;
    const { getAllByText } = render(DiffReviewDraftsInventory, {
      drafts,
      onopen: () => {},
      onsave: (draftId) => {
        savedId = draftId;
      },
      ondiscard: () => {},
    });
    const saveButtons = getAllByText('Save') as HTMLButtonElement[];
    expect(saveButtons[0]!.disabled).toBe(true);
    expect(saveButtons[1]!.disabled).toBe(false);
    await fireEvent.click(saveButtons[1]!);
    expect(savedId).toBe('full');
  });

  test('Discard calls ondiscard with the draft id', async () => {
    const drafts = [draft({ draftId: 'a' })];
    let discardedId: string | undefined;
    const { getByText } = render(DiffReviewDraftsInventory, {
      drafts,
      onopen: () => {},
      onsave: () => {},
      ondiscard: (draftId) => {
        discardedId = draftId;
      },
    });
    await fireEvent.click(getByText('Discard'));
    expect(discardedId).toBe('a');
  });

  test('readonly hides Save/Discard but keeps Open available', () => {
    const drafts = [draft({ draftId: 'a', body: 'x' })];
    const { getByText, queryByText } = render(DiffReviewDraftsInventory, {
      drafts,
      readonly: true,
      onopen: () => {},
      onsave: () => {},
      ondiscard: () => {},
    });
    expect(getByText('Open')).not.toBeNull();
    expect(queryByText('Save')).toBeNull();
    expect(queryByText('Discard')).toBeNull();
  });
});
