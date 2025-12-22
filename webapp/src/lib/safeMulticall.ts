import type { MulticallParameters, MulticallReturnType, PublicClient, ReadContractParameters } from "viem";

const multicallSupportedByChainId = new Map<number, boolean>();

function chainHasMulticall3(publicClient: PublicClient, params: { multicallAddress?: string }): boolean {
  if (params.multicallAddress) return true;

  const chainAny = publicClient.chain as unknown as {
    contracts?: { multicall3?: { address?: string } };
  };
  return Boolean(chainAny?.contracts?.multicall3?.address);
}

function shouldFallbackForMulticallError(error: unknown): boolean {
  const message =
    (error as { shortMessage?: string; message?: string })?.shortMessage ??
    (error as { message?: string })?.message ??
    "";

  return (
    message.includes("multicall") ||
    message.includes("Multicall") ||
    message.includes("contracts.multicall3") ||
    message.includes("multicall3") ||
    message.includes("chain does not support") ||
    message.includes("Chain does not support")
  );
}

async function fallbackReadContracts<const contracts extends readonly unknown[], allowFailure extends boolean>(
  publicClient: PublicClient,
  params: MulticallParameters<contracts, allowFailure>,
): Promise<MulticallReturnType<contracts, allowFailure>> {
  const allowFailureBool = (params.allowFailure ?? true) as boolean;
  const contractCalls = params.contracts ?? [];

  if (allowFailureBool) {
    const results: Array<{ status: "success" | "failure"; result?: unknown; error?: unknown }> = [];
    for (const contract of contractCalls) {
      try {
        const result = await publicClient.readContract(contract as unknown as ReadContractParameters);
        results.push({ status: "success", result });
      } catch (error) {
        results.push({ status: "failure", error, result: undefined });
      }
    }
    return results as unknown as MulticallReturnType<contracts, allowFailure>;
  }

  const results: unknown[] = [];
  for (const contract of contractCalls) {
    results.push(await publicClient.readContract(contract as unknown as ReadContractParameters));
  }
  return results as unknown as MulticallReturnType<contracts, allowFailure>;
}

export async function safeMulticall<const contracts extends readonly unknown[], allowFailure extends boolean = true>(
  publicClient: PublicClient,
  params: MulticallParameters<contracts, allowFailure>,
): Promise<MulticallReturnType<contracts, allowFailure>> {
  const chainId = publicClient.chain?.id;
  if (chainId != null && multicallSupportedByChainId.get(chainId) === false) {
    return fallbackReadContracts(publicClient, params);
  }

  if (!chainHasMulticall3(publicClient, params)) {
    if (chainId != null) multicallSupportedByChainId.set(chainId, false);
    return fallbackReadContracts(publicClient, params);
  }

  try {
    const results = await publicClient.multicall(params);
    if (chainId != null) multicallSupportedByChainId.set(chainId, true);
    return results as MulticallReturnType<contracts, allowFailure>;
  } catch (error) {
    if (shouldFallbackForMulticallError(error)) {
      if (chainId != null) multicallSupportedByChainId.set(chainId, false);
      return fallbackReadContracts(publicClient, params);
    }
    throw error;
  }
}
