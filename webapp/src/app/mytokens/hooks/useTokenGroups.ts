import { useMemo } from "react";
import { TokenMetadata } from "./useTokenMetadata";

export interface TokenGroup {
  batchId: string;
  name: string;
  description?: string;
  availableTokenIds: bigint[];
  vaultedTokenIds: bigint[];
  availableCount: number;
  vaultedCount: number;
  totalCount: number;
  metadata?: TokenMetadata;
  imageUrl?: string;
}

export type TabType = "all" | "available" | "vaulted";

interface UseTokenGroupsParams {
  tokens: bigint[];
  vaultedTokens: bigint[];
  tokenMetadata: Record<string, TokenMetadata>;
  batchData: Map<bigint, unknown>;
  activeTab: TabType;
}

export function useTokenGroups({ tokens, vaultedTokens, tokenMetadata, batchData, activeTab }: UseTokenGroupsParams) {
  const tokenGroups = useMemo(() => {
    const groups = new Map<string, TokenGroup>();

    // Get all unique token IDs
    const allTokenIds = new Set<bigint>([...tokens, ...vaultedTokens]);

    if (allTokenIds.size === 0) {
      return [];
    }

    // If batch data is available, use it to group tokens
    if (batchData.size > 0) {
      // Create a map to track which batch each token belongs to
      const tokenToBatch = new Map<bigint, bigint>();

      // Iterate through all batches to find which tokens belong to which batch
      batchData.forEach((batch: any, batchId) => {
        if (batch && batch[1]) {
          // batch[1] contains the token IDs array
          const tokenIds = batch[1];
          tokenIds.forEach((tokenId: bigint) => {
            tokenToBatch.set(tokenId, batchId);
          });
        }
      });

      // Group tokens by their batch
      const batchGroups = new Map<bigint, Set<bigint>>();

      allTokenIds.forEach((tokenId) => {
        const batchId = tokenToBatch.get(tokenId);
        if (batchId) {
          if (!batchGroups.has(batchId)) {
            batchGroups.set(batchId, new Set());
          }
          batchGroups.get(batchId)!.add(tokenId);
        } else {
          // If no batch found, create individual group
          const individualBatchId = BigInt(-Number(tokenId)); // Use negative to avoid collision
          batchGroups.set(individualBatchId, new Set([tokenId]));
        }
      });

      // Create TokenGroup objects for each batch
      batchGroups.forEach((batchTokenIdSet, batchId) => {
        const batchTokenIds = Array.from(batchTokenIdSet).sort((a, b) => Number(a - b));

        const firstTokenId = batchTokenIds[0];
        const metadata = tokenMetadata[firstTokenId.toString()];
        const isIndividual = batchId < 0n;
        const displayBatchId = isIndividual ? firstTokenId : batchId;
        const name = `Batch #${displayBatchId}`;

        // Separate available and vaulted tokens for this batch
        const availableTokenIds: bigint[] = [];
        const vaultedTokenIds: bigint[] = [];

        batchTokenIds.forEach((tokenId) => {
          // Count how many of this token ID we have available
          const availableCount = tokens.filter((t) => t === tokenId).length;
          const vaultedCount = vaultedTokens.filter((t) => t === tokenId).length;

          // Add the appropriate number of instances
          for (let i = 0; i < availableCount; i++) {
            availableTokenIds.push(tokenId);
          }
          for (let i = 0; i < vaultedCount; i++) {
            vaultedTokenIds.push(tokenId);
          }
        });

        const batchIdStr = `batch-${displayBatchId}`;

        groups.set(batchIdStr, {
          batchId: batchIdStr,
          name,
          description: metadata?.description,
          availableTokenIds,
          vaultedTokenIds,
          availableCount: availableTokenIds.length,
          vaultedCount: vaultedTokenIds.length,
          totalCount: availableTokenIds.length + vaultedTokenIds.length,
          metadata,
          imageUrl: metadata?.image,
        });
      });
    } else {
      // Fallback: If no batch data, group all identical tokens together
      const tokenGroupMap = new Map<bigint, { available: number; vaulted: number }>();

      tokens.forEach((tokenId) => {
        if (!tokenGroupMap.has(tokenId)) {
          tokenGroupMap.set(tokenId, { available: 0, vaulted: 0 });
        }
        tokenGroupMap.get(tokenId)!.available++;
      });

      vaultedTokens.forEach((tokenId) => {
        if (!tokenGroupMap.has(tokenId)) {
          tokenGroupMap.set(tokenId, { available: 0, vaulted: 0 });
        }
        tokenGroupMap.get(tokenId)!.vaulted++;
      });

      tokenGroupMap.forEach((counts, tokenId) => {
        const metadata = tokenMetadata[tokenId.toString()];
        const name = metadata?.name || `Token #${tokenId}`;

        const availableTokenIds: bigint[] = [];
        const vaultedTokenIds: bigint[] = [];

        for (let i = 0; i < counts.available; i++) {
          availableTokenIds.push(tokenId);
        }
        for (let i = 0; i < counts.vaulted; i++) {
          vaultedTokenIds.push(tokenId);
        }

        const batchIdStr = `token-${tokenId}`;

        groups.set(batchIdStr, {
          batchId: batchIdStr,
          name,
          description: metadata?.description,
          availableTokenIds,
          vaultedTokenIds,
          availableCount: availableTokenIds.length,
          vaultedCount: vaultedTokenIds.length,
          totalCount: availableTokenIds.length + vaultedTokenIds.length,
          metadata,
          imageUrl: metadata?.image,
        });
      });
    }

    // Sort groups
    return Array.from(groups.values()).sort((a, b) => {
      const aMatch = a.batchId.match(/(\d+)/);
      const bMatch = b.batchId.match(/(\d+)/);
      const aId = aMatch ? parseInt(aMatch[1]) : 0;
      const bId = bMatch ? parseInt(bMatch[1]) : 0;
      return aId - bId;
    });
  }, [tokens, vaultedTokens, tokenMetadata, batchData]);

  // Filter based on active tab
  const filteredGroups = useMemo(() => {
    switch (activeTab) {
    case "available":
      return tokenGroups.filter((g) => g.availableCount > 0);
    case "vaulted":
      return tokenGroups.filter((g) => g.vaultedCount > 0);
    default:
      return tokenGroups;
    }
  }, [tokenGroups, activeTab]);

  return {
    tokenGroups,
    filteredGroups,
  };
}
