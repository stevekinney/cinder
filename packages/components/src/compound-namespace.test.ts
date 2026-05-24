/**
 * Runtime regression test for compound-namespace exports.
 *
 * Each parent compound component (Tabs/Table/Dropdown/Accordion/Tree/Feed/
 * GridList/StatGroup/SideNavigation) exposes its compose-only leaves under
 * idiomatic property names (`Tabs.List`, `Table.Body`, etc.) while preserving
 * the original flat root exports. This test pins both invariants so a future
 * refactor cannot silently drop a namespace property or accidentally divorce
 * a namespace property from its flat-export counterpart.
 *
 * Type-level assertions verify that namespace properties are not `any` and
 * are structurally identical to the matching flat leaf component types.
 */

import { describe, expect, it } from 'bun:test';

import {
  Accordion,
  AccordionItem,
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
  Feed,
  FeedEvent,
  GridList,
  GridListItem,
  SideNavigation,
  SideNavigationGroup,
  SideNavigationItem,
  Stat,
  StatGroup,
  Tab,
  TabList,
  TabPanel,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Tabs,
  Tree,
  TreeItem,
} from './index.ts';

describe('compound-namespace runtime references', () => {
  it('Tabs exposes List/Trigger/Panel pointing at flat leaf exports', () => {
    expect(Tabs.List).toBe(TabList);
    expect(Tabs.Trigger).toBe(Tab);
    expect(Tabs.Panel).toBe(TabPanel);
  });

  it('Table exposes Body/Cell/Header/HeaderCell/Row pointing at flat leaf exports', () => {
    expect(Table.Body).toBe(TableBody);
    expect(Table.Cell).toBe(TableCell);
    expect(Table.Header).toBe(TableHeader);
    expect(Table.HeaderCell).toBe(TableHeaderCell);
    expect(Table.Row).toBe(TableRow);
  });

  it('Dropdown exposes Trigger/Menu/Item/Label/Separator pointing at flat leaf exports', () => {
    expect(Dropdown.Trigger).toBe(DropdownTrigger);
    expect(Dropdown.Menu).toBe(DropdownMenu);
    expect(Dropdown.Item).toBe(DropdownItem);
    expect(Dropdown.Label).toBe(DropdownLabel);
    expect(Dropdown.Separator).toBe(DropdownSeparator);
  });

  it('Accordion exposes Item pointing at the flat AccordionItem export', () => {
    expect(Accordion.Item).toBe(AccordionItem);
  });

  it('Tree exposes Item pointing at the flat TreeItem export', () => {
    expect(Tree.Item).toBe(TreeItem);
  });

  it('Feed exposes Event pointing at the flat FeedEvent export', () => {
    expect(Feed.Event).toBe(FeedEvent);
  });

  it('GridList exposes Item pointing at the flat GridListItem export', () => {
    expect(GridList.Item).toBe(GridListItem);
  });

  it('StatGroup exposes Stat pointing at the flat Stat export', () => {
    expect(StatGroup.Stat).toBe(Stat);
  });

  it('SideNavigation exposes Group/Item pointing at the flat exports', () => {
    expect(SideNavigation.Group).toBe(SideNavigationGroup);
    expect(SideNavigation.Item).toBe(SideNavigationItem);
  });
});

describe('compound-namespace flat-export compatibility', () => {
  it('every flat leaf component remains importable from the root barrel', () => {
    // If any of these become undefined the named import above would throw,
    // but checking explicitly documents the contract and pins it against
    // accidental tree-shake reshuffling.
    const flatLeaves = [
      AccordionItem,
      DropdownItem,
      DropdownLabel,
      DropdownMenu,
      DropdownSeparator,
      DropdownTrigger,
      FeedEvent,
      GridListItem,
      SideNavigationGroup,
      SideNavigationItem,
      Stat,
      Tab,
      TabList,
      TabPanel,
      TableBody,
      TableCell,
      TableHeader,
      TableHeaderCell,
      TableRow,
      TreeItem,
    ];
    for (const leaf of flatLeaves) {
      expect(typeof leaf).toBe('function');
    }
  });
});

// ---------------------------------------------------------------------------
// Compile-time type assertions. Each `_typeProbe*` name is intentionally
// unused at runtime — its purpose is to fail `tsc --noEmit` (and therefore
// the package typecheck script) if a namespace property degrades to `any`
// or stops matching its flat-leaf counterpart.
// ---------------------------------------------------------------------------

type IsAny<T> = 0 extends 1 & T ? true : false;
type Expect<T extends true> = T;
type Same<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// Sanity: IsAny<any> === true, IsAny<typeof Tab> === false.
type _typeProbe_TabsListIsNotAny = Expect<IsAny<typeof Tabs.List> extends false ? true : false>;
type _typeProbe_TabsTriggerIsNotAny = Expect<
  IsAny<typeof Tabs.Trigger> extends false ? true : false
