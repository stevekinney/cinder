import { requireElement } from '../../../tests/dom-test-support.ts';

/**
 * Component tests for `<ScheduleFormFields>` — a pure presentational
 * component (no client/query/principal context needed), so these render
 * standalone.
 */
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import ScheduleFormFields from './schedule-form-fields.svelte';
import { ScheduleFormState } from './schedule-form-state.svelte.ts';

describe('ScheduleFormFields — create mode', () => {
  test('renders an editable Description field (COR-15)', () => {
    const form = new ScheduleFormState();
    const { getByRole } = render(ScheduleFormFields, {
      props: { form, mode: 'create', workflowTypeOptions: undefined },
    });
    expect(
      requireElement(getByRole('textbox', { name: 'Description' }), HTMLInputElement).disabled,
    ).toBe(false);
  });

  test('renders a workflow-type Select when registry options are available', async () => {
    const form = new ScheduleFormState();

    const { getByRole, queryByText } = render(ScheduleFormFields, {
      props: { form, mode: 'create', workflowTypeOptions: ['report-gen', 'cache-warm'] },
    });

    expect(getByRole('combobox', { name: 'Workflow type' })).not.toBeNull();
    expect(
      queryByText('No registered workflow types found — enter the workflow type name.'),
    ).toBeNull();
  });

  test('degrades to a free-text field with an "unavailable" message when registry options are undefined (still loading, errored, or unauthorized)', async () => {
    // `undefined` must read as "the lookup hasn't told us anything yet",
    // never as "the server has no workflows" (WFT-6) — an authorized
    // schedule creator seeing the latter while the query is merely still in
    // flight would be actively misled about server state.
    const form = new ScheduleFormState();

    const { getByText, queryByRole, queryByText } = render(ScheduleFormFields, {
      props: { form, mode: 'create', workflowTypeOptions: undefined },
    });

    expect(getByText('Registry lookup unavailable — enter the workflow type name.')).not.toBeNull();
    expect(
      queryByText('No registered workflow types found — enter the workflow type name.'),
    ).toBeNull();
    expect(queryByRole('combobox', { name: 'Workflow type' })).toBeNull();
  });

  test('degrades to a free-text field with a "no registered types" message when the registry resolves with zero registered workflow types', async () => {
    // A resolved-but-empty registry (WFT-6) is a distinct state from
    // still-loading/errored (both collapse to `undefined` upstream in
    // `schedule-form-drawer.svelte`) — an empty array is `!== undefined`, so
    // this must be handled explicitly rather than falling out of the same
    // check, or a genuinely empty registry renders an unusable zero-option
    // Select instead of the free-text fallback, and it must show a distinct
    // message from the `undefined` case above rather than the misleading
    // "unavailable" copy.
    const form = new ScheduleFormState();

    const { getByText, queryByRole, queryByText } = render(ScheduleFormFields, {
      props: { form, mode: 'create', workflowTypeOptions: [] },
    });

    expect(
      getByText('No registered workflow types found — enter the workflow type name.'),
    ).not.toBeNull();
    expect(queryByText('Registry lookup unavailable — enter the workflow type name.')).toBeNull();
    expect(queryByRole('combobox', { name: 'Workflow type' })).toBeNull();
  });

  test('shows the schedule id, input JSON, and cadence fields', async () => {
    const form = new ScheduleFormState();

    const { getByRole } = render(ScheduleFormFields, {
      props: { form, mode: 'create', workflowTypeOptions: [] },
    });

    expect(getByRole('textbox', { name: 'Schedule ID' })).not.toBeNull();
    expect(getByRole('textbox', { name: 'Input (JSON)' })).not.toBeNull();
  });

  test('selecting an overlap policy updates the form and shows its consequence', async () => {
    const form = new ScheduleFormState();

    const { getByRole, getByText } = render(ScheduleFormFields, {
      props: { form, mode: 'create', workflowTypeOptions: [] },
    });

    expect(
      getByText(
        'Concurrent runs are permitted. Multiple instances may run simultaneously. Use only if the workflow is safe to parallelize.',
      ),
    ).not.toBeNull();

    await fireEvent.click(getByRole('radio', { name: 'Allow' }));

    expect(form.overlap).toBe('allow');
  });

  test('enabling backfill shows the catch-up-window warning', async () => {
    const form = new ScheduleFormState();

    const { getByRole, queryByText, getByText } = render(ScheduleFormFields, {
      props: { form, mode: 'create', workflowTypeOptions: [] },
    });

    expect(queryByText(/missed occurrences fire/)).toBeNull();
    await fireEvent.click(getByRole('switch', { name: 'Backfill missed occurrences' }));

    expect(form.backfill).toBe(true);
    expect(getByText(/missed occurrences fire/)).not.toBeNull();
  });

  test('renders the catch-up-window warning already mounted when backfill starts enabled, and removes it when disabled', async () => {
    // Complements the toggle-on case above: mounting with `backfill` already
    // `true` exercises the `{#if}` block's initial-render path directly
    // (rather than only its post-toggle transition-in), and toggling back
    // off exercises its teardown/transition-out path — both are distinct
    // compiled code paths from the toggle-on assertion alone.
    const form = new ScheduleFormState({ backfill: true });

    const { getByRole, queryByText, getByText } = render(ScheduleFormFields, {
      props: { form, mode: 'create', workflowTypeOptions: [] },
    });

    expect(getByText(/missed occurrences fire/)).not.toBeNull();
    await fireEvent.click(getByRole('switch', { name: 'Backfill missed occurrences' }));

    expect(form.backfill).toBe(false);
    expect(queryByText(/missed occurrences fire/)).toBeNull();
  });

  test('shows a field-level error message for invalid JSON input', async () => {
    const form = new ScheduleFormState({ inputText: '{not json' });

    const { getByText } = render(ScheduleFormFields, {
      props: { form, mode: 'create', workflowTypeOptions: [] },
    });

    expect(getByText('Must be valid JSON.')).not.toBeNull();
  });
});

