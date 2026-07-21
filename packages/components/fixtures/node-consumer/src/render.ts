import { render } from 'svelte/server';

// Barrel import — uses the pre-compiled server bundle (the `node` export condition).
// Subpath imports are tested by the sveltekit-consumer fixture which uses Vite
// with the `svelte` condition. Node.js cannot load raw .svelte files.
import {
  Accordion,
  AccordionItem,
  Alert,
  Badge,
  Button,
  Card,
  DataList,
  Dropdown,
  EmptyState,
  Input,
  Modal,
  NavigationBar,
  NavigationItem,
  Pagination,
  Select,
  Skeleton,
  Spinner,
  Textarea,
  Toggle,
  Tooltip,
  useHistory,
} from '@lostgradient/cinder';

// Minimal no-op snippet for components that require children.
// In SSR the compiled output calls snippets as functions — an empty function works.
const noopSnippet = () => '';

// Render each component in its default/closed SSR state and write to stdout.
// The validate-consumers.ts script checks the output for component root classes.

const components: Array<{ name: string; component: unknown; props: Record<string, unknown> }> = [
  { name: 'Button', component: Button, props: { label: 'hello from node' } },
  { name: 'Alert', component: Alert, props: { variant: 'info', children: noopSnippet } },
  { name: 'Badge', component: Badge, props: { variant: 'neutral', children: noopSnippet } },
  { name: 'Skeleton', component: Skeleton, props: { width: '100px', height: '16px' } },
  { name: 'Spinner', component: Spinner, props: { size: 'md' } },
  { name: 'EmptyState', component: EmptyState, props: { title: 'Nothing yet' } },
  { name: 'NavigationBar', component: NavigationBar, props: { items: noopSnippet } },
  { name: 'Pagination', component: Pagination, props: { currentPage: 1, totalPages: 5 } },
  { name: 'Toggle', component: Toggle, props: { id: 'toggle-1', checked: false, label: 'Toggle' } },
  // Lazy-mount components render only their trigger surface at open=false
  {
    name: 'Modal',
    component: Modal,
    props: { open: false, title: 'My modal', children: noopSnippet },
  },
  {
    name: 'Dropdown',
    component: Dropdown,
    props: { open: false, trigger: noopSnippet, children: noopSnippet },
  },
];

for (const { name, component, props } of components) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = render(component as any, { props });
    process.stdout.write(`<!-- ${name} -->\n${result.body}\n`);
  } catch (err) {
    process.stderr.write(`Failed to render ${name}: ${String(err)}\n`);
    process.exit(1);
  }
}

// Snippet-based components require wrapping — just verify they are importable.
const snippetComponents = [
  { name: 'Card', component: Card },
  { name: 'DataList', component: DataList },
  { name: 'Input', component: Input },
  { name: 'NavigationItem', component: NavigationItem },
  { name: 'Select', component: Select },
  { name: 'Textarea', component: Textarea },
  { name: 'Tooltip', component: Tooltip },
  { name: 'Accordion', component: Accordion },
  { name: 'AccordionItem', component: AccordionItem },
];

for (const { name, component } of snippetComponents) {
  if (typeof component !== 'function') {
    process.stderr.write(`${name} is not a function — import failed\n`);
    process.exit(1);
  }
  process.stdout.write(`<!-- ${name} imported OK -->\n`);
}

if (typeof useHistory !== 'function') {
  process.stderr.write('useHistory is not a function — import failed\n');
  process.exit(1);
}

process.stdout.write('<!-- useHistory imported OK -->\n');

// PR 1: smoke-test the upstream re-export sub-paths. Each `@lostgradient/cinder/<pkg>/...`
// import must resolve in the published tarball and expose at least one
// recognizable named export. We only assert that a representative function
// or non-undefined value comes back — full behavior is covered by the
// upstream packages' own test suites. Imports are restricted to SSR-safe
// modules so this fixture stays runnable under Node 22 without a DOM.
import { computeLineDiff } from '@lostgradient/cinder/markdown/diff/line-diff';
import { renderMarkdown } from '@lostgradient/cinder/markdown/rendering';
import { isSafeUrl } from '@lostgradient/cinder/markdown/utilities/safe-url';
import { sortKeys } from '@lostgradient/cinder/markdown/utilities/sort-keys';

const upstreamProbes: Array<{ name: string; value: unknown }> = [
  { name: '@lostgradient/cinder/markdown/diff/line-diff#computeLineDiff', value: computeLineDiff },
  { name: '@lostgradient/cinder/markdown/rendering#renderMarkdown', value: renderMarkdown },
  { name: '@lostgradient/cinder/markdown/utilities/safe-url#isSafeUrl', value: isSafeUrl },
  { name: '@lostgradient/cinder/markdown/utilities/sort-keys#sortKeys', value: sortKeys },
];
for (const { name, value } of upstreamProbes) {
  if (typeof value !== 'function') {
    process.stderr.write(`${name} is not a function — upstream re-export resolution failed\n`);
    process.exit(1);
  }
  process.stdout.write(`<!-- ${name} imported OK -->\n`);
}
