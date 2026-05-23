/// <reference lib="dom" />
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: FileUpload } = await import('./file-upload.svelte');
const { default: FormFieldFileUploadFixture } =
  await import('../../test/fixtures/form-field-file-upload-fixture.svelte');

function createFile(name: string, type: string, size: number): File {
  const file = new File(['x'.repeat(Math.max(1, Math.min(size, 16)))], name, { type });
  Object.defineProperty(file, 'size', { configurable: true, value: size });
  return file;
}

function createFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* iterator() {
      for (const file of files) yield file;
    },
  } as FileList & { [index: number]: File };

  files.forEach((file, index) => {
    fileList[index] = file;
  });

  return fileList;
}

function attachInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: createFileList(files),
  });
}

function createDropEvent(type: string, files: File[]): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', {
    configurable: true,
    value: {
      files: createFileList(files),
      types: ['Files'],
      dropEffect: 'none',
    },
  });
  return event;
}

function createNonFileDropEvent(type: string): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', {
    configurable: true,
    value: {
      files: createFileList([]),
      types: ['text/plain'],
      dropEffect: 'none',
    },
  });
  return event;
}

function createDragLeaveWithoutDataTransfer(): DragEvent {
  const event = new Event('dragleave', { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', {
    configurable: true,
    value: null,
  });
  return event;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('FileUpload rendering', () => {
  test('renders a native file input and visible picker button', () => {
    const { container } = render(FileUpload, { props: { id: 'resume-upload' } });
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input?.classList.contains('cinder-file-upload__input')).toBe(true);
    expect(container.querySelector('button')?.textContent).toBe('Choose files');
  });

  test('forwards accept, multiple, name, and disabled to the input', () => {
    const { container } = render(FileUpload, {
      props: {
        id: 'attachments',
        accept: '.png',
        multiple: true,
        name: 'attachments',
        disabled: true,
      },
    });
    const input = container.querySelector('#attachments') as HTMLInputElement;
    expect(input.getAttribute('accept')).toBe('.png');
    expect(input.hasAttribute('multiple')).toBe(true);
    expect(input.getAttribute('name')).toBe('attachments');
    expect(input.disabled).toBe(true);
  });

  test('merges aria-describedby from FormField context and the consumer', () => {
    const { container } = render(FormFieldFileUploadFixture, {
      props: {
        fieldId: 'resume',
        fieldLabel: 'Resume',
        fieldDescription: 'PDF only',
        describedBy: 'resume-help',
      },
    });
    const input = container.querySelector('#resume') as HTMLInputElement;
    expect(input.getAttribute('aria-describedby')).toBe('resume-description resume-help');
  });
});

