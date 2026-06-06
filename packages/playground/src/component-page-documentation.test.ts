/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../components/src/test/happy-dom.ts';
import type { ComponentDocumentationPayload } from './component-documentation-types.ts';

setupHappyDom();

const { fireEvent, render, screen, waitFor } = await import('@testing-library/svelte');
const { default: ContainerMock } = await import('./component-page-container-mock.svelte');
const { default: AccordionItemMock } = await import('./component-page-accordion-item-mock.svelte');
const { default: BadgeMock } = await import('./component-page-badge-mock.svelte');
const { default: ButtonMock } = await import('./component-page-button-mock.svelte');
const { default: CalloutMock } = await import('./component-page-callout-mock.svelte');
const { default: CardMock } = await import('./component-page-card-mock.svelte');
const { default: CodeBlockMock } = await import('./component-page-code-block-mock.svelte');
const { default: SkeletonMock } = await import('./component-page-skeleton-mock.svelte');
const tableModule = (await import('./component-page-table-mock.svelte')) as unknown as {
  default: unknown;
  Header: unknown;
  HeaderCell: unknown;
  Row: unknown;
  Body: unknown;
  Cell: unknown;
};
const probeModule = (await import('./component-page-scenario-probe.svelte')) as unknown as {
  default: unknown;
  ledgerFor: (scenario: string) => { mounts: number; unmounts: number; live: number };
  resetLedgers: () => void;
};
const { default: Probe, ledgerFor, resetLedgers } = probeModule;
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
mock.module('@lostgradient/cinder/badge', () => ({ Badge: BadgeMock }));
mock.module('@lostgradient/cinder/button', () => ({ Button: ButtonMock }));
mock.module('@lostgradient/cinder/callout', () => ({ Callout: CalloutMock }));
mock.module('@lostgradient/cinder/card', () => ({ Card: CardMock }));
mock.module('@lostgradient/cinder/code-block', () => ({ CodeBlock: CodeBlockMock }));
mock.module('@lostgradient/cinder/skeleton', () => ({ Skeleton: SkeletonMock }));
mock.module('@lostgradient/cinder/table', () => ({ Table: TableMock }));

const { default: ComponentPage } = await import('./component-page.svelte');

const documentationFixture: ComponentDocumentationPayload = {
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
    avoidWhen: ['Selecting from a fixed set.'],
    related: ['copy-button'],
    hasConstraints: true,
    hasExamples: true,
    artifacts: {
      schema: '@lostgradient/cinder/button/schema',
      variables: '@lostgradient/cinder/button/variables',
      constraints: '@lostgradient/cinder/button/constraints',
      examples: '@lostgradient/cinder/button/examples',
    },
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
        defaultValue: 'secondary',
        bindable: false,
        optional: true,
        description: 'Visual style.',
      },
    ],
  },
  schema: {
    type: 'object',
    required: ['variant'],
    properties: {
      variant: { type: 'string', enum: ['primary', 'secondary'] },
    },
  },
  variables: ['--cinder-button-background'],
  constraints: {
    component: 'button',
    summary: 'Button constraints summary.',
    rules: [
      {
        id: 'accessible-name',
        severity: 'error',
        description: 'Icon-only buttons must have an accessible name.',
        kind: 'anyOf',
      },
    ],
    examples: {
      valid: [{ title: 'Visible label', code: '<Button label="Save" />' }],
      invalid: [
        {
          title: 'Missing label',
          code: '<Button iconOnly />',
          violates: 'accessible-name',
        },
      ],
    },
  },
  examples: {
    component: 'button',
    examples: [{ id: 'primary', title: 'Primary', code: '<Button label="Save" />' }],
  },
  rawArtifacts: {
    manifestEntry: {
      id: 'button',
      name: 'Button',
      import: '@lostgradient/cinder/button',
    },
    schema: {
      type: 'object',
      properties: {
        variant: { type: 'string' },
      },
    },
    variables: ['--cinder-button-background'],
    constraints: {
      component: 'button',
      rules: [{ id: 'accessible-name' }],
    },
    examples: {
      component: 'button',
      examples: [{ id: 'primary' }],
    },
  },
};

const originalFetch = globalThis.fetch;

function installDocumentationFetch(): void {
  globalThis.fetch = (async (url: string | URL | Request) => {
    const href = url instanceof Request ? url.url : String(url);
    if (href === '/api/documentation/button') {
      return new Response(JSON.stringify(documentationFixture), {
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
  installDocumentationFetch();
});

afterEach(() => {
  resetLedgers();
  globalThis.fetch = originalFetch;
  document.body.innerHTML = '';
});

describe('component-page documentation tabs', () => {
  test('renders all documentation tabs from a fixture payload', async () => {
    const { unmount } = render(ComponentPage);

    for (const label of [
      'Overview',
      'Examples',
      'API',
      'Styling',
      'Constraints',
      'Raw Artifacts',
    ]) {
      expect(screen.getByRole('tab', { name: label })).toBeTruthy();
    }

    await screen.findByText('Fixture purpose for a documentation page.');
    expect(screen.getByText('Rendered README body.')).toBeTruthy();

    unmount();
    await tick();
  });

  test('keeps tab panels in the DOM and mounts hidden examples on first render', async () => {
    Reflect.set(window, '__CINDER_EXAMPLES__', [{ scenario: 'primary', title: 'Primary' }]);
    Reflect.set(window, '__CINDER_SCENARIOS__', { primary: Probe });

    const { unmount } = render(ComponentPage);
    await tick();

    for (const tab of screen.getAllByRole('tab')) {
      const controlledPanel = tab.getAttribute('aria-controls');
      expect(typeof controlledPanel).toBe('string');
      expect(document.getElementById(controlledPanel ?? '')).toBeTruthy();
    }

    const exampleMount = document.getElementById('example-mount-primary');
    expect(exampleMount).toBeTruthy();
    expect(ledgerFor('primary').mounts).toBe(1);
    expect(exampleMount?.querySelectorAll('.scenario-probe').length).toBe(1);

    unmount();
    await tick();
  });

  test('opens the Examples tab by default in snapshot mode', async () => {
    const happyWindow = window as unknown as { happyDOM: { setURL(url: string): void } };
    happyWindow.happyDOM.setURL('http://localhost/page/button?snapshot=1');
    Reflect.set(window, '__CINDER_EXAMPLES__', [{ scenario: 'primary', title: 'Primary' }]);
    Reflect.set(window, '__CINDER_SCENARIOS__', { primary: Probe });

    const { unmount } = render(ComponentPage);
    await tick();

    expect(screen.getByRole('tab', { name: 'Examples' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(document.getElementById('tabpanel-examples')?.hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('tabpanel-overview')?.hasAttribute('hidden')).toBe(true);
    expect(document.getElementById('example-mount-primary')).toBeTruthy();

    unmount();
    await tick();
  });

  test('raw artifact panels render valid JSON in CodeBlock', async () => {
    const { unmount } = render(ComponentPage);

    await fireEvent.click(screen.getByRole('tab', { name: 'Raw Artifacts' }));
    await screen.findByRole('heading', { name: 'Raw Artifacts' });

    await waitFor(() => {
      const blocks = Array.from(document.querySelectorAll('.raw-artifact-panel pre code'));
      expect(blocks.length).toBe(5);
      for (const block of blocks) {
        expect(() => JSON.parse(block.textContent ?? '')).not.toThrow();
      }
    });

    unmount();
    await tick();
  });
});
