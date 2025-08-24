import { useCallback, useState } from "react";
import { useContractInteraction } from "../../../hooks/useContractInteraction";
import { useAppContext } from "../../../contexts/AppContext";
import { fetchJsonFromIpfsWithFallback, resolveIpfsUriToUrl } from "../../../utils/ipfsHelper";

export interface TokenMetadata {
  name: string;
  description: string;
  image: string;
}

export interface TokenMetadataHook {
  metadata: Record<string, TokenMetadata>;
  isLoading: boolean;
  fetchMetadata: (tokenIds: bigint[]) => Promise<void>;
  getImageUrl: (metadata?: TokenMetadata) => string | undefined;
}

export function useTokenMetadata(): TokenMetadataHook {
  const [metadata, setMetadata] = useState<Record<string, TokenMetadata>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { astaverdeContractConfig } = useAppContext();

  const { execute: fetchTokenURI } = useContractInteraction(
    astaverdeContractConfig,
    "uri",
  );

  const fetchMetadata = useCallback(async (tokenIds: bigint[]) => {
    if (tokenIds.length === 0) return;

    setIsLoading(true);
    const newMetadata: Record<string, TokenMetadata> = {};

    try {
      // Get unique token IDs to avoid duplicate fetches
      const uniqueTokenIds = Array.from(new Set(tokenIds));

      const metadataPromises = uniqueTokenIds.map(async (tokenId) => {
        const key = tokenId.toString();

        // Skip if we already have metadata for this token
        if (metadata[key]) {
          newMetadata[key] = metadata[key];
          return;
        }

        try {
          const uri = await fetchTokenURI(tokenId) as string;
          if (uri && uri.startsWith("ipfs://")) {
            const metadataResult = await fetchJsonFromIpfsWithFallback(uri);
            if (metadataResult && metadataResult.data) {
              newMetadata[key] = metadataResult.data as TokenMetadata;
            }
          }
        } catch (err) {
          console.error(`Failed to fetch metadata for token ${tokenId}:`, err);
        }
      });

      await Promise.all(metadataPromises);

      setMetadata(prev => ({ ...prev, ...newMetadata }));
    } catch (error) {
      console.error("Error fetching metadata:", error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTokenURI, metadata]);

  const getImageUrl = useCallback((metadata?: TokenMetadata) => {
    if (!metadata?.image) return undefined;
    return resolveIpfsUriToUrl(metadata.image);
  }, []);

  return {
    metadata,
    isLoading,
    fetchMetadata,
    getImageUrl,
  };
}
