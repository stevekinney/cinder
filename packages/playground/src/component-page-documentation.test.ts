/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../components/src/test/happy-dom.ts';
import type { ComponentDocumentationPayload } from './component-documentation-types.ts';

setupHappyDom();

const { fireEvent, render, screen, waitFor } = await import('@testing-library/svelte');
const { default: ContainerMock } = await import('./component-page-container-mock.svelte');
const { default: AccordionItemMock } = await import('./component-page-accordion-item-mock.svelte');
const { default: AlertMock } = await import('./component-page-alert-mock.svelte');
const { default: BadgeMock } = await import('./component-page-badge-mock.svelte');
const { default: ButtonMock } = await import('./component-page-button-mock.svelte');
const { default: CalloutMock } = await import('./component-page-callout-mock.svelte');
const { default: CodeBlockMock } = await import('./component-page-code-block-mock.svelte');
const { default: CollapsibleMock } = await import('./component-page-collapsible-mock.svelte');
const { default: KbdMock } = await import('./component-page-kbd-mock.svelte');
const { default: SkeletonMock } = await import('./component-page-skeleton-mock.svelte');
const { default: StatusDotMock } = await import('./component-page-status-dot-mock.svelte');
const { default: ToggleMock } = await import('./component-page-toggle-mock.svelte');
const { default: TooltipMock } = await import('./component-page-tooltip-mock.svelte');
const tableModule = (await import('./component-page-table-mock.svelte')) as unknown as {
  default: unknown;
  Header: unknown;
  HeaderCell: unknown;
  Row: unknown;
  Body: unknown;
  Cell: unknown;
};
const probeModule = (await import('./component-page-scenario-probe.svelte')) as unknown as {
  resetLedgers: () => void;
};
const { resetLedgers } = probeModule;
const { tick } = await import('svelte');
type TableMockComponent = {
  Header: unknown;
  HeaderCell: unknown;
  Row: unknown;
  Body: unknown;
  Cell: unknown;
};
const TableMock = tableModule.default as TableMockComponent;
TableMock.Header = tableModule.Header;
TableMock.HeaderCell = tableModule.HeaderCell;
TableMock.Row = tableModule.Row;
TableMock.Body = tableModule.Body;
TableMock.Cell = tableModule.Cell;

mock.module('@lostgradient/cinder/accordion', () => ({ Accordion: ContainerMock }));
mock.module('@lostgradient/cinder/accordion-item', () => ({ AccordionItem: AccordionItemMock }));
mock.module('@lostgradient/cinder/alert', () => ({ Alert: AlertMock }));
mock.module('@lostgradient/cinder/badge', () => ({ Badge: BadgeMock }));
mock.module('@lostgradient/cinder/button', () => ({ Button: ButtonMock }));
mock.module('@lostgradient/cinder/callout', () => ({ Callout: CalloutMock }));
mock.module('@lostgradient/cinder/code-block', () => ({ CodeBlock: CodeBlockMock }));
mock.module('@lostgradient/cinder/collapsible', () => ({ Collapsible: CollapsibleMock }));
mock.module('@lostgradient/cinder/kbd', () => ({ Kbd: KbdMock }));
mock.module('@lostgradient/cinder/skeleton', () => ({ Skeleton: SkeletonMock }));
mock.module('@lostgradient/cinder/status-dot', () => ({ StatusDot: StatusDotMock }));
mock.module('@lostgradient/cinder/table', () => ({ Table: TableMock }));
mock.module('@lostgradient/cinder/toggle', () => ({ Toggle: ToggleMock }));
mock.module('@lostgradient/cinder/tooltip', () => ({ Tooltip: TooltipMock }));

const { default: ComponentPage } = await import('./component-page.svelte');

