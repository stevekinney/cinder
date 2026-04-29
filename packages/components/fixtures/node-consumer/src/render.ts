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
  PageLayout,
  Pagination,
  Select,
  Skeleton,
  Spinner,
  Textarea,
  Toggle,
  Tooltip,
} from 'cinder';

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
  { name: 'PageLayout', component: PageLayout, props: { title: 'My page', children: noopSnippet } },
  { name: 'NavigationBar', component: NavigationBar, props: { items: noopSnippet } },
  { name: 'Pagination', component: Pagination, props: { currentPage: 1, totalPages: 5 } },
  { name: 'Toggle', component: Toggle, props: { id: 'toggle-1', pressed: false, label: 'Toggle' } },
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
