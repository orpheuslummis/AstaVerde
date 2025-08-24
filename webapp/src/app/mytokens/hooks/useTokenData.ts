import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useAppContext } from "../../../contexts/AppContext";
import { useContractInteraction } from "../../../hooks/useContractInteraction";
import { useVault } from "../../../hooks/useVault";

export interface TokenData {
  tokens: bigint[];
  tokenBalances: Record<string, bigint>;
  vaultedTokens: bigint[];
  redeemStatus: Record<string, boolean>;
  batchData: Map<bigint, unknown>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTokenData(): TokenData {
  const { address } = useAccount();
  const [tokens, setTokens] = useState<bigint[]>([]);
  const [tokenBalances, setTokenBalances] = useState<Record<string, bigint>>({});
  const [vaultedTokens, setVaultedTokens] = useState<bigint[]>([]);
  const [redeemStatus, setRedeemStatus] = useState<Record<string, boolean>>({});
  const [batchData, setBatchData] = useState<Map<bigint, unknown>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { astaverdeContractConfig } = useAppContext();
  const { getUserLoans, isVaultAvailable } = useVault();

  const { execute: getTokensOfOwner } = useContractInteraction(
    astaverdeContractConfig,
    "balanceOf",
  );
  const { execute: getTokenInfo } = useContractInteraction(
    astaverdeContractConfig,
    "tokens",
  );
  const { execute: getLastTokenID } = useContractInteraction(
    astaverdeContractConfig,
    "lastTokenID",
  );
  const { execute: getLastBatchID } = useContractInteraction(
    astaverdeContractConfig,
    "lastBatchID",
  );
  const { execute: getBatchInfo } = useContractInteraction(
    astaverdeContractConfig,
    "getBatchInfo",
  );

  const fetchTokens = useCallback(async () => {
    if (!address) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch last token ID
      const lastTokenID = await getLastTokenID() as bigint;
      if (lastTokenID === undefined || lastTokenID === null) {
        throw new Error("Failed to fetch last token ID");
      }

      // Fetch batch information
      const lastBatchID = await getLastBatchID() as bigint;
      const batchMap = new Map<bigint, unknown>();

      if (lastBatchID && lastBatchID > 0n) {
        const batchIds = Array.from({ length: Number(lastBatchID) }, (_, i) => BigInt(i + 1));

        const batchPromises = batchIds.map(async (batchId) => {
          try {
            const batch = await getBatchInfo(batchId);
            return { batchId, batch };
          } catch (err) {
            console.error(`Failed to fetch batch ${batchId}:`, err);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach(result => {
          if (result && result.batch) {
            batchMap.set(result.batchId, result.batch);
          }
        });
      }
      setBatchData(batchMap);

      // Fetch user tokens and balances
      const userTokens: bigint[] = [];
      const balances: Record<string, bigint> = {};
      const status: Record<string, boolean> = {};

      for (let i = 1n; i <= lastTokenID; i++) {
        const balance = await getTokensOfOwner(address, i) as bigint;
        if (balance && balance > 0n) {
          // Add token instances based on balance
          for (let j = 0n; j < balance; j++) {
            userTokens.push(i);
          }
          balances[i.toString()] = balance;
        }
      }

      setTokens(userTokens);
      setTokenBalances(balances);

      // Fetch redeem status for unique tokens
      const uniqueTokenIds = Array.from(new Set(userTokens));
      for (const tokenId of uniqueTokenIds) {
        const tokenInfo = await getTokenInfo(tokenId) as any;
        status[tokenId.toString()] = tokenInfo[4];
      }

      // Fetch vault information if available
      if (isVaultAvailable) {
        try {
          const vaultLoans = await getUserLoans();
          setVaultedTokens(vaultLoans);

          // Get redeem status for vaulted tokens
          for (const vaultTokenId of vaultLoans) {
            if (!status[vaultTokenId.toString()]) {
              const tokenInfo = await getTokenInfo(vaultTokenId) as any;
              status[vaultTokenId.toString()] = tokenInfo[4];
            }
          }
        } catch (vaultError) {
          console.error("Error fetching vault loans:", vaultError);
        }
      }

      setRedeemStatus(status);
    } catch (error) {
      console.error("Error fetching tokens:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch tokens");
    } finally {
      setIsLoading(false);
    }
  }, [
    address,
    getTokensOfOwner,
    getTokenInfo,
    getLastTokenID,
    getLastBatchID,
    getBatchInfo,
    isVaultAvailable,
    getUserLoans,
  ]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  return {
    tokens,
    tokenBalances,
    vaultedTokens,
    redeemStatus,
    batchData,
    isLoading,
    error,
    refetch: fetchTokens,
  };
}
