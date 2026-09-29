import {
  Button,
  Modal,
  buttonConstraints,
  buttonExamples,
  buttonSchema,
  buttonVariables,
  manifest,
  schemaFormSchema,
  type ButtonProps,
} from '@lostgradient/cinder';
import { describe, expect, it } from 'bun:test';

describe('@lostgradient/cinder root API', () => {
  it('exposes named component values and types from the single package entrypoint', () => {
    const props: Partial<ButtonProps> = { variant: 'primary' };
    expect(Button).toBeDefined();
    expect(Modal).toBeDefined();
    expect(props.variant).toBe('primary');
  });

  it('exposes component metadata from the same package entrypoint', () => {
    expect(manifest.components).toHaveLength(200);
    expect(buttonSchema.type).toBe('object');
    expect(buttonVariables).toContain('--cinder-button-background');
    expect(buttonConstraints.component).toBe('button');
    expect(buttonExamples.component).toBe('button');
    expect(schemaFormSchema.type).toBe('object');
  });

  it('loads the root stylesheet side effect with the root API', async () => {
    const source = await Bun.file(new URL('./index.ts', import.meta.url)).text();
    expect(source).toContain("import './styles/index.css';");
  });
});