>;
type _typeProbe_TabsPanelIsNotAny = Expect<IsAny<typeof Tabs.Panel> extends false ? true : false>;
type _typeProbe_TableBodyIsNotAny = Expect<IsAny<typeof Table.Body> extends false ? true : false>;
type _typeProbe_DropdownItemIsNotAny = Expect<
  IsAny<typeof Dropdown.Item> extends false ? true : false
>;
type _typeProbe_AccordionItemIsNotAny = Expect<
  IsAny<typeof Accordion.Item> extends false ? true : false
>;

// Structural identity: namespace property must equal its flat-leaf counterpart.
type _typeProbe_TabsListMatchesFlat = Expect<Same<typeof Tabs.List, typeof TabList>>;
type _typeProbe_TabsTriggerMatchesFlat = Expect<Same<typeof Tabs.Trigger, typeof Tab>>;
type _typeProbe_TabsPanelMatchesFlat = Expect<Same<typeof Tabs.Panel, typeof TabPanel>>;
type _typeProbe_TableBodyMatchesFlat = Expect<Same<typeof Table.Body, typeof TableBody>>;
type _typeProbe_TableCellMatchesFlat = Expect<Same<typeof Table.Cell, typeof TableCell>>;
type _typeProbe_TableHeaderMatchesFlat = Expect<Same<typeof Table.Header, typeof TableHeader>>;
type _typeProbe_TableHeaderCellMatchesFlat = Expect<
  Same<typeof Table.HeaderCell, typeof TableHeaderCell>
>;
type _typeProbe_TableRowMatchesFlat = Expect<Same<typeof Table.Row, typeof TableRow>>;
type _typeProbe_DropdownTriggerMatchesFlat = Expect<
  Same<typeof Dropdown.Trigger, typeof DropdownTrigger>
>;
type _typeProbe_DropdownMenuMatchesFlat = Expect<Same<typeof Dropdown.Menu, typeof DropdownMenu>>;
type _typeProbe_DropdownItemMatchesFlat = Expect<Same<typeof Dropdown.Item, typeof DropdownItem>>;
type _typeProbe_DropdownLabelMatchesFlat = Expect<
  Same<typeof Dropdown.Label, typeof DropdownLabel>
>;
type _typeProbe_DropdownSeparatorMatchesFlat = Expect<
  Same<typeof Dropdown.Separator, typeof DropdownSeparator>
>;
type _typeProbe_AccordionItemMatchesFlat = Expect<
  Same<typeof Accordion.Item, typeof AccordionItem>
>;
type _typeProbe_TreeItemMatchesFlat = Expect<Same<typeof Tree.Item, typeof TreeItem>>;
type _typeProbe_FeedEventMatchesFlat = Expect<Same<typeof Feed.Event, typeof FeedEvent>>;
type _typeProbe_GridListItemMatchesFlat = Expect<Same<typeof GridList.Item, typeof GridListItem>>;
type _typeProbe_StatGroupStatMatchesFlat = Expect<Same<typeof StatGroup.Stat, typeof Stat>>;
type _typeProbe_SideNavigationGroupMatchesFlat = Expect<
  Same<typeof SideNavigation.Group, typeof SideNavigationGroup>
>;
type _typeProbe_SideNavigationItemMatchesFlat = Expect<
  Same<typeof SideNavigation.Item, typeof SideNavigationItem>
>;

// Reference the probe aliases so oxlint does not flag them as unused exports.
type _typeProbeBundle = [
  _typeProbe_TabsListIsNotAny,
  _typeProbe_TabsTriggerIsNotAny,
  _typeProbe_TabsPanelIsNotAny,
  _typeProbe_TableBodyIsNotAny,
  _typeProbe_DropdownItemIsNotAny,
  _typeProbe_AccordionItemIsNotAny,
  _typeProbe_TabsListMatchesFlat,
  _typeProbe_TabsTriggerMatchesFlat,
  _typeProbe_TabsPanelMatchesFlat,
  _typeProbe_TableBodyMatchesFlat,
  _typeProbe_TableCellMatchesFlat,
  _typeProbe_TableHeaderMatchesFlat,
  _typeProbe_TableHeaderCellMatchesFlat,
  _typeProbe_TableRowMatchesFlat,
  _typeProbe_DropdownTriggerMatchesFlat,
  _typeProbe_DropdownMenuMatchesFlat,
  _typeProbe_DropdownItemMatchesFlat,
  _typeProbe_DropdownLabelMatchesFlat,
  _typeProbe_DropdownSeparatorMatchesFlat,
  _typeProbe_AccordionItemMatchesFlat,
  _typeProbe_TreeItemMatchesFlat,
  _typeProbe_FeedEventMatchesFlat,
  _typeProbe_GridListItemMatchesFlat,
  _typeProbe_StatGroupStatMatchesFlat,
  _typeProbe_SideNavigationGroupMatchesFlat,
  _typeProbe_SideNavigationItemMatchesFlat,
];

// One synthetic value usage so the bundle alias cannot be dead-code-eliminated.
const _typeProbeWitness: _typeProbeBundle = [
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
];

it('type probes resolve to true', () => {
  for (const witness of _typeProbeWitness) {
    expect(witness).toBe(true);
  }
});
