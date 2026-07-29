import contextFactory from "contexts/contextFactory";
import useOwlAgentsContextState from "contexts/owlagents/useOwlAgentsContextState";

const { Provider, useContext } = contextFactory(useOwlAgentsContextState);

export { Provider as OwlAgentsProvider, useContext as useOwlAgentsContext };
