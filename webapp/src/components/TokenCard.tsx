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
}

export default function TokenCard({
    tokenId,
    isCompact = false,
    isMyTokensPage,
    isRedeemed,
    isSelected,
    onSelect,
}: TokenCardProps) {
    const [tokenData, setTokenData] = useState<TokenMetadata | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { ref, inView } = useInView({
        triggerOnce: true,
        rootMargin: "200px 0px",
    });
    const { astaverdeContractConfig } = useAppContext();
    const { execute } = useContractInteraction(astaverdeContractConfig, "uri");

    const fetchTokenData = useCallback(async () => {
        try {
            console.log(`Fetching data for token ID: ${tokenId}`);
            const tokenURI = await execute(tokenId);
            console.log(`Token URI: ${tokenURI}`);

            if (typeof tokenURI !== "string") {
                throw new Error("Invalid token URI returned");
            }
            const ipfsHash = tokenURI.replace("ipfs://", "");
            const response = await fetch(`${IPFS_GATEWAY_URL}${ipfsHash}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log(`Fetched token data:`, data);
            setTokenData(data);
        } catch (err) {
            console.error(`Error fetching data for token ${tokenId}:`, err);
            setError(`Failed to load token data. Please try again later.`);
        }
    }, [execute, tokenId]);

    useEffect(() => {
        if (inView) {
            fetchTokenData();
        }
    }, [inView, fetchTokenData]);

    const handleSelect = useCallback(() => {
        if (onSelect && !isRedeemed) {
            onSelect(tokenId, !isSelected);
        }
    }, [onSelect, tokenId, isSelected, isRedeemed]);

    const cardContent = (
        <>
            {error ? (
                <p className="text-red-500">{error}</p>
            ) : tokenData ? (
                <>
                    {tokenData.image ? (
                        <div className="relative w-full aspect-square">
                            <Image
                                src={tokenData.image.replace("ipfs://", IPFS_GATEWAY_URL)}
                                alt={tokenData.name || `Token ${tokenId}`}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-cover"
                            />
                        </div>
                    ) : (
                        <div className="w-full aspect-square shimmer"></div>
                    )}
                    {!isCompact && (
                        <div className="p-4">
                            <h2 className="text-lg font-semibold mb-2 truncate">
                                {tokenData.name || `Token ${tokenId}`}
                            </h2>
                            <p className="text-sm text-gray-600 line-clamp-2">
                                {tokenData.description}
                            </p>
                        </div>
                    )}
                </>
            ) : (
                <div className="w-full aspect-square shimmer"></div>
            )}

            {isMyTokensPage && !isCompact && (
                <div className="mt-4">
                    <p className="text-sm font-semibold mb-2">
                        Status: {isRedeemed ? "Redeemed" : "Not Redeemed"}
                    </p>
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={handleSelect}
                            className="form-checkbox h-5 w-5 text-blue-600"
                            disabled={isRedeemed}
                        />
                        <span className="ml-2 text-sm">Select for redemption</span>
                    </label>
                </div>
            )}
        </>
    );

    const cardClasses = `
        token-card
        ${isSelected ? "border-emerald-500" : "border-gray-200"}
        ${isMyTokensPage ? "" : "hover:shadow-lg cursor-pointer"}
        ${isCompact ? "w-full h-full token-card-compact" : ""}
    `;

    const cardElement = <div className={cardClasses}>{cardContent}</div>;

    return (
        <div ref={ref} className={isCompact ? "w-full h-full" : ""}>
            {isMyTokensPage ? (
                cardElement
            ) : (
                <Link href={`/token/${tokenId}`} className="block w-full h-full">
                    {cardElement}
                </Link>
            )}
        </div>
    );
}