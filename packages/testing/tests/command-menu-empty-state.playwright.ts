import { expect, test } from '../src/fixtures/component-page.ts';

// Regression for cinder#776: with zero matching commands, the `<ul
// role="listbox">` has no `<li>` children and used to collapse to a
// zero-size box, with the "no matches" message rendered as an undiscoverable
// sibling. This proves the listbox stays a real, non-zero-size, visible box
// and is described by the empty-state message via `aria-describedby`.
test.describe('command menu empty state', () => {
  test('keeps the listbox visible and describes it via aria-describedby when no commands match', async ({
    page,
  }) => {
    await page.goto('/page/command-menu?snapshot=1');

    const example = page.locator('#example-mount-slash-in-textarea');
    await expect(example).toBeVisible();

    const field = example.getByLabel('Notes');
    await field.click();
    await field.fill('/zzz');

    // CommandMenu portals its floating panel to `document.body`, so the
    // listbox is not a descendant of the example mount.
    const listbox = page.locator('.cinder-command-menu').getByRole('listbox');
    await expect(listbox).toBeVisible();

    // `aria-describedby` is populated only once `registrationsReady` flips
    // true, which `createCommandListState.refreshRegistrationsReady()` queues
    // on a microtask. Reading the attribute straight after `toBeVisible()` can
    // therefore observe `null`. Poll for it instead of racing that microtask.
    await expect(listbox).toHaveAttribute('aria-describedby', /\S/);

    const describedById = await listbox.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();

    // Attribute selector, not `#id`. The id derives from `$props.id()`, which
    // can contain characters CSS treats as combinators (`:`, `.`), so an id
    // selector would break or flap depending on the generated value.
    const emptyState = page.locator(`[id="${describedById}"]`);
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toHaveAttribute('role', 'status');
    await expect(emptyState).toContainText('No commands match');

    const listboxBox = await listbox.boundingBox();
    expect(listboxBox).not.toBeNull();
    expect(listboxBox!.height).toBeGreaterThan(0);
  });
});
