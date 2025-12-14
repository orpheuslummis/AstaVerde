import { useMemo } from "react";
import { usePublicClient } from "wagmi";

import { wrapPublicClient } from "../lib/rpcLimiter";

const LOCAL_CHAIN_ID = 31337;

export function useRateLimitedPublicClient() {
  const client = usePublicClient();

  return useMemo(() => {
    if (!client) return undefined;

    // On non-local chains, the wagmi config already uses a globally rate-limited HTTP transport
    // (`createRateLimitedHttp`). Wrapping the client again nests the same limiter and can
    // deadlock (e.g., concurrent reads or a write+event poll), leaving UI stuck in "loading".
    if (client.chain?.id !== LOCAL_CHAIN_ID) return client;

    // Local hardhat node: keep lightweight pacing to avoid RPC bursts during dev.
    return wrapPublicClient(client);
  }, [client]);
}
