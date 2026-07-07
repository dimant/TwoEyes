export class Observable<S> {
  private listeners = new Set<() => void>();
  private _snapshot: S;

  constructor(initial: S) { this._snapshot = initial; }

  get snapshot(): S { return this._snapshot; }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  protected set(next: S): void {
    this._snapshot = next;
    for (const l of this.listeners) l();
  }
}
