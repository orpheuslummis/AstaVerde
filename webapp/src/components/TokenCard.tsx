import { BigNumberish } from "ethers";
import Image from "next/image";
import Link from "next/link";
import { IPFS_GATEWAY_URL } from "../app.config";
import { getPlaceholderImageUrl } from "../utils/placeholderImage";

interface TokenData {
    0: BigNumberish; // Token ID
    1: string; // Producer
    2: string; // CID
    3: boolean; // Is redeemed
}

interface TokenCardProps {
    tokenId: bigint;
    tokenData: TokenData | null;
    tokenImageUrl?: string;
    showLink?: boolean;
}

export function TokenCard({ tokenId, tokenData, tokenImageUrl, showLink = true }: TokenCardProps) {
    const imageUrl = tokenImageUrl || (tokenData && `${IPFS_GATEWAY_URL}${tokenData[2]}`) || getPlaceholderImageUrl(tokenId);

    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden w-full max-w-xs">
            <div className="relative h-48">
                <Image
                    src={imageUrl}
                    alt={`Token ${tokenId.toString()}`}
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    priority
                />
            </div>
            <div className="p-4">
                <h2 className="text-xl font-semibold mb-2">
                    {showLink ? (
                        <Link href={`/token/${tokenId.toString()}`} className="text-blue-600 hover:text-blue-800">
                            Token: {tokenId.toString()}
                        </Link>
                    ) : (
                        <>Token: {tokenId.toString()}</>
                    )}
                </h2>
                {tokenData ? (
                    <>
                        <p className="text-gray-700 mb-2 truncate">Producer: {tokenData[1]}</p>
                        <p className="text-gray-700 mb-2 truncate">
                            CID: <a href={`${IPFS_GATEWAY_URL}${tokenData[2]}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">{tokenData[2]}</a>
                        </p>
                        <p className="text-gray-700">
                            Status: {tokenData[3] ? "Redeemed" : "Not redeemed"}
                        </p>
                    </>
                ) : (
                    <p className="text-gray-700">Loading token data...</p>
                )}
            </div>
        </div>
    );
}