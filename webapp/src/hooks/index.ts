// Re-export all event hooks for convenient imports
export { useContractEvents } from "./useContractEvents";
export { useProducerEvents, useProducerDashboardEvents } from "./useProducerEvents";
export { useAdminEvents, useAdminDashboardEvents } from "./useAdminEvents";

// Re-export existing hooks
export { useAppContext } from "../contexts/AppContext";
export { useContractInteraction } from "./useContractInteraction";
export { useGlobalEvent, useAstaVerdeRefetch, useAstaVerdeBalancesRefetch, dispatchRefetch, dispatchBalancesRefetch } from "./useGlobalEvent";
export { useIsProducer } from "./useIsProducer";
