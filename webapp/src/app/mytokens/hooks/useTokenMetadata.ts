import { useCallback, useState, useRef } from "react";
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
  const metadataRef = useRef(metadata);

  // Keep ref in sync with state
  metadataRef.current = metadata;

  const { execute: fetchTokenURI } = useContractInteraction(astaverdeContractConfig, "uri");

  const fetchMetadata = useCallback(
    async (tokenIds: bigint[]) => {
      if (tokenIds.length === 0) return;

      setIsLoading(true);

      try {
        // Get unique token IDs to avoid duplicate fetches
        const uniqueTokenIds = Array.from(new Set(tokenIds));

        // Filter out tokens we already have metadata for using ref
        const tokensToFetch = uniqueTokenIds.filter((tokenId) => {
          const key = tokenId.toString();
          return !metadataRef.current[key];
        });

        // If we already have all metadata, skip fetching
        if (tokensToFetch.length === 0) {
          setIsLoading(false);
          return;
        }

        const metadataPromises = tokensToFetch.map(async (tokenId) => {
          const key = tokenId.toString();

          try {
            const uri = (await fetchTokenURI(tokenId)) as string;
            if (uri && uri.startsWith("ipfs://")) {
              const metadataResult = await fetchJsonFromIpfsWithFallback(uri);
              if (metadataResult && metadataResult.data) {
                return { key, data: metadataResult.data as TokenMetadata };
              }
            }
          } catch (err) {
            console.error(`Failed to fetch metadata for token ${tokenId}:`, err);
          }
          return null;
        });

        const results = await Promise.all(metadataPromises);

        setMetadata((prev) => {
          const newMetadata = { ...prev };
          results.forEach((result) => {
            if (result && !prev[result.key]) {
              newMetadata[result.key] = result.data;
            }
          });
          return newMetadata;
        });
      } catch (error) {
        console.error("Error fetching metadata:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchTokenURI],
  );

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
