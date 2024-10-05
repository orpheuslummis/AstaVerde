import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { IPFS_GATEWAY_URL } from "../app.config";
import { useAppContext } from "../contexts/AppContext";
import { useContractInteraction } from "../hooks/useContractInteraction";

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
    const [error, setError] = useState<string | null>(null);
    const { ref, inView } = useInView({
        triggerOnce: true,
        rootMargin: "200px 0px",
        threshold: 0.1,
    });
    const { astaverdeContractConfig } = useAppContext();
    const { execute } = useContractInteraction(astaverdeContractConfig, "uri");

    const fetchTokenData = useCallback(async () => {
        try {
            const tokenURI = await execute(tokenId);

            if (typeof tokenURI !== "string") {
                throw new Error("Invalid token URI returned");
            }
            const ipfsHash = tokenURI.replace("ipfs://", "");
            const response = await fetch(`${IPFS_GATEWAY_URL}${ipfsHash}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setTokenData(data);
        } catch (err) {
            setError(`Failed to load token data. Please try again later.`);
        }
    }, [execute, tokenId]);

    useEffect(() => {
        fetchTokenData();
    }, [fetchTokenData, tokenId]);

    const handleSelect = useCallback(() => {
        if (onSelect && !isRedeemed) {
            onSelect(tokenId, !isSelected);
        }
    }, [onSelect, tokenId, isSelected, isRedeemed]);

    const cardContent = (
        <>
            {error ? (
                <p className="text-red-500 dark:text-red-400">{error}</p>
            ) : tokenData ? (
                <>
                    <div className="relative w-full aspect-square">
                        {tokenData.image ? (
                            <Image
                                src={tokenData.image.replace("ipfs://", IPFS_GATEWAY_URL)}
                                alt={tokenData.name || `Token ${tokenId}`}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-cover rounded-t-lg"
                            />
                        ) : (
                            <div className="w-full h-full shimmer dark:bg-gray-700 rounded-t-lg"></div>
                        )}
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