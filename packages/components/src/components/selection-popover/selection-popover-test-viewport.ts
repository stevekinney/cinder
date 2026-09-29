export class SelectionPopoverTestViewport extends EventTarget {
  height: number;
  scale = 1;

  constructor(height: number) {
    super();
    this.height = height;
  }
}
