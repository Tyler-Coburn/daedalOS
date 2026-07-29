import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";
import { type OwlAgentsServices } from "owlagents/services/types";

export type OwlAgentsContextState = {
  getServerSnapshot: () => OwlAgentsSnapshot;
  getSnapshot: () => OwlAgentsSnapshot;
  services: OwlAgentsServices;
  subscribe: (onChange: () => void) => () => void;
};