function baseFixture(): ComponentDocumentationPayload {
  return {
    component: {
      id: 'button',
      name: 'Button',
      importSpecifier: '@lostgradient/cinder/button',
      exportName: 'Button',
      category: 'action',
      categoryLabel: 'Actions',
      categoryDescription: 'Controls that trigger operations, submit data, or navigate.',
      status: 'stable',
      statusDescription: 'Public API under semver protection.',
      purpose: 'Fixture purpose for a documentation page.',
      tags: ['action'],
      useWhen: ['Triggering a fixture action.'],
      avoidWhen: [{ reason: 'Selecting from a fixed set.', alternative: 'segmented-control' }],
      related: ['copy-button'],
      hasConstraints: false,
      hasExamples: true,
      artifacts: {
        schema: '@lostgradient/cinder/button/schema',
        variables: '@lostgradient/cinder/button/variables',
        constraints: '@lostgradient/cinder/button/constraints',
        examples: '@lostgradient/cinder/button/examples',
      },
      packageVersion: '0.2.0',
    },
    readme: {
      rawMarkdown: '# Button\n\nRendered README body.',
      html: '<h1>Button</h1><p>Rendered README body.</p>',
      codeBlocks: [],
      hadUnsafeContent: false,
    },
    propsManifest: {
      name: 'Button',
      kebabName: 'button',
      file: 'button.svelte',
      importPath: '@lostgradient/cinder/button',
      props: [
        {
          name: 'variant',
          control: { kind: 'select', options: ['primary', 'secondary'] },
          bindable: false,
          optional: true,
          defaultValue: 'primary',
        },
      ],
    },
    schema: {
      type: 'object',
      required: ['variant'],
      properties: { variant: { type: 'string', enum: ['primary', 'secondary'] } },
    },
    variables: ['--cinder-button-background'],
    constraints: null,
    examples: {
      component: 'button',
      examples: [{ id: 'primary', title: 'Primary', code: '<Button label="Save" />' }],
    },
    rawArtifacts: {
      manifestEntry: { id: 'button', name: 'Button', import: '@lostgradient/cinder/button' },
      schema: { type: 'object', properties: { variant: { type: 'string' } } },
      variables: ['--cinder-button-background'],
      constraints: null,
      examples: { component: 'button', examples: [{ id: 'primary' }] },
    },
  };
}

const originalFetch = globalThis.fetch;

function installDocumentationFetch(fixture: ComponentDocumentationPayload): void {
  globalThis.fetch = (async (url: string | URL | Request) => {
    const href = url instanceof Request ? url.url : String(url);
    if (href === '/api/documentation/button') {
      return new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404, statusText: 'Not Found' });
  }) as typeof fetch;
}

beforeEach(() => {
  resetLedgers();
  const happyWindow = window as unknown as { happyDOM: { setURL(url: string): void } };
  happyWindow.happyDOM.setURL('http://localhost/page/button');
  Reflect.set(window, '__CINDER_EXAMPLES__', []);
  Reflect.set(window, '__CINDER_SCENARIOS__', {});
  installDocumentationFetch(baseFixture());
});

afterEach(() => {
  resetLedgers();
  globalThis.fetch = originalFetch;
  document.body.innerHTML = '';
});

