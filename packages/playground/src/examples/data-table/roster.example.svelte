<script lang="ts" module>
  export const title = 'Class roster';
  export const description =
    'A class roster with a sortable grade column. The Name column is the row header (scope="row"). Bind sort state and reorder rows in a $derived expression.';
</script>

<script lang="ts">
  import { DataTable } from '@lostgradient/cinder/data-table';
  import type { TableSort } from '@lostgradient/cinder/table';

  type Student = {
    name: string;
    subject: string;
    grade: number;
  };

  const students: Student[] = [
    { name: 'Ada Lovelace', subject: 'Mathematics', grade: 98 },
    { name: 'Grace Hopper', subject: 'Computer Science', grade: 92 },
    { name: 'Alan Turing', subject: 'Cryptography', grade: 95 },
    { name: 'Margaret Hamilton', subject: 'Software Engineering', grade: 89 },
  ];

  const columns = [
    { key: 'name' as const, label: 'Name', rowHeader: true },
    { key: 'subject' as const, label: 'Subject' },
    { key: 'grade' as const, label: 'Grade', sortable: true, align: 'end' as const },
  ];

  let sort: TableSort | undefined = $state();

  const sortedStudents = $derived.by(() => {
    if (!sort) return students;
    return [...students].sort((a, b) => {
      const key = sort!.column as keyof Student;
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

<DataTable caption="Spring semester roster" {columns} rows={sortedStudents} bind:sort />