describe('FileUpload validation and events', () => {
  test('change fires onchange with accepted files', async () => {
    const onchange = mock((_files: File[]) => {});
    const file = createFile('resume.pdf', 'application/pdf', 512_000);
    const { container } = render(FileUpload, {
      props: { id: 'resume-upload', onchange },
    });
    const input = container.querySelector('#resume-upload') as HTMLInputElement;
    attachInputFiles(input, [file]);
    await fireEvent.change(input);
    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange.mock.calls[0]?.[0]).toEqual([file]);
  });

  test('maxSize rejection reports reason and message', async () => {
    const onreject = mock((_files) => {});
    const file = createFile('video.mov', 'video/quicktime', 2 * 1024 * 1024);
    const { container } = render(FileUpload, {
      props: { id: 'upload', maxSize: 1024 * 1024, onreject },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('drop', [file]));
    expect(onreject).toHaveBeenCalledTimes(1);
    expect(onreject.mock.calls[0]?.[0]?.[0]?.reason).toBe('too-large');
    expect(onreject.mock.calls[0]?.[0]?.[0]?.message).toContain('2.0 MB');
  });

  test('accept MIME filtering rejects mismatches', async () => {
    const onreject = mock((_files) => {});
    const file = createFile('notes.txt', 'text/plain', 120);
    const { container } = render(FileUpload, {
      props: { id: 'upload', accept: 'image/png', onreject },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('drop', [file]));
    expect(onreject).toHaveBeenCalledTimes(1);
    expect(onreject.mock.calls[0]?.[0]?.[0]?.reason).toBe('wrong-type');
  });

  test('accept wildcard allows related image types', async () => {
    const onchange = mock((_files: File[]) => {});
    const file = createFile('photo.jpg', 'image/jpeg', 2300);
    const { container } = render(FileUpload, {
      props: { id: 'upload', accept: 'image/*', onchange },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('drop', [file]));
    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange.mock.calls[0]?.[0]).toEqual([file]);
  });

  test('accept extension match works when MIME type is empty', async () => {
    const onchange = mock((_files: File[]) => {});
    const file = createFile('contract.pdf', '', 2048);
    const { container } = render(FileUpload, {
      props: { id: 'upload', accept: '.pdf,.docx', onchange },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('drop', [file]));
    expect(onchange).toHaveBeenCalledTimes(1);
  });

  test('multiple false accepts one file and rejects the extras', async () => {
    const onchange = mock((_files: File[]) => {});
    const onreject = mock((_files) => {});
    const files = [
      createFile('one.txt', 'text/plain', 100),
      createFile('two.txt', 'text/plain', 100),
      createFile('three.txt', 'text/plain', 100),
    ];
    const { container } = render(FileUpload, {
      props: { id: 'upload', onchange, onreject },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('drop', files));
    expect(onchange.mock.calls[0]?.[0]).toEqual([files[0]!]);
    expect(onreject.mock.calls[0]?.[0]).toHaveLength(2);
    expect(onreject.mock.calls[0]?.[0]?.[0]?.reason).toBe('too-many');
  });
});

describe('FileUpload drag state and accessibility', () => {
  test('drag state toggles data-drag-active', async () => {
    const { container } = render(FileUpload, { props: { id: 'upload' } });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('dragenter', []));
    expect(dropzone.hasAttribute('data-drag-active')).toBe(true);
    await fireEvent(dropzone, createDropEvent('dragleave', []));
    expect(dropzone.hasAttribute('data-drag-active')).toBe(false);
  });

  test('dragleave without dataTransfer clears an active file drag state', async () => {
    const { container } = render(FileUpload, { props: { id: 'upload' } });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('dragenter', []));
    expect(dropzone.hasAttribute('data-drag-active')).toBe(true);
    await fireEvent(dropzone, createDragLeaveWithoutDataTransfer());
    expect(dropzone.hasAttribute('data-drag-active')).toBe(false);
  });

  test('dragover prevents default', async () => {
    const { container } = render(FileUpload, { props: { id: 'upload' } });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    const event = createDropEvent('dragover', []);
    await fireEvent(dropzone, event);
    expect(event.defaultPrevented).toBe(true);
  });

  test('disabled ignores drops', async () => {
    const onchange = mock((_files: File[]) => {});
    const onreject = mock((_files) => {});
    const file = createFile('resume.pdf', 'application/pdf', 1200);
    const { container } = render(FileUpload, {
      props: { id: 'upload', disabled: true, onchange, onreject },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    const event = createDropEvent('drop', [file]);
    await fireEvent(dropzone, event);
    expect(onchange).not.toHaveBeenCalled();
    expect(onreject).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  test('non-file drops do not clear existing rendered entries', async () => {
    const file = createFile('resume.pdf', 'application/pdf', 1200);
    const { container } = render(FileUpload, {
      props: { id: 'upload', onchange: mock((_files: File[]) => {}) },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('drop', [file]));
    expect(container.querySelectorAll('.cinder-file-upload__row')).toHaveLength(1);
    await fireEvent(dropzone, createNonFileDropEvent('drop'));
    expect(container.querySelectorAll('.cinder-file-upload__row')).toHaveLength(1);
  });

  test('live region announces mixed accepted and rejected counts', async () => {
    const files = [
      createFile('good.txt', 'text/plain', 100),
      createFile('bad.mov', 'video/quicktime', 2 * 1024 * 1024),
    ];
    const { container } = render(FileUpload, {
      props: { id: 'upload', maxSize: 1024, multiple: true },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('drop', files));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const liveRegion = container.querySelector('.cinder-sr-only[aria-live="polite"]');
    expect(liveRegion?.textContent).toContain('1 file accepted, 1 rejected');
  });

  test('the input remains keyboard-focusable', () => {
    const { container } = render(FileUpload, { props: { id: 'upload' } });
    const input = container.querySelector('#upload') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);
  });

  test('visible button trigger opens the native picker path', async () => {
    const { container } = render(FileUpload, { props: { id: 'upload' } });
    const input = container.querySelector('#upload') as HTMLInputElement;
    const button = container.querySelector('button') as HTMLButtonElement;
    const click = mock(() => {});
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:\\fakepath\\resume.pdf',
    });
    input.click = click as unknown as typeof input.click;
    await fireEvent.click(button);
    expect(button.textContent).toBe('Choose files');
    expect(input.value).toBe('');
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe('FileUpload file list rendering', () => {
  test('uploading entry renders a progressbar with aria-valuenow', () => {
    const file = createFile('report.csv', 'text/csv', 1800);
    const { container } = render(FileUpload, {
      props: {
        id: 'upload',
        files: [{ id: '1', file, status: 'uploading', progress: 42 }],
      },
    });
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('42');
  });

  test('error entry wires aria-describedby to the visible error text', () => {
    const file = createFile('broken.zip', 'application/zip', 4096);
    const { container } = render(FileUpload, {
      props: {
        id: 'upload',
        files: [{ id: '1', file, status: 'error', error: 'Upload failed' }],
      },
    });
    const row = container.querySelector('.cinder-file-upload__row');
    const describedBy = row?.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(container.querySelector(`#${describedBy}`)?.textContent).toBe('Upload failed');
  });
});