describe('component-page single-scroll layout', () => {
  test('renders the hero, spec card, and section anchors from a fixture', async () => {
    const { unmount } = render(ComponentPage);

    expect(await screen.findByRole('heading', { level: 1, name: 'Button' })).toBeTruthy();
    expect(screen.getByText('Fixture purpose for a documentation page.')).toBeTruthy();
    // Import line built from exportName + importSpecifier.
    expect(screen.getByText("import { Button } from '@lostgradient/cinder/button';")).toBeTruthy();
    // Spec card version row.
    expect(screen.getByText('v0.2.0')).toBeTruthy();

    // Section anchors resolve.
    for (const id of ['overview', 'guidance', 'props', 'related']) {
      expect(document.getElementById(id)).toBeTruthy();
    }
    // The README prose renders inside Overview.
    expect(screen.getByText('Rendered README body.')).toBeTruthy();

    unmount();
    await tick();
  });

  test('renders the When to use / Avoid cards with the alternative link', async () => {
    const { unmount } = render(ComponentPage);
    await screen.findByRole('heading', { level: 1, name: 'Button' });

    expect(screen.getByText('Triggering a fixture action.')).toBeTruthy();
    expect(screen.getByText('Selecting from a fixed set.')).toBeTruthy();
    // The avoidWhen alternative links to that component's page.
    const altLink = screen.getByRole('link', { name: /segmented-control/ });
    expect(altLink.getAttribute('href')).toBe('/c/segmented-control');

    unmount();
    await tick();
  });

  test('maps a non-stable status to a non-success badge variant', async () => {
    const beta = baseFixture();
    beta.component.status = 'beta';
    installDocumentationFetch(beta);

    const { unmount } = render(ComponentPage);
    const statusBadge = await screen.findByText('beta');
    expect(statusBadge.getAttribute('data-variant')).toBe('info');

    unmount();
    await tick();
  });

  test('builds a TOC from the sections that have data', async () => {
    const { unmount } = render(ComponentPage);
    await screen.findByRole('heading', { level: 1, name: 'Button' });

    const nav = screen.getByRole('navigation', { name: 'On this page' });
    const labels = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent?.trim() ?? '');
    expect(labels.some((label) => label.includes('Overview'))).toBe(true);
    expect(labels.some((label) => label.includes('When to use'))).toBe(true);
    expect(labels.some((label) => label.includes('Props'))).toBe(true);
    expect(labels.some((label) => label.includes('Related'))).toBe(true);
    // No a11y data in the base fixture → no Accessibility entry.
    expect(labels.some((label) => label.includes('Accessibility'))).toBe(false);

    unmount();
    await tick();
  });

  test('omits the Accessibility section when the payload has no a11y data', async () => {
    const { unmount } = render(ComponentPage);
    await screen.findByRole('heading', { level: 1, name: 'Button' });
    expect(document.getElementById('accessibility')).toBeNull();
    unmount();
    await tick();
  });

  test('renders the Accessibility section from a11y metadata', async () => {
    const withA11y = baseFixture();
    withA11y.component.a11y = {
      pattern: 'WAI-ARIA Button',
      keyboard: [{ keys: 'Enter / Space', action: 'Activates the button.' }],
      notes: ['Uses a native button element.'],
    };
    installDocumentationFetch(withA11y);

    const { unmount } = render(ComponentPage);
    await screen.findByRole('heading', { level: 1, name: 'Button' });

    expect(document.getElementById('accessibility')).toBeTruthy();
    expect(screen.getByText(/Implements the WAI-ARIA Button pattern/)).toBeTruthy();
    // Keyboard table built from Kbd.
    expect(screen.getByText('Enter / Space')).toBeTruthy();
    expect(screen.getByText('Activates the button.')).toBeTruthy();
    expect(screen.getByText('Uses a native button element.')).toBeTruthy();

    unmount();
    await tick();
  });

  test('omits the Related section when there are no related components', async () => {
    const noRelated = baseFixture();
    noRelated.component.related = [];
    installDocumentationFetch(noRelated);

    const { unmount } = render(ComponentPage);
    await screen.findByRole('heading', { level: 1, name: 'Button' });
    expect(document.getElementById('related')).toBeNull();
    unmount();
    await tick();
  });

  test('shows the Playground with a control derived from a select prop', async () => {
    const { unmount } = render(ComponentPage);
    await screen.findByRole('heading', { level: 1, name: 'Button' });

    // `variant` is a select prop with a default → a control is generated.
    expect(document.getElementById('playground')).toBeTruthy();
    const select = await screen.findByLabelText('variant');
    expect(select.tagName).toBe('SELECT');

    unmount();
    await tick();
  });

  // NOTE: the live-preview mount lifecycle (attachment mounts the registered
  // scenario into both the Overview and Examples containers, with cleanup parity)
  // is covered in `component-page-mount.test.ts`, which drives the attachment in
  // isolation. It can't be exercised here because `component-page.svelte` reads
  // `window.__CINDER_EXAMPLES__` into a module-level const at import time — before
  // this file's `beforeEach` can set it — so the examples list is empty here.

  test('surfaces a documentation fetch failure', async () => {
    globalThis.fetch = (async (_url: string | URL | Request) =>
      new Response('boom', { status: 500, statusText: 'Server Error' })) as typeof fetch;

    const { unmount } = render(ComponentPage);
    await waitFor(() => {
      expect(screen.getByText(/Could not load documentation/)).toBeTruthy();
    });

    unmount();
    await tick();
  });

  test('lazily renders raw-artifact code blocks only after the collapsible opens', async () => {
    const { unmount } = render(ComponentPage);
    await screen.findByRole('heading', { level: 1, name: 'Button' });

    // Before opening, the raw-artifact panels are not rendered.
    expect(document.querySelectorAll('.dx-raw__panel').length).toBe(0);

    await fireEvent.click(screen.getByRole('button', { name: 'Raw artifacts' }));
    await waitFor(() => {
      expect(document.querySelectorAll('.dx-raw__panel').length).toBe(5);
    });

    unmount();
    await tick();
  });
});
