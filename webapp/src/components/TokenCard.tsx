import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { useAppContext } from "../contexts/AppContext";
import { useContractInteraction } from "../hooks/useContractInteraction";
import { fetchJsonFromIpfsWithFallback, resolveIpfsUriToUrl } from "../utils/ipfsHelper";

interface TokenMetadata {
    name: string;
    description: string;
    image: string;
}

interface TokenCardProps {
    tokenId: bigint;
    isCompact?: boolean;
    isMyTokensPage?: boolean;
    isRedeemed?: boolean;
    isSelected?: boolean;
    onSelect?: (tokenId: bigint, isSelected: boolean) => void;
    linkTo?: string;
}

export default function TokenCard({
    tokenId,
    isCompact = false,
    isMyTokensPage,
    isRedeemed,
    isSelected,
    onSelect,
    linkTo,
}: TokenCardProps) {
    const [tokenData, setTokenData] = useState<TokenMetadata | null>(null);
    const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { ref, inView } = useInView({
        triggerOnce: true,
        rootMargin: "200px 0px",
        threshold: 0.1,
    });
    const { astaverdeContractConfig } = useAppContext();
    const { execute: fetchTokenContractURI } = useContractInteraction(astaverdeContractConfig, "uri");

    const fetchTokenDisplayData = useCallback(async () => {
        if (!inView) return;
        setError(null);
        setTokenData(null);
        setResolvedImageUrl(null);

        try {
            const contractTokenURI = await fetchTokenContractURI(tokenId) as string;

            if (typeof contractTokenURI !== "string" || !contractTokenURI.startsWith("ipfs://")) {
                throw new Error("Invalid or non-IPFS token URI returned from contract");
            }

            const metadataResult = await fetchJsonFromIpfsWithFallback(contractTokenURI);

            if (metadataResult && metadataResult.data) {
                setTokenData(metadataResult.data);
                if (metadataResult.data.image) {
                    setResolvedImageUrl(resolveIpfsUriToUrl(metadataResult.data.image, metadataResult.gateway));
                } else {
                    console.warn(`Token ${tokenId} metadata loaded but has no image URI.`);
                }
            } else {
                throw new Error(`Failed to load metadata for ${contractTokenURI} from any gateway.`);
            }
        } catch (err: any) {
            console.error(`Error in fetchTokenDisplayData for token ${tokenId}:`, err);
            setError(err.message || "Failed to load token data. Please try again later.");
        }
    }, [fetchTokenContractURI, tokenId, inView]);

    useEffect(() => {
        if (inView) {
            void fetchTokenDisplayData();
        }
    }, [fetchTokenDisplayData, inView]);

    const handleSelect = useCallback(() => {
        if (onSelect && !isRedeemed) {
            onSelect(tokenId, !isSelected);
        }
    }, [onSelect, tokenId, isSelected, isRedeemed]);

    const cardContent = (
        <>
            {error ? (
                <p className="text-red-500 dark:text-red-400 p-4">{error}</p>
            ) : tokenData && resolvedImageUrl ? (
                <>
                    <div className="relative w-full aspect-square">
                        <Image
                            src={resolvedImageUrl}
                            alt={tokenData.name || `Token ${tokenId}`}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover rounded-t-lg"
                            onError={() => {
                                console.error(`Failed to load image: ${resolvedImageUrl}`);
                                setError(`Failed to load image for token ${tokenId}.`);
                                setResolvedImageUrl(null);
                            }}
                        />
                        {isMyTokensPage && (
                            <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold ${isRedeemed
                                ? "bg-gray-500 text-white"
                                : "bg-emerald-500 text-white"
                                }`}>
                                {isRedeemed ? "Redeemed" : "Not redeemed"}
                            </div>
                        )}
                    </div>
                    {!isCompact && (
                        <div className="p-4">
                            <h2 className="text-lg font-semibold mb-2 truncate dark:text-white">
                                {tokenData.name || `Token ${tokenId}`}
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                                {tokenData.description}
                            </p>
                        </div>
                    )}
                </>
            ) : tokenData && !resolvedImageUrl && !error ? (
                <>
                    <div className="relative w-full aspect-square shimmer dark:bg-gray-700 rounded-t-lg">
                        {/* Placeholder for no image or image resolving state */}
                    </div>
                    {!isCompact && (
                        <div className="p-4">
                            <h2 className="text-lg font-semibold mb-2 truncate dark:text-white">
                                {tokenData.name || `Token ${tokenId}`}
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                                {tokenData.description} (Image not available)
                            </p>
                        </div>
                    )}
                </>
            ) : (
                <div className="w-full aspect-square shimmer dark:bg-gray-700 rounded-t-lg"></div>
            )}
        </>
    );

    const cardClasses = `
        token-card
        ${isSelected ? "ring-2 ring-emerald-500" : ""}
        ${isMyTokensPage ? "" : "hover:shadow-lg cursor-pointer"}
        ${isCompact ? "w-full h-full token-card-compact" : ""}
        overflow-hidden rounded-lg transition-all duration-300
        ${isRedeemed ? "opacity-70" : ""}
        dark:bg-gray-800
    `;

    const cardElement = (
        <div
            className={cardClasses}
            onClick={isMyTokensPage ? handleSelect : undefined}
        >
            {cardContent}
        </div>
    );

    if (linkTo) {
        return (
            <Link href={linkTo} className={isCompact ? "w-full h-full" : ""}>
                {cardElement}
            </Link>
        );
    }

    return (
        <div ref={ref} className={isCompact ? "w-full h-full" : ""}>
            {isMyTokensPage ? cardElement : cardElement}
        </div>
    );
}