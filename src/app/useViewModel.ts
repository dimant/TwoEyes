import { useSyncExternalStore } from "react";
import type { Observable } from "./vm/observable";

export function useViewModel<S>(vm: Observable<S>): S {
  return useSyncExternalStore(vm.subscribe, () => vm.snapshot);
}
