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

  const { execute: getBalanceOf } = useContractInteraction(astaverdeContractConfig, "balanceOf");
  const { execute: getIsRedeemed } = useContractInteraction(astaverdeContractConfig, "isRedeemed");
  const { execute: getLastTokenID } = useContractInteraction(astaverdeContractConfig, "lastTokenID");
  const { execute: getLastBatchID } = useContractInteraction(astaverdeContractConfig, "lastBatchID");
  const { execute: getBatchInfo } = useContractInteraction(astaverdeContractConfig, "getBatchInfo");

  const fetchTokens = useCallback(async () => {
    if (!address) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch last token ID
      const lastTokenID = (await getLastTokenID()) as bigint;
      if (lastTokenID === undefined || lastTokenID === null) {
        throw new Error("Failed to fetch last token ID");
      }

      // Fetch batch information
      const lastBatchID = (await getLastBatchID()) as bigint;
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

        batchResults.forEach((result) => {
          if (result && result.batch) {
            batchMap.set(result.batchId, result.batch);
          }
        });
      }
      setBatchData(batchMap);

      // Fetch user tokens and balances in parallel
      const userTokens: bigint[] = [];
      const balances: Record<string, bigint> = {};
      const status: Record<string, boolean> = {};

      // Create array of token IDs to fetch
      const tokenIds: bigint[] = [];
      for (let i = 1n; i <= lastTokenID; i++) {
        tokenIds.push(i);
      }

      // Fetch all balances in parallel
      const balancePromises = tokenIds.map((tokenId) =>
        getBalanceOf(address, tokenId).then((balance) => ({ tokenId, balance: balance as bigint })),
      );
      const balanceResults = await Promise.all(balancePromises);

      // Process results
      for (const { tokenId, balance } of balanceResults) {
        if (balance && balance > 0n) {
          // Add token instances based on balance
          for (let j = 0n; j < balance; j++) {
            userTokens.push(tokenId);
          }
          balances[tokenId.toString()] = balance;
        }
      }

      setTokens(userTokens);
      setTokenBalances(balances);

      // Fetch redeem status for unique tokens in parallel
      const uniqueTokenIds = Array.from(new Set(userTokens));
      const statusPromises = uniqueTokenIds.map((tokenId) =>
        getIsRedeemed(tokenId).then((isRedeemed) => ({
          tokenId,
          isRedeemed: isRedeemed as boolean,
        })),
      );
      const statusResults = await Promise.all(statusPromises);

      for (const { tokenId, isRedeemed } of statusResults) {
        status[tokenId.toString()] = isRedeemed;
      }

      // Fetch vault information if available
      if (isVaultAvailable) {
        try {
          const vaultLoans = await getUserLoans();
          
          // Filter out invalid token IDs that might be in the vault
          // This handles cases where vault has stale data from previous deployments
          const validVaultLoans = vaultLoans.filter((tokenId) => {
            if (tokenId <= 0n || tokenId > lastTokenID) {
              console.warn(`Filtering out invalid vault token ID: ${tokenId} (max valid: ${lastTokenID})`);
              return false;
            }
            return true;
          });
          
          setVaultedTokens(validVaultLoans);

          // Get redeem status for valid vaulted tokens in parallel
          const vaultTokensToCheck = validVaultLoans.filter((vaultTokenId) => !status[vaultTokenId.toString()]);

          if (vaultTokensToCheck.length > 0) {
            const vaultStatusPromises = vaultTokensToCheck.map(async (tokenId) => {
              try {
                const isRedeemed = await getIsRedeemed(tokenId);
                return {
                  tokenId,
                  isRedeemed: isRedeemed as boolean,
                };
              } catch (err) {
                console.warn(`Failed to get redeem status for vault token ${tokenId}:`, err);
                return null;
              }
            });
            const vaultStatusResults = await Promise.all(vaultStatusPromises);

            for (const result of vaultStatusResults) {
              if (result) {
                status[result.tokenId.toString()] = result.isRedeemed;
              }
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
    getBalanceOf,
    getIsRedeemed,
    getLastTokenID,
    getLastBatchID,
    getBatchInfo,
    isVaultAvailable,
    getUserLoans,
  ]);

  useEffect(() => {
    fetchTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]); // Only re-fetch when address changes

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
