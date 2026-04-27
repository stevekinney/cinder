import { render } from 'svelte/server';
import { Button, type ButtonProps } from 'cinder';

const props: ButtonProps = {
  variant: 'primary',
  size: 'md',
  label: 'hello from node',
};

const result = render(Button, { props });

process.stdout.write(result.body);
process.stdout.write('\n');
