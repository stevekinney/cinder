export class Counter {
  count = $state(0);

  increment(): void {
    this.count += 1;
  }
}
