import { CRON_FIELDS } from './schedule-builder.utilities.ts';

export type CronEditorMode = 'every' | 'specific' | 'range' | 'step' | 'advanced';

export type CronEditor = {
  mode: CronEditorMode;
  value: number;
  start: number;
  end: number;
  step: number;
};

export function editorFromCronField(raw: string, index: number): CronEditor {
  const field = CRON_FIELDS[index]!;
  const value = raw.trim();
  const specific = /^\d+$/.exec(value);
  const range = /^(\d+)-(\d+)$/.exec(value);
  const step = /^\*\/(\d+)$/.exec(value);
  if (specific) {
    return {
      mode: 'specific',
      value: Number(specific[0]),
      start: field.min,
      end: field.max,
      step: 1,
    };
  }
  if (range) {
    return {
      mode: 'range',
      value: field.min,
      start: Number(range[1]),
      end: Number(range[2]),
      step: 1,
    };
  }
  if (step) {
    return {
      mode: 'step',
      value: field.min,
      start: field.min,
      end: field.max,
      step: Number(step[1]),
    };
  }
  return {
    mode: value === '*' ? 'every' : 'advanced',
    value: field.min,
    start: field.min,
    end: field.max,
    step: 1,
  };
}

export function cronExpressionForEditor(editor: CronEditor): string {
  switch (editor.mode) {
    case 'specific':
      return String(editor.value);
    case 'range':
      return `${editor.start}-${editor.end}`;
    case 'step':
      return `*/${editor.step}`;
    case 'every':
      return '*';
    default:
      return '';
  }
}
