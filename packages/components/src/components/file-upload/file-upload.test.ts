/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const nativeDataTransfer = globalThis.DataTransfer;

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  Object.defineProperty(globalThis, 'DataTransfer', {
    configurable: true,
    writable: true,
    value: nativeDataTransfer,
  });
});

const { default: FileUpload } = await import('./file-upload.svelte');
const { default: FormFieldFileUploadFixture } =
  await import('../../test/fixtures/form-field-file-upload-fixture.svelte');
const { default: FileUploadFormFixture } =
  await import('../../test/fixtures/file-upload-form-fixture.svelte');

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

class TestDataTransfer {
  readonly #files: File[] = [];
  readonly items = {
    add: (file: File) => {
      this.#files.push(file);
      return null;
    },
  };

  get files(): FileList {
    return createFileList(this.#files);
  }
}

function attachInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    writable: true,
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
  Object.defineProperty(globalThis, 'DataTransfer', {
    configurable: true,
    writable: true,
    value: TestDataTransfer,
  });
});

describe('FileUpload rendering', () => {
  test('renders a native file input and visible picker button', () => {
    const { container } = render(FileUpload, { props: { id: 'resume-upload' } });
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input?.classList.contains('cinder-file-upload__input')).toBe(true);
    expect(container.querySelector('.cinder-file-upload__button')?.textContent).toBe(
      'Browse files',
    );
    expect(container.querySelector('.cinder-file-upload__title')?.textContent).toBe(
      'Click to upload or drop files',
    );
    expect(container.querySelector('.cinder-file-upload__description')?.textContent).toBe(
      'Any file type',
    );
  });

  test('renders custom picker trigger text', () => {
    const { container } = render(FileUpload, {
      props: { id: 'history-import', browseLabel: 'Import history JSON' },
    });
    expect(container.querySelector('.cinder-file-upload__button')?.textContent).toBe(
      'Import history JSON',
    );
  });

  test('renders custom dropzone copy and derives a readable description from accept', () => {
    const { container, rerender } = render(FileUpload, {
      props: {
        id: 'documents',
        accept: '.pdf,.doc,.docx,.xlsx,.csv,.png,.jpg,.jpeg',
        title: 'Add source documents',
      },
    });

    expect(container.querySelector('.cinder-file-upload__title')?.textContent).toBe(
      'Add source documents',
    );
    expect(container.querySelector('.cinder-file-upload__description')?.textContent).toBe(
      'PDF, DOC/DOCX, XLSX, CSV, PNG, or JPG',
    );

    rerender({
      id: 'documents',
      accept: '.pdf',
      description: 'Signed PDF documents only',
    });
    expect(container.querySelector('.cinder-file-upload__description')?.textContent).toBe(
      'Signed PDF documents only',
    );
  });

  test('keeps a derived Word description faithful to the accepted extensions', async () => {
    const { container, rerender } = render(FileUpload, {
      props: { id: 'documents', accept: '.doc' },
    });
    const description = () =>
      container.querySelector('.cinder-file-upload__description')?.textContent;

    expect(description()).toBe('DOC');
    await rerender({ id: 'documents', accept: '.docx' });
    expect(description()).toBe('DOCX');
    await rerender({ id: 'documents', accept: '.doc,.docx' });
    expect(description()).toBe('DOC/DOCX');
  });

  test('forwards accept, multiple, name, disabled, required, and webkitdirectory to the input', () => {
    const { container } = render(FileUpload, {
      props: {
        id: 'attachments',
        accept: '.png',
        multiple: true,
        name: 'attachments',
        disabled: true,
        required: true,
        webkitdirectory: true,
      },
    });
    const input = container.querySelector('#attachments') as HTMLInputElement;
    expect(input.getAttribute('accept')).toBe('.png');
    expect(input.hasAttribute('multiple')).toBe(true);
    expect(input.getAttribute('name')).toBe('attachments');
    expect(input.disabled).toBe(true);
    expect(input.required).toBe(true);
    expect(input.hasAttribute('webkitdirectory')).toBe(true);
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
    const button = container.querySelector('.cinder-file-upload__button') as HTMLButtonElement;
    expect(input.getAttribute('aria-describedby')).toBe(
      'resume-file-upload-description resume-description resume-help',
    );
    expect(button.getAttribute('aria-describedby')).toBe(input.getAttribute('aria-describedby'));
    expect(container.querySelector('#resume-file-upload-description')?.textContent).toBe(
      'Any file type',
    );
  });

  test('inherits required and disabled from FormField context', () => {
    const { container } = render(FormFieldFileUploadFixture, {
      props: {
        fieldId: 'resume',
        fieldLabel: 'Resume',
        required: true,
        disabled: true,
      },
    });
    const input = container.querySelector('#resume') as HTMLInputElement;
    expect(input.required).toBe(true);
    expect(input.disabled).toBe(true);
  });
});

