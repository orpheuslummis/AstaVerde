import Image from 'next/image';
import Link from "next/link";
import { useCallback, useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { IPFS_GATEWAY_URL } from "../app.config";
import { useAppContext } from '../contexts/AppContext';
import { useContractInteraction } from '../hooks/useContractInteraction';

interface TokenMetadata {
    name: string;
    description: string;
    image: string;
}

interface TokenCardProps {
    tokenId: number;
}

export default function TokenCard({ tokenId }: TokenCardProps) {
    const [tokenData, setTokenData] = useState<TokenMetadata | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { ref, inView } = useInView({
        triggerOnce: true,
        rootMargin: '200px 0px',
    });
    const { astaverdeContractConfig } = useAppContext();
    const { execute } = useContractInteraction(astaverdeContractConfig, 'uri');

    const fetchTokenData = useCallback(async () => {
        try {
            const tokenURI = await execute([BigInt(tokenId)]);
            if (typeof tokenURI !== 'string') {
                throw new Error('Invalid token URI returned');
            }
            const ipfsHash = tokenURI.replace('ipfs://', '');
            const response = await fetch(`${IPFS_GATEWAY_URL}${ipfsHash}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
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

    return (
        <div ref={ref} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4">
                {error ? (
                    <p className="text-red-500">{error}</p>
                ) : tokenData ? (
                    <>
                        {tokenData.image && (
                            <div className="relative w-full aspect-square mb-4">
                                <Image
                                    src={tokenData.image.replace('ipfs://', IPFS_GATEWAY_URL)}
                                    alt={tokenData.name || `Token ${tokenId}`}
                                    fill
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                    style={{ objectFit: 'contain' }}
                                    onError={() => setError("Failed to load image")}
                                />
                            </div>
                        )}
                        <h2 className="text-xl font-semibold mb-2">{tokenData.name || `Token ${tokenId}`}</h2>
                        <p className="text-gray-600 mb-4">{tokenData.description}</p>
                        <Link href={`/token/${tokenId}`} className="text-blue-500 hover:underline">
                            View Details
                        </Link>
                    </>
                ) : (
                    <p className="text-gray-700">Loading token data...</p>
                )}
            </div>
        </div>
    );
}