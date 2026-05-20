<script lang="ts" module>
  export const title = 'Right-to-left (RTL)';
  export const description =
    'Logical properties automatically flip collapsed borders and outer corner rounding when the writing direction is RTL.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { ButtonGroup } from 'cinder/button-group';
  import { Dropdown } from 'cinder/dropdown';
  import { DropdownItem } from 'cinder/dropdown-item';
  import { DropdownMenu } from 'cinder/dropdown-menu';
  import { DropdownTrigger } from 'cinder/dropdown-trigger';
</script>

<div dir="rtl">
  <ButtonGroup label="خيارات الحفظ">
    <Button>حفظ</Button>
    <Dropdown id="save-options-rtl">
      <DropdownTrigger aria-label="المزيد من خيارات الحفظ" />
      <DropdownMenu>
        <DropdownItem>حفظ كمسودة</DropdownItem>
        <DropdownItem>حفظ ونشر</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  </ButtonGroup>
</div>