describe('FileUpload validation and events', () => {
  test('change reports accepted files and the full resolved entry list', async () => {
    const onFilesAccepted = mock((_files: File[]) => {});
    const onFilesChange = mock((_entries) => {});
    const file = createFile('resume.pdf', 'application/pdf', 512_000);
    const { container } = render(FileUpload, {
      props: { id: 'resume-upload', onFilesAccepted, onFilesChange },
    });
    const input = container.querySelector('#resume-upload') as HTMLInputElement;
    attachInputFiles(input, [file]);
    await fireEvent.change(input);
    expect(onFilesAccepted).toHaveBeenCalledTimes(1);
    expect(onFilesAccepted.mock.calls[0]?.[0]).toEqual([file]);
    expect(onFilesChange).toHaveBeenCalledTimes(1);
    expect(onFilesChange.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ file, status: 'pending' }),
    ]);
  });

  test('maxSize rejection reports reason and message', async () => {
    const onReject = mock((_files) => {});
    const file = createFile('video.mov', 'video/quicktime', 2 * 1024 * 1024);
    const { container } = render(FileUpload, {
      props: { id: 'upload', maxSize: 1024 * 1024, onReject },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('drop', [file]));
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject.mock.calls[0]?.[0]?.[0]?.reason).toBe('too-large');
    expect(onReject.mock.calls[0]?.[0]?.[0]?.message).toContain('2.0 MB');
  });

  test('accept MIME filtering rejects mismatches', async () => {
    const onReject = mock((_files) => {});
    const file = createFile('notes.txt', 'text/plain', 120);
    const { container } = render(FileUpload, {
      props: { id: 'upload', accept: 'image/png', onReject },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('drop', [file]));
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject.mock.calls[0]?.[0]?.[0]?.reason).toBe('wrong-type');
  });

  test('accept wildcard allows related image types', async () => {
    const onFilesAccepted = mock((_files: File[]) => {});
    const file = createFile('photo.jpg', 'image/jpeg', 2300);
    const { container } = render(FileUpload, {
      props: { id: 'upload', accept: 'image/*', onFilesAccepted },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('drop', [file]));
    expect(onFilesAccepted).toHaveBeenCalledTimes(1);
    expect(onFilesAccepted.mock.calls[0]?.[0]).toEqual([file]);
  });

  test('accept extension match works when MIME type is empty', async () => {
    const onFilesAccepted = mock((_files: File[]) => {});
    const file = createFile('contract.pdf', '', 2048);
    const { container } = render(FileUpload, {
      props: { id: 'upload', accept: '.pdf,.docx', onFilesAccepted },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('drop', [file]));
    expect(onFilesAccepted).toHaveBeenCalledTimes(1);
  });

  test('multiple false accepts one file and rejects the extras', async () => {
    const onFilesAccepted = mock((_files: File[]) => {});
    const onReject = mock((_files) => {});
    const files = [
      createFile('one.txt', 'text/plain', 100),
      createFile('two.txt', 'text/plain', 100),
      createFile('three.txt', 'text/plain', 100),
    ];
    const { container } = render(FileUpload, {
      props: { id: 'upload', onFilesAccepted, onReject },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('drop', files));
    expect(onFilesAccepted.mock.calls[0]?.[0]).toEqual([files[0]!]);
    expect(onReject.mock.calls[0]?.[0]).toHaveLength(2);
    expect(onReject.mock.calls[0]?.[0]?.[0]?.reason).toBe('too-many');
  });

  test('maxFiles rejects files beyond the configured limit', async () => {
    const onFilesAccepted = mock((_files: File[]) => {});
    const onFilesChange = mock((_entries) => {});
    const onReject = mock((_files) => {});
    const files = [
      createFile('one.txt', 'text/plain', 100),
      createFile('two.txt', 'text/plain', 100),
      createFile('three.txt', 'text/plain', 100),
    ];
    const { container } = render(FileUpload, {
      props: {
        id: 'upload',
        multiple: true,
        maxFiles: 2,
        onFilesAccepted,
        onFilesChange,
        onReject,
      },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;

    await fireEvent(dropzone, createDropEvent('drop', files));

    expect(onFilesAccepted.mock.calls[0]?.[0]).toEqual(files.slice(0, 2));
    expect(onReject.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ file: files[2], reason: 'too-many' }),
    ]);
    expect(onFilesChange.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ file: files[0], status: 'pending' }),
      expect.objectContaining({ file: files[1], status: 'pending' }),
      expect.objectContaining({ file: files[2], status: 'error' }),
    ]);
  });

  test('maxFiles counts accepted entries from earlier selections', async () => {
    const onFilesAccepted = mock((_files: File[]) => {});
    const onFilesChange = mock((_entries) => {});
    const firstFiles = [
      createFile('first.txt', 'text/plain', 10),
      createFile('second.txt', 'text/plain', 10),
    ];
    const laterFile = createFile('third.txt', 'text/plain', 10);
    const { container } = render(FileUpload, {
      props: { id: 'upload', multiple: true, maxFiles: 2, onFilesAccepted, onFilesChange },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;

    attachInputFiles(input, firstFiles);
    await fireEvent.change(input);
    attachInputFiles(input, [laterFile]);
    await fireEvent.change(input);

    expect(onFilesAccepted).toHaveBeenCalledTimes(1);
    expect(onFilesChange.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({ file: firstFiles[0], status: 'pending' }),
      expect.objectContaining({ file: firstFiles[1], status: 'pending' }),
      expect.objectContaining({ file: laterFile, status: 'error' }),
    ]);
  });

  test('maxFiles counts controlled accepted entries', async () => {
    const existingFile = createFile('existing.txt', 'text/plain', 10);
    const nextFile = createFile('next.txt', 'text/plain', 10);
    const onReject = mock((_files) => {});
    const { container } = render(FileUpload, {
      props: {
        id: 'upload',
        multiple: true,
        maxFiles: 1,
        files: [{ id: 'existing', file: existingFile, status: 'success' }],
        onReject,
      },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;

    attachInputFiles(input, [nextFile]);
    await fireEvent.change(input);

    expect(onReject.mock.calls[0]?.[0]?.[0]).toEqual(
      expect.objectContaining({ file: nextFile, reason: 'too-many' }),
    );
  });

  test('maxFiles counts failed uploads that remain in the queue', async () => {
    const failedFile = createFile('failed.txt', 'text/plain', 10);
    const nextFile = createFile('next.txt', 'text/plain', 10);
    const onReject = mock((_files) => {});
    const { container } = render(FileUpload, {
      props: {
        id: 'upload',
        multiple: true,
        maxFiles: 1,
        files: [{ id: 'failed', file: failedFile, status: 'error', error: 'Upload failed' }],
        onReject,
      },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;

    attachInputFiles(input, [nextFile]);
    await fireEvent.change(input);

    expect(onReject.mock.calls[0]?.[0]?.[0]).toEqual(
      expect.objectContaining({ file: nextFile, reason: 'too-many' }),
    );
  });

  test('multiple selections accumulate without maxFiles', async () => {
    const firstFile = createFile('first.txt', 'text/plain', 10);
    const secondFile = createFile('second.txt', 'text/plain', 10);
    const onFilesChange = mock((_entries) => {});
    const { container } = render(FileUpload, {
      props: { id: 'upload', multiple: true, onFilesChange },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;

    attachInputFiles(input, [firstFile]);
    await fireEvent.change(input);
    attachInputFiles(input, [secondFile]);
    await fireEvent.change(input);

    expect(onFilesChange.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({ file: firstFile, status: 'pending' }),
      expect.objectContaining({ file: secondFile, status: 'pending' }),
    ]);
    expect(Array.from(input.files ?? [])).toEqual([firstFile, secondFile]);
  });

  test('selection callbacks observe the synchronized native file queue', async () => {
    const firstFile = createFile('first.txt', 'text/plain', 10);
    const secondFile = createFile('second.txt', 'text/plain', 10);
    let input: HTMLInputElement;
    const nativeFilesDuringChange: File[][] = [];
    const onFilesChange = mock(() => {
      nativeFilesDuringChange.push(Array.from(input.files ?? []));
    });
    const { container } = render(FileUpload, {
      props: { id: 'upload', multiple: true, onFilesChange },
    });
    input = container.querySelector('#upload') as HTMLInputElement;

    attachInputFiles(input, [firstFile]);
    await fireEvent.change(input);
    attachInputFiles(input, [secondFile]);
    await fireEvent.change(input);

    expect(nativeFilesDuringChange).toEqual([[firstFile], [firstFile, secondFile]]);
  });

  test('controlled selection callbacks observe the proposed native file queue', async () => {
    const existingFile = createFile('existing.txt', 'text/plain', 10);
    const selectedFile = createFile('selected.txt', 'text/plain', 10);
    let input: HTMLInputElement;
    const nativeFilesDuringChange: File[][] = [];
    const onFilesChange = mock(() => {
      nativeFilesDuringChange.push(Array.from(input.files ?? []));
    });
    const { container } = render(FileUpload, {
      props: {
        id: 'upload',
        multiple: true,
        files: [{ id: 'existing', file: existingFile, status: 'success' }],
        onFilesChange,
      },
    });
    input = container.querySelector('#upload') as HTMLInputElement;
    await new Promise((resolve) => setTimeout(resolve, 0));

    attachInputFiles(input, [selectedFile]);
    await fireEvent.change(input);

    expect(nativeFilesDuringChange).toEqual([[existingFile, selectedFile]]);
    expect(Array.from(input.files ?? [])).toEqual([existingFile]);
  });

  test('canceling a reopened picker restores the accumulated native file queue', async () => {
    const firstFile = createFile('first.txt', 'text/plain', 10);
    const oncancel = mock((_event) => {});
    const { container } = render(FileUpload, {
      props: { id: 'upload', multiple: true, oncancel },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;

    attachInputFiles(input, [firstFile]);
    await fireEvent.change(input);
    await fireEvent.click(input);
    attachInputFiles(input, []);
    await fireEvent(input, new Event('cancel', { bubbles: true }));

    expect(Array.from(input.files ?? [])).toEqual([firstFile]);
    expect(oncancel).toHaveBeenCalledTimes(1);
  });

  test('single-file mode synchronizes only the first controlled entry to the native input', async () => {
    const firstFile = createFile('first.txt', 'text/plain', 10);
    const secondFile = createFile('second.txt', 'text/plain', 10);
    const { container } = render(FileUpload, {
      props: {
        id: 'upload',
        files: [
          { id: 'first', file: firstFile, status: 'success' },
          { id: 'second', file: secondFile, status: 'success' },
        ],
      },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(Array.from(input.files ?? [])).toEqual([firstFile]);
  });

  test('native synchronization respects maxFiles when the controlled limit is lowered', async () => {
    const firstFile = createFile('first.txt', 'text/plain', 10);
    const secondFile = createFile('second.txt', 'text/plain', 10);
    const thirdFile = createFile('third.txt', 'text/plain', 10);
    const files = [firstFile, secondFile, thirdFile].map((file, index) => ({
      id: String(index),
      file,
      status: 'success' as const,
    }));
    const { container, rerender } = render(FileUpload, {
      props: { id: 'upload', multiple: true, maxFiles: 3, files },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(Array.from(input.files ?? [])).toEqual([firstFile, secondFile, thirdFile]);

    await rerender({ id: 'upload', multiple: true, maxFiles: 2, files });

    expect(Array.from(input.files ?? [])).toEqual([firstFile, secondFile]);
  });

  test('controlled validation restores the native input from the controlled queue', async () => {
    const existingFile = createFile('existing.png', 'image/png', 10);
    const rejectedFile = createFile('rejected.txt', 'text/plain', 10);
    const onReject = mock((_files) => {});
    const { container } = render(FileUpload, {
      props: {
        id: 'upload',
        accept: 'image/*',
        files: [{ id: 'existing', file: existingFile, status: 'success' }],
        onReject,
      },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;

    attachInputFiles(input, [rejectedFile]);
    await fireEvent.change(input);

    expect(onReject.mock.calls[0]?.[0]?.[0]).toEqual(
      expect.objectContaining({ file: rejectedFile, reason: 'wrong-type' }),
    );
    expect(Array.from(input.files ?? [])).toEqual([existingFile]);
  });

  test('native synchronization clears the input when assigning files is unsupported', async () => {
    const rejectedFile = createFile('rejected.txt', 'text/plain', 10);
    const onReject = mock((_files) => {});
    const { container } = render(FileUpload, {
      props: { id: 'upload', accept: 'image/*', files: [], onReject },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;
    const rejectedFiles = createFileList([rejectedFile]);
    Object.defineProperty(input, 'files', {
      configurable: true,
      get: () => rejectedFiles,
      set: () => {
        throw new TypeError('FileList assignment is unsupported');
      },
    });
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:\\fakepath\\rejected.txt',
    });

    await fireEvent.change(input);

    expect(onReject).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('');
  });

  test('native synchronization clears the input when DataTransfer is not constructible', async () => {
    const rejectedFile = createFile('rejected.txt', 'text/plain', 10);
    const onReject = mock((_files) => {});
    const { container } = render(FileUpload, {
      props: { id: 'upload', accept: 'image/*', files: [], onReject },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;
    attachInputFiles(input, [rejectedFile]);
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:\\fakepath\\rejected.txt',
    });
    Object.defineProperty(globalThis, 'DataTransfer', {
      configurable: true,
      writable: true,
      value: function UnsupportedDataTransfer() {
        throw new TypeError('DataTransfer construction is unsupported');
      },
    });

    await fireEvent.change(input);

    expect(onReject).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('');
  });

  test('native synchronization preserves a valid picker selection when DataTransfer is not constructible', async () => {
    const acceptedFile = createFile('accepted.png', 'image/png', 10);
    const onFilesAccepted = mock((_files) => {});
    const { container } = render(FileUpload, {
      props: { id: 'upload', accept: 'image/*', onFilesAccepted },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;
    attachInputFiles(input, [acceptedFile]);
    Object.defineProperty(globalThis, 'DataTransfer', {
      configurable: true,
      writable: true,
      value: function UnsupportedDataTransfer() {
        throw new TypeError('DataTransfer construction is unsupported');
      },
    });

    await fireEvent.change(input);

    expect(onFilesAccepted).toHaveBeenCalledWith([acceptedFile]);
    expect(Array.from(input.files ?? [])).toEqual([acceptedFile]);
  });

  test('native synchronization preserves the latest valid picker batch when accumulated files cannot be assigned', async () => {
    const firstFile = createFile('first.png', 'image/png', 10);
    const secondFile = createFile('second.png', 'image/png', 10);
    const onFilesChange = mock((_entries) => {});
    const { container } = render(FileUpload, {
      props: { id: 'upload', accept: 'image/*', multiple: true, onFilesChange },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;

    attachInputFiles(input, [firstFile]);
    await fireEvent.change(input);
    Object.defineProperty(globalThis, 'DataTransfer', {
      configurable: true,
      writable: true,
      value: function UnsupportedDataTransfer() {
        throw new TypeError('DataTransfer construction is unsupported');
      },
    });
    attachInputFiles(input, [secondFile]);
    await fireEvent.change(input);

    expect(onFilesChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ file: firstFile }),
      expect.objectContaining({ file: secondFile }),
    ]);
    expect(Array.from(input.files ?? [])).toEqual([secondFile]);
  });

  test('native synchronization does not rebuild an unchanged controlled FileList', async () => {
    const file = createFile('report.png', 'image/png', 10);
    const entry = { id: 'report', file, status: 'pending' as const };
    let constructions = 0;
    Object.defineProperty(globalThis, 'DataTransfer', {
      configurable: true,
      writable: true,
      value: class CountingDataTransfer extends TestDataTransfer {
        constructor() {
          super();
          constructions += 1;
        }
      },
    });
    const { rerender } = render(FileUpload, {
      props: { id: 'upload', files: [entry] },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const constructionsAfterSynchronization = constructions;

    await rerender({ id: 'upload', files: [{ ...entry, status: 'uploading', progress: 25 }] });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(constructionsAfterSynchronization).toBeGreaterThan(0);
    expect(constructions).toBe(constructionsAfterSynchronization);
  });

  test('native synchronization clears rejected files when DataTransfer is unavailable', async () => {
    const rejectedFile = createFile('rejected.txt', 'text/plain', 10);
    const onReject = mock((_files) => {});
    const { container } = render(FileUpload, {
      props: { id: 'upload', accept: 'image/*', files: [], onReject },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;
    attachInputFiles(input, [rejectedFile]);
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:\\fakepath\\rejected.txt',
    });
    Object.defineProperty(globalThis, 'DataTransfer', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    await fireEvent.change(input);

    expect(onReject).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('');
  });

  test('lowering maxFiles reconciles an uncontrolled rendered and native queue', async () => {
    const firstFile = createFile('first.txt', 'text/plain', 10);
    const secondFile = createFile('second.txt', 'text/plain', 10);
    const thirdFile = createFile('third.txt', 'text/plain', 10);
    const onFilesChange = mock((_entries) => {});
    const { container, rerender } = render(FileUpload, {
      props: { id: 'upload', multiple: true, maxFiles: 3, onFilesChange },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;
    attachInputFiles(input, [firstFile, secondFile, thirdFile]);
    await fireEvent.change(input);

    await rerender({ id: 'upload', multiple: true, maxFiles: 2, onFilesChange });
    await Promise.resolve();

    expect(container.querySelectorAll('.cinder-file-upload__row')).toHaveLength(2);
    expect(Array.from(input.files ?? [])).toEqual([firstFile, secondFile]);
    expect(onFilesChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ file: firstFile }),
      expect.objectContaining({ file: secondFile }),
    ]);
  });

  test('removing an uncontrolled entry frees its maxFiles slot', async () => {
    const firstFile = createFile('first.txt', 'text/plain', 10);
    const replacementFile = createFile('replacement.txt', 'text/plain', 10);
    const onFilesAccepted = mock((_files) => {});
    const onFilesChange = mock((_entries) => {});
    const { container } = render(FileUpload, {
      props: {
        id: 'upload',
        multiple: true,
        maxFiles: 1,
        onFilesAccepted,
        onFilesChange,
      },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;

    attachInputFiles(input, [firstFile]);
    await fireEvent.change(input);
    const removeButton = container.querySelector(
      '.cinder-file-upload__remove',
    ) as HTMLButtonElement;
    await fireEvent.click(removeButton);
    attachInputFiles(input, [replacementFile]);
    await fireEvent.change(input);

    expect(onFilesAccepted).toHaveBeenLastCalledWith([replacementFile]);
    expect(onFilesChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ file: replacementFile, status: 'pending' }),
    ]);
  });

  test('a custom uncontrolled file list can remove an entry and free its maxFiles slot', async () => {
    const firstFile = createFile('first.txt', 'text/plain', 10);
    const replacementFile = createFile('replacement.txt', 'text/plain', 10);
    const onFilesChange = mock((_entries) => {});
    const { container } = render(FileUploadFormFixture, {
      props: { customFileList: true, onFilesChange },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;

    attachInputFiles(input, [firstFile]);
    await fireEvent.change(input);
    await fireEvent.click(container.querySelector('button[aria-label="Remove first.txt"]')!);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onFilesChange).toHaveBeenLastCalledWith([]);
    attachInputFiles(input, [replacementFile]);
    await fireEvent.change(input);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onFilesChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ file: replacementFile, status: 'pending' }),
    ]);
    expect(container.querySelectorAll('[data-testid="custom-file-list"]')).toHaveLength(1);
    const customFileList = container.querySelector('[data-testid="custom-file-list"]');
    expect(customFileList?.textContent).toContain('replacement.txt');
    expect(customFileList?.textContent).not.toContain('first.txt');
  });

  test('removing uncontrolled entries preserves focus through the queue', async () => {
    const firstFile = createFile('first.txt', 'text/plain', 10);
    const secondFile = createFile('second.txt', 'text/plain', 10);
    const { container } = render(FileUpload, {
      props: { id: 'upload', multiple: true },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;
    const browseButton = container.querySelector(
      '.cinder-file-upload__button',
    ) as HTMLButtonElement;

    attachInputFiles(input, [firstFile, secondFile]);
    await fireEvent.change(input);
    const firstRemoveButton = container.querySelector(
      '.cinder-file-upload__remove',
    ) as HTMLButtonElement;
    firstRemoveButton.focus();
    await fireEvent.click(firstRemoveButton);

    const remainingRemoveButton = container.querySelector(
      '.cinder-file-upload__remove',
    ) as HTMLButtonElement;
    expect(document.activeElement).toBe(remainingRemoveButton);

    await fireEvent.click(remainingRemoveButton);
    expect(document.activeElement).toBe(browseButton);
  });

  test('removal callbacks observe the synchronized native file queue', async () => {
    const firstFile = createFile('first.txt', 'text/plain', 10);
    const secondFile = createFile('second.txt', 'text/plain', 10);
    let input: HTMLInputElement;
    const nativeFilesDuringChange: File[][] = [];
    const onFilesChange = mock(() => {
      nativeFilesDuringChange.push(Array.from(input.files ?? []));
    });
    const { container } = render(FileUpload, {
      props: { id: 'upload', multiple: true, onFilesChange },
    });
    input = container.querySelector('#upload') as HTMLInputElement;

    attachInputFiles(input, [firstFile, secondFile]);
    await fireEvent.change(input);
    const firstRemoveButton = container.querySelector(
      '.cinder-file-upload__remove',
    ) as HTMLButtonElement;
    await fireEvent.click(firstRemoveButton);

    expect(nativeFilesDuringChange.at(-1)).toEqual([secondFile]);
  });

  test('controlled removal callbacks observe the proposed native file queue', async () => {
    const firstFile = createFile('first.txt', 'text/plain', 10);
    const secondFile = createFile('second.txt', 'text/plain', 10);
    let input: HTMLInputElement;
    const nativeFilesDuringChange: File[][] = [];
    const onFilesChange = mock(() => {
      nativeFilesDuringChange.push(Array.from(input.files ?? []));
    });
    const { container } = render(FileUpload, {
      props: {
        id: 'upload',
        multiple: true,
        files: [
          { id: 'first', file: firstFile, status: 'success' },
          { id: 'second', file: secondFile, status: 'success' },
        ],
        onFilesChange,
      },
    });
    input = container.querySelector('#upload') as HTMLInputElement;
    await new Promise((resolve) => setTimeout(resolve, 0));

    const firstRemoveButton = container.querySelector(
      '.cinder-file-upload__remove',
    ) as HTMLButtonElement;
    await fireEvent.click(firstRemoveButton);

    expect(nativeFilesDuringChange).toEqual([[secondFile]]);
    expect(Array.from(input.files ?? [])).toEqual([firstFile, secondFile]);
  });

  test('a declined controlled removal keeps focus on the originating button', async () => {
    const firstFile = createFile('first.txt', 'text/plain', 10);
    const secondFile = createFile('second.txt', 'text/plain', 10);
    const onFilesChange = mock((_entries) => {});
    const { container } = render(FileUpload, {
      props: {
        id: 'upload',
        multiple: true,
        files: [
          { id: 'first', file: firstFile, status: 'success' },
          { id: 'second', file: secondFile, status: 'success' },
        ],
        onFilesChange,
      },
    });
    const firstRemoveButton = container.querySelector(
      '.cinder-file-upload__remove',
    ) as HTMLButtonElement;
    firstRemoveButton.focus();

    await fireEvent.click(firstRemoveButton);

    expect(onFilesChange).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(firstRemoveButton);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).not.toContain('removed');
  });

  test('an adopted controlled removal announces after the row is removed', async () => {
    const file = createFile('report.txt', 'text/plain', 10);
    const entry = { id: 'report', file, status: 'success' as const };
    let rerender: ReturnType<typeof render>['rerender'];
    const onFilesChange = mock(() => {
      void rerender({ id: 'upload', files: [], onFilesChange });
    });
    const result = render(FileUpload, {
      props: { id: 'upload', files: [entry], onFilesChange },
    });
    rerender = result.rerender;

    await fireEvent.click(result.container.querySelector('.cinder-file-upload__remove')!);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.container.querySelector('[aria-live="polite"]')?.textContent).toContain(
      'report.txt removed',
    );
  });

  test('form reset clears the uncontrolled queue and synchronized native files', async () => {
    const file = createFile('report.txt', 'text/plain', 10);
    const replacementFile = createFile('replacement.txt', 'text/plain', 10);
    const onFilesChange = mock((_entries) => {});
    const { container } = render(FileUploadFormFixture, { props: { onFilesChange } });
    const form = container.querySelector('form') as HTMLFormElement;
    const input = container.querySelector('#upload') as HTMLInputElement;

    attachInputFiles(input, [file]);
    await fireEvent.change(input);
    await fireEvent(form, new Event('reset', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(onFilesChange).toHaveBeenLastCalledWith([]);
    expect(Array.from(input.files ?? [])).toEqual([]);

    attachInputFiles(input, [replacementFile]);
    await fireEvent.change(input);

    expect(onFilesChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ file: replacementFile, status: 'pending' }),
    ]);
    expect(Array.from(input.files ?? [])).toEqual([replacementFile]);
  });

  test('canceled form reset preserves the uncontrolled queue and native files', async () => {
    const file = createFile('report.txt', 'text/plain', 10);
    const onFilesChange = mock((_entries) => {});
    const { container } = render(FileUploadFormFixture, { props: { onFilesChange } });
    const form = container.querySelector('form') as HTMLFormElement;
    const input = container.querySelector('#upload') as HTMLInputElement;
    form.addEventListener('reset', (event) => event.preventDefault());

    attachInputFiles(input, [file]);
    await fireEvent.change(input);
    const entriesBeforeReset = onFilesChange.mock.calls.at(-1)?.[0];
    await fireEvent(form, new Event('reset', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(onFilesChange).toHaveBeenLastCalledWith(entriesBeforeReset);
    expect(Array.from(input.files ?? [])).toEqual([file]);
  });

  test('form reset restores the synchronized native files for a controlled queue', async () => {
    const file = createFile('report.txt', 'text/plain', 10);
    const entry = { id: 'report', file, status: 'success' as const };
    const form = document.createElement('form');
    form.id = 'controlled-upload-form';
    document.body.append(form);
    const { container } = render(FileUpload, {
      props: { id: 'upload', form: 'controlled-upload-form', files: [entry] },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(Array.from(input.files ?? [])).toEqual([file]);

    attachInputFiles(input, []);
    await fireEvent(form, new Event('reset', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(Array.from(input.files ?? [])).toEqual([file]);
  });

  test('form reset restores the latest controlled queue after a same-task prop update', async () => {
    const firstFile = createFile('first.txt', 'text/plain', 10);
    const secondFile = createFile('second.txt', 'text/plain', 10);
    const firstEntry = { id: 'first', file: firstFile, status: 'success' as const };
    const secondEntry = { id: 'second', file: secondFile, status: 'success' as const };
    const { container } = render(FileUploadFormFixture, {
      props: { controlledFiles: [firstEntry], nextControlledFiles: [secondEntry] },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(Array.from(input.files ?? [])).toEqual([firstFile]);
    attachInputFiles(input, []);

    await fireEvent.click(container.querySelector('[data-testid="update-files-and-reset"]')!);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(Array.from(input.files ?? [])).toEqual([secondFile]);
  });

  test('form reset follows an external form that mounts after the file input', async () => {
    const file = createFile('report.txt', 'text/plain', 10);
    const onFilesChange = mock((_entries) => {});
    const { container } = render(FileUpload, {
      props: { id: 'upload', form: 'external-upload-form', onFilesChange },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;
    const form = document.createElement('form');
    form.id = 'external-upload-form';
    document.body.append(form);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(input.form).toBe(form);

    attachInputFiles(input, [file]);
    await fireEvent.change(input);
    await fireEvent(form, new Event('reset', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(onFilesChange).toHaveBeenLastCalledWith([]);
    expect(Array.from(input.files ?? [])).toEqual([]);
  });

  test('form reset follows a changed external form association', async () => {
    const file = createFile('report.txt', 'text/plain', 10);
    const onFilesChange = mock((_entries) => {});
    const firstForm = document.createElement('form');
    firstForm.id = 'first-upload-form';
    const secondForm = document.createElement('form');
    secondForm.id = 'second-upload-form';
    document.body.append(firstForm, secondForm);
    const { container, rerender } = render(FileUpload, {
      props: { id: 'upload', form: 'first-upload-form', onFilesChange },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;

    await rerender({ id: 'upload', form: 'second-upload-form', onFilesChange });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(input.form).toBe(secondForm);
    attachInputFiles(input, [file]);
    await fireEvent.change(input);
    const entriesBeforeReset = onFilesChange.mock.calls.at(-1)?.[0];

    await fireEvent(firstForm, new Event('reset', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    expect(onFilesChange).toHaveBeenLastCalledWith(entriesBeforeReset);

    await fireEvent(secondForm, new Event('reset', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    expect(onFilesChange).toHaveBeenLastCalledWith([]);
  });
});

describe('FileUpload drag state and accessibility', () => {
  test('drag state toggles data-drag-active and renders the dragging label', async () => {
    const { container } = render(FileUpload, {
      props: { id: 'upload', draggingLabel: 'Release the documents' },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('dragenter', []));
    expect(dropzone.hasAttribute('data-drag-active')).toBe(true);
    expect(container.querySelector('.cinder-file-upload__title')?.textContent).toBe(
      'Release the documents',
    );
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

  test('disabled dragleave clears active drag state after disabling mid-drag', async () => {
    const { container, rerender } = render(FileUpload, { props: { id: 'upload' } });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    await fireEvent(dropzone, createDropEvent('dragenter', []));
    expect(dropzone.hasAttribute('data-drag-active')).toBe(true);
    await rerender({ id: 'upload', disabled: true });
    await fireEvent(dropzone, createDropEvent('dragleave', []));
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
    const onFilesChange = mock((_entries) => {});
    const onReject = mock((_files) => {});
    const file = createFile('resume.pdf', 'application/pdf', 1200);
    const { container } = render(FileUpload, {
      props: { id: 'upload', disabled: true, onFilesChange, onReject },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    const event = createDropEvent('drop', [file]);
    await fireEvent(dropzone, event);
    expect(onFilesChange).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  test('non-file drops do not clear existing rendered entries', async () => {
    const file = createFile('resume.pdf', 'application/pdf', 1200);
    const { container } = render(FileUpload, {
      props: { id: 'upload' },
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
      props: { id: 'upload', maxSize: 1024, multiple: true, browseLabel: 'Import files' },
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

  test('native input activation clears the previous selected file value', async () => {
    const { container } = render(FileUpload, { props: { id: 'upload' } });
    const input = container.querySelector('#upload') as HTMLInputElement;
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:\\fakepath\\resume.pdf',
    });
    await fireEvent.click(input);
    expect(input.value).toBe('');
  });

  test('dropzone is labelled by FormField context', () => {
    const { container } = render(FormFieldFileUploadFixture, {
      props: {
        fieldId: 'resume',
        fieldLabel: 'Resume',
      },
    });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    expect(dropzone.getAttribute('aria-labelledby')).toBe('resume-label');
  });

  test('visible button trigger opens the native picker path with custom text', async () => {
    const { container } = render(FileUpload, {
      props: { id: 'upload', browseLabel: 'Choose directory' },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;
    const button = container.querySelector('.cinder-file-upload__button') as HTMLButtonElement;
    const click = mock(() => {});
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:\\fakepath\\resume.pdf',
    });
    input.click = click as unknown as typeof input.click;
    await fireEvent.click(button);
    expect(button.textContent).toBe('Choose directory');
    expect(input.value).toBe('');
    expect(click).toHaveBeenCalledTimes(1);
  });

  test('clicking the advertised dropzone surface opens the picker without double-activating the button', async () => {
    const { container } = render(FileUpload, { props: { id: 'upload' } });
    const input = container.querySelector('#upload') as HTMLInputElement;
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    const button = container.querySelector('.cinder-file-upload__button') as HTMLButtonElement;
    const click = mock(() => {});
    input.click = click as unknown as typeof input.click;

    container.setAttribute('tabindex', '-1');

    await fireEvent.click(dropzone);
    expect(click).toHaveBeenCalledTimes(1);

    await fireEvent.click(button);
    expect(click).toHaveBeenCalledTimes(2);

    const customControl = document.createElement('button');
    dropzone.append(customControl);
    await fireEvent.click(customControl);
    expect(click).toHaveBeenCalledTimes(2);

    const editableRegion = document.createElement('div');
    editableRegion.setAttribute('contenteditable', 'true');
    for (const interactiveElement of [
      document.createElement('label'),
      document.createElement('summary'),
      editableRegion,
    ]) {
      dropzone.append(interactiveElement);
      await fireEvent.click(interactiveElement);
    }
    expect(click).toHaveBeenCalledTimes(2);

    const ariaButton = document.createElement('div');
    ariaButton.setAttribute('role', 'button');
    dropzone.append(ariaButton);
    await fireEvent.click(ariaButton);
    expect(click).toHaveBeenCalledTimes(2);

    const decorativeImage = document.createElement('div');
    decorativeImage.setAttribute('role', 'img');
    dropzone.append(decorativeImage);
    await fireEvent.click(decorativeImage);
    expect(click).toHaveBeenCalledTimes(3);
  });
});

describe('FileUpload file list rendering', () => {
  test('file rows keep the full-strength outer border', async () => {
    const css = await Bun.file(new URL('./file-upload.css', import.meta.url)).text();
    const rowBlock = css.match(/\.cinder-file-upload__row\s*\{[^}]*\}/)?.[0] ?? '';

    expect(rowBlock).toContain('border: 1px solid var(--cinder-border)');
    expect(rowBlock).not.toContain('var(--cinder-border-muted)');
  });

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

  test('renders a file-type icon for known and unknown MIME types', () => {
    const files = [
      { id: 'image', file: createFile('photo.png', 'image/png', 100), status: 'success' as const },
      { id: 'sheet', file: createFile('report.csv', 'text/csv', 100), status: 'success' as const },
      {
        id: 'unknown',
        file: createFile('archive.zip', 'application/zip', 100),
        status: 'success' as const,
      },
    ];
    const { container } = render(FileUpload, { props: { id: 'upload', files } });

    expect(container.querySelectorAll('.cinder-file-upload__file-icon')).toHaveLength(3);
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

  test('error entry offers retry when onFileRetry is provided', async () => {
    const entry = {
      id: '1',
      file: createFile('broken.zip', 'application/zip', 4096),
      status: 'error' as const,
      error: 'Upload failed',
    };
    const onFileRetry = mock((_entry) => {});
    const { container } = render(FileUpload, {
      props: { id: 'upload', files: [entry], onFileRetry },
    });
    const retryButton = container.querySelector('.cinder-file-upload__retry') as HTMLButtonElement;

    expect(retryButton.textContent).toContain('Retry');
    expect(retryButton.getAttribute('aria-label')).toBe('Retry broken.zip');
    expect(retryButton.getAttribute('aria-describedby')).toBe('upload-1-error');
    await fireEvent.click(retryButton);
    expect(onFileRetry).toHaveBeenCalledWith(entry);
  });

  test('retry moves focus to the browse control when the retry action is removed', async () => {
    const entry = {
      id: '1',
      file: createFile('broken.zip', 'application/zip', 10),
      status: 'error' as const,
      error: 'Network error',
    };
    let rerender: ReturnType<typeof render>['rerender'];
    const onFileRetry = mock(() => {
      void rerender({
        id: 'upload',
        files: [{ ...entry, status: 'uploading' }],
        onFileRetry,
      });
    });
    const result = render(FileUpload, {
      props: { id: 'upload', files: [entry], onFileRetry },
    });
    rerender = result.rerender;
    const retryButton = result.container.querySelector(
      '.cinder-file-upload__retry',
    ) as HTMLButtonElement;
    const browseButton = result.container.querySelector(
      '.cinder-file-upload__button',
    ) as HTMLButtonElement;
    retryButton.focus();

    await fireEvent.click(retryButton);

    expect(document.activeElement).toBe(browseButton);
  });

  test('retry preserves focus moved by the consumer when the retry action is removed', async () => {
    const entry = {
      id: '1',
      file: createFile('broken.zip', 'application/zip', 10),
      status: 'error' as const,
      error: 'Network error',
    };
    const consumerTarget = document.createElement('button');
    document.body.append(consumerTarget);
    let rerender: ReturnType<typeof render>['rerender'];
    const onFileRetry = mock(() => {
      consumerTarget.focus();
      void rerender({
        id: 'upload',
        files: [{ ...entry, status: 'uploading' }],
        onFileRetry,
      });
    });
    const result = render(FileUpload, {
      props: { id: 'upload', files: [entry], onFileRetry },
    });
    rerender = result.rerender;
    const retryButton = result.container.querySelector(
      '.cinder-file-upload__retry',
    ) as HTMLButtonElement;
    retryButton.focus();

    await fireEvent.click(retryButton);

    expect(document.activeElement).toBe(consumerTarget);
  });

  test('disabled uploads disable retry actions', () => {
    const file = createFile('broken.zip', 'application/zip', 4096);
    const { container } = render(FileUpload, {
      props: {
        id: 'upload',
        disabled: true,
        files: [{ id: '1', file, status: 'error', error: 'Upload failed' }],
        onFileRetry: mock((_entry) => {}),
      },
    });

    expect(
      (container.querySelector('.cinder-file-upload__retry') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test('controlled queues without onFilesChange do not expose remove actions', () => {
    const file = createFile('report.csv', 'text/csv', 100);
    const { container } = render(FileUpload, {
      props: {
        id: 'upload',
        files: [{ id: '1', file, status: 'pending' }],
      },
    });

    expect(container.querySelector('.cinder-file-upload__remove')).toBeNull();
  });

  test('locally rejected entries expose their reason without offering retry', async () => {
    const rejectedFile = createFile('large.txt', 'text/plain', 100);
    const onFilesChange = mock((_entries) => {});
    const onFileRetry = mock((_entry) => {});
    const { container } = render(FileUpload, {
      props: { id: 'upload', maxSize: 10, onFilesChange, onFileRetry },
    });
    const input = container.querySelector('#upload') as HTMLInputElement;

    attachInputFiles(input, [rejectedFile]);
    await fireEvent.change(input);

    expect(onFilesChange.mock.calls[0]?.[0]?.[0]).toEqual(
      expect.objectContaining({
        file: rejectedFile,
        status: 'error',
        rejectionReason: 'too-large',
      }),
    );
    expect(container.querySelector('.cinder-file-upload__retry')).toBeNull();
  });

  test('border beam emphasis is enabled by default and can be disabled', async () => {
    const { container, rerender } = render(FileUpload, { props: { id: 'upload' } });
    const dropzone = container.querySelector('.cinder-file-upload__dropzone') as HTMLDivElement;
    expect(dropzone.classList.contains('cinder-file-upload__dropzone--border-beam')).toBe(true);

    await rerender({ id: 'upload', borderBeamVisible: false });
    expect(dropzone.classList.contains('cinder-file-upload__dropzone--border-beam')).toBe(false);
  });

  test('keeps a visible focus treatment when border beam emphasis is disabled', async () => {
    const css = await Bun.file(new URL('./file-upload.css', import.meta.url)).text();

    expect(css).toContain('@supports not selector(:has(*))');
    expect(css).toContain('.cinder-file-upload__dropzone:focus-within');
    expect(css).toContain('@supports selector(:has(*))');
    expect(css).toContain(
      '.cinder-file-upload__dropzone:has(.cinder-file-upload__input:focus-visible)',
    );
    expect(css).toContain('.cinder-file-upload__button:focus-visible');
    expect(css).toContain(
      '.cinder-file-upload__dropzone--border-beam:has(.cinder-file-upload__button:focus-visible)',
    );
  });
});
