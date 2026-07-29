import { useMemo } from "react";
import { type OwlAgentsContextState } from "contexts/owlagents/types";
import { createOwlAgentsStore } from "owlagents/store/createStore";

/**
 * Creates the store once and returns a value whose identity never changes.
 *
 * That is deliberate: nothing re-renders because of this context. All
 * reactivity flows through `subscribe`, so a ledger append only re-renders the
 * components that actually read the slice that changed.
 */
const useOwlAgentsContextState = (): OwlAgentsContextState =>
  useMemo(() => createOwlAgentsStore(), []);

export default useOwlAgentsContextState;
