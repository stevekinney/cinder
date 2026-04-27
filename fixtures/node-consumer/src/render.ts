import { render } from 'svelte/server';

// Subpath imports — each component resolved independently
import AccordionItem from 'cinder/accordion-item';
import Accordion from 'cinder/accordion';
import Alert from 'cinder/alert';
import Badge from 'cinder/badge';
import Button from 'cinder/button';
import Card from 'cinder/card';
import DataList from 'cinder/data-list';
import Dropdown from 'cinder/dropdown';
import EmptyState from 'cinder/empty-state';
import Input from 'cinder/input';
import Modal from 'cinder/modal';
import NavigationBar from 'cinder/navigation-bar';
import NavigationItem from 'cinder/navigation-item';
import PageLayout from 'cinder/page-layout';
import Pagination from 'cinder/pagination';
import Select from 'cinder/select';
import Skeleton from 'cinder/skeleton';
import Spinner from 'cinder/spinner';
import Textarea from 'cinder/textarea';
import Toggle from 'cinder/toggle';
import Tooltip from 'cinder/tooltip';

// Render each component in its default/closed SSR state and write to stdout.
// The validate-consumers.ts script checks the output for component root classes.

const components: Array<{ name: string; component: unknown; props: Record<string, unknown> }> = [
  { name: 'Button', component: Button, props: { label: 'hello from node' } },
  { name: 'Alert', component: Alert, props: { variant: 'info' } },
  { name: 'Badge', component: Badge, props: { variant: 'neutral' } },
  { name: 'Skeleton', component: Skeleton, props: { width: '100px', height: '16px' } },
  { name: 'Spinner', component: Spinner, props: { size: 'md' } },
  { name: 'EmptyState', component: EmptyState, props: { title: 'Nothing yet' } },
  { name: 'PageLayout', component: PageLayout, props: { title: 'My page' } },
  { name: 'NavigationBar', component: NavigationBar, props: {} },
  { name: 'Pagination', component: Pagination, props: { currentPage: 1, totalPages: 5 } },
  { name: 'Toggle', component: Toggle, props: { id: 'toggle-1', pressed: false, label: 'Toggle' } },
  // Lazy-mount components render only their trigger surface at open=false
  { name: 'Modal', component: Modal, props: { open: false, title: 'My modal' } },
  { name: 'Dropdown', component: Dropdown, props: { open: false } },
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
