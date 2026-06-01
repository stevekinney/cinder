<script lang="ts" module>
  export const title = 'Empty table';
  export const description = 'A table with no body rows still renders the header and caption.';
</script>

<script lang="ts">
  import { Table } from 'cinder/table';
</script>

<Table caption="Recent contributors (none yet)">
  <Table.Header>
    <Table.Row>
      <Table.HeaderCell>Name</Table.HeaderCell>
      <Table.HeaderCell>Role</Table.HeaderCell>
      <Table.HeaderCell align="right">Commits</Table.HeaderCell>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    <Table.Row>
      <Table.Cell>
        <span style="color: var(--cinder-text-muted); font-style: italic;"
          >No contributors yet — invite your team to get started.</span
        >
      </Table.Cell>
      <Table.Cell>—</Table.Cell>
      <Table.Cell align="right">0</Table.Cell>
    </Table.Row>
  </Table.Body>
</Table>
