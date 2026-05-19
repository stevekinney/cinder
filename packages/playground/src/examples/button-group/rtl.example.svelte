<script lang="ts" module>
  export const title = 'Right-to-left (RTL)';
  export const description =
    'Logical properties automatically flip collapsed borders and outer corner rounding when the writing direction is RTL.';
</script>

<script lang="ts">
  import {
    Button,
    ButtonGroup,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
  } from '../../../../components/src/index.ts';
  import { ChevronDown } from '../../../../components/src/components/icons/index.ts';
</script>

<div dir="rtl">
  <ButtonGroup label="خيارات الحفظ">
    <Button>حفظ</Button>
    <Dropdown id="save-options-rtl">
      <DropdownTrigger aria-label="المزيد من خيارات الحفظ">
        <ChevronDown size={16} />
      </DropdownTrigger>
      <DropdownMenu>
        <DropdownItem>حفظ كمسودة</DropdownItem>
        <DropdownItem>حفظ ونشر</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  </ButtonGroup>
</div>