describe('ScheduleFormFields — edit mode', () => {
  test('disables only workflow type and input; overlap, jitter, backfill, and description are editable (COR-15)', async () => {
    const form = new ScheduleFormState({
      id: 'nightly-rollup',
      workflowType: 'report-gen',
      overlap: 'queue',
    });

    const { getByRole, getByText, queryByRole } = render(ScheduleFormFields, {
      props: { form, mode: 'edit', workflowTypeOptions: undefined },
    });

    expect(
      requireElement(getByRole('textbox', { name: 'Workflow type' }), HTMLInputElement).disabled,
    ).toBe(true);
    expect(queryByRole('textbox', { name: 'Input (JSON)' })).toBeNull();
    expect(queryByRole('textbox', { name: 'Schedule ID' })).toBeNull();
    expect(requireElement(getByRole('radio', { name: 'Skip' }), HTMLInputElement).disabled).toBe(
      false,
    );
    expect(
      requireElement(getByRole('textbox', { name: 'Jitter' }), HTMLInputElement).disabled,
    ).toBe(false);
    expect(
      requireElement(
        getByRole('switch', { name: 'Backfill missed occurrences' }),
        HTMLButtonElement,
      ).disabled,
    ).toBe(false);
    expect(
      requireElement(getByRole('textbox', { name: 'Description' }), HTMLInputElement).disabled,
    ).toBe(false);
    expect(
      getByText('Workflow type, input payload, and start-paused can only be set at creation.'),
    ).not.toBeNull();
  });

  test('editing the description writes through to the form', async () => {
    const form = new ScheduleFormState({ workflowType: 'report-gen', description: 'Old' });
    const { getByRole } = render(ScheduleFormFields, {
      props: { form, mode: 'edit', workflowTypeOptions: undefined },
    });
    const field = requireElement(getByRole('textbox', { name: 'Description' }), HTMLInputElement);
    expect(field.value).toBe('Old');
    await fireEvent.input(field, { target: { value: 'New' } });
    expect(form.description).toBe('New');
  });

  test('does NOT disable the revision-policy radio group in edit mode', async () => {
    const form = new ScheduleFormState({
      id: 'nightly-rollup',
      workflowType: 'report-gen',
      revisionPolicy: 'active-at-fire',
    });

    const { getByRole } = render(ScheduleFormFields, {
      props: { form, mode: 'edit', workflowTypeOptions: undefined },
    });

    expect(
      requireElement(getByRole('radio', { name: 'Active at fire' }), HTMLInputElement).disabled,
    ).toBe(false);
    expect(requireElement(getByRole('radio', { name: 'Pinned' }), HTMLInputElement).disabled).toBe(
      false,
    );
  });

  test('shows the re-capture warning when CHANGING to pinned in edit mode', async () => {
    // Starts active-at-fire so `form.initialRevisionPolicy` captures that
    // baseline; the click below is a real transition, not a same-value
    // re-render, so `toUpdateRevisionPolicy()` would actually submit it.
    const form = new ScheduleFormState({
      id: 'nightly-rollup',
      workflowType: 'report-gen',
      revisionPolicy: 'active-at-fire',
    });

    const { getByRole, getByText, getAllByText } = render(ScheduleFormFields, {
      props: { form, mode: 'edit', workflowTypeOptions: undefined },
    });

    await fireEvent.click(getByRole('radio', { name: 'Pinned' }));

    expect(getByText(/captures whichever revision is active right now/)).not.toBeNull();
    // `resolveScheduleRevisionForPin()` deliberately uses the same
    // executable-resolution path as a fresh start (Codex review, PR #978,
    // round 5) — for an eager-registered type, or when only one revision
    // is a viable dynamic-source candidate, the captured pin can differ
    // from whatever the catalog's active pointer shows. This exact hedge
    // now legitimately renders TWICE while the operator has "Pinned"
    // selected — once here in the re-capture warning, and once in the
    // still-visible "Active at fire" option's own description (Codex
    // review, PR #978, round 7: the active-at-fire consequence text needed
    // the identical caveat, since a fresh occurrence can bypass the active
    // pointer the same way) — `RadioGroup` renders every option's
    // description regardless of which one is currently selected.
    expect(
      getAllByText(/a fresh start can run without consulting the active pointer at all/).length,
    ).toBe(2);
  });

  test('does NOT show the pinned warning when active-at-fire is selected in edit mode', async () => {
    const form = new ScheduleFormState({
      id: 'nightly-rollup',
      workflowType: 'report-gen',
      revisionPolicy: 'active-at-fire',
    });

    const { queryByText } = render(ScheduleFormFields, {
      props: { form, mode: 'edit', workflowTypeOptions: undefined },
    });

    expect(queryByText(/captures whichever revision is active right now/)).toBeNull();
  });

  test('does NOT show the pinned warning for an already-pinned schedule left unchanged — toUpdateRevisionPolicy() sends nothing, so the prior "never a no-op" framing was misleading (Codex review, PR #978)', async () => {
    const form = new ScheduleFormState({
      id: 'nightly-rollup',
      workflowType: 'report-gen',
      revisionPolicy: 'pinned',
    });

    const { queryByText } = render(ScheduleFormFields, {
      props: { form, mode: 'edit', workflowTypeOptions: undefined },
    });

    expect(form.toUpdateRevisionPolicy()).toBeUndefined();
    expect(queryByText(/captures whichever revision is active right now/)).toBeNull();
  });

  test("a fresh mount always captures its OWN form instance's revisionPolicy — the one-shot draft is safe precisely because the parent guarantees a fresh mount per form instance (Codex review, PR #978, round 2; see schedule-form-drawer.svelte's `{#key form}` and drawer test for the swap-while-mounted case this documents)", async () => {
    const firstForm = new ScheduleFormState({
      id: 'nightly-rollup',
      workflowType: 'report-gen',
      revisionPolicy: 'active-at-fire',
    });
    const { getByRole: getByRoleFirst, unmount } = render(ScheduleFormFields, {
      props: { form: firstForm, mode: 'edit', workflowTypeOptions: undefined },
    });
    expect(
      requireElement(getByRoleFirst('radio', { name: 'Active at fire' }), HTMLInputElement).checked,
    ).toBe(true);
    unmount();

    const secondForm = new ScheduleFormState({
      id: 'nightly-rollup',
      workflowType: 'report-gen',
      revisionPolicy: 'pinned',
    });
    const { getByRole: getByRoleSecond } = render(ScheduleFormFields, {
      props: { form: secondForm, mode: 'edit', workflowTypeOptions: undefined },
    });
    expect(
      requireElement(getByRoleSecond('radio', { name: 'Pinned' }), HTMLInputElement).checked,
    ).toBe(true);
  });
});

describe('ScheduleFormFields — revision policy (create mode)', () => {
  test('renders both REVISION_POLICIES options with their labels and consequences', async () => {
    const form = new ScheduleFormState();

    const { getByText } = render(ScheduleFormFields, {
      props: { form, mode: 'create', workflowTypeOptions: undefined },
    });

    expect(getByText('Active at fire')).not.toBeNull();
    expect(getByText('Pinned')).not.toBeNull();
    expect(getByText(/Each occurrence resolves whichever revision is active/)).not.toBeNull();
    expect(getByText(/Every occurrence resolves the exact revision captured/)).not.toBeNull();
  });

  test('selecting Pinned updates form.revisionPolicy', async () => {
    const form = new ScheduleFormState();

    const { getByRole } = render(ScheduleFormFields, {
      props: { form, mode: 'create', workflowTypeOptions: undefined },
    });

    await fireEvent.click(getByRole('radio', { name: 'Pinned' }));

    expect(form.revisionPolicy).toBe('pinned');
  });
});
