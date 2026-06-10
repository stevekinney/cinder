<script lang="ts" module>
  export const title = 'Sortable data table';
  export const description =
    'Multiple sortable columns with a scrollable wrapper. Sort state is bound and rows are reordered via $derived.';
</script>

<script lang="ts">
  import { DataTable } from '@lostgradient/cinder/data-table';
  import type { TableSort } from '@lostgradient/cinder/table';

  type Contributor = {
    name: string;
    role: string;
    commits: number;
    reviews: number;
  };

  const contributors: Contributor[] = [
    { name: 'Ada Lovelace', role: 'Mathematician', commits: 142, reviews: 34 },
    { name: 'Grace Hopper', role: 'Computer Scientist', commits: 98, reviews: 41 },
    { name: 'Alan Turing', role: 'Cryptanalyst', commits: 76, reviews: 28 },
    { name: 'Margaret Hamilton', role: 'Software Engineer', commits: 304, reviews: 87 },
    { name: 'Linus Torvalds', role: 'Systems Engineer', commits: 512, reviews: 19 },
    { name: 'Dennis Ritchie', role: 'Language Designer', commits: 231, reviews: 55 },
  ];

  const columns = [
    { key: 'name' as const, label: 'Name', sortable: true, rowHeader: true },
    { key: 'role' as const, label: 'Role', sortable: true },
    { key: 'commits' as const, label: 'Commits', sortable: true, align: 'end' as const },
    { key: 'reviews' as const, label: 'Reviews', sortable: true, align: 'end' as const },
  ];

  let sort: TableSort | undefined = $state();

  const sortedContributors = $derived.by(() => {
    if (!sort) return contributors;
    return [...contributors].sort((a, b) => {
      const key = sort!.column as keyof Contributor;
      const aValue = a[key];
      const bValue = b[key];
      const comparison =
        typeof aValue === 'number' && typeof bValue === 'number'
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue));
      return sort!.direction === 'ascending' ? comparison : -comparison;
    });
  });
</script>

<DataTable caption="Top contributors" {columns} rows={sortedContributors} bind:sort scrollable />
