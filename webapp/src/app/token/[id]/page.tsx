// src/app/token/[id]/page.tsx
"use client";

import { BigNumberish } from "ethers";
import { useEffect, useState } from "react";
import { IPFS_GATEWAY_URL } from "../../../app.config";
import { TokenCard } from "../../../components/TokenCard";
import { usePublicClient } from "../../../contexts/PublicClientContext";
import { astaverdeContractConfig } from "../../../lib/contracts";

interface TokenData {
	0: BigNumberish; // Token ID
	1: string; // Producer
	2: string; // CID
	3: boolean; // Is redeemed
}
export default function Page({ params }: { params: { id: bigint } }) {
	const publicClient = usePublicClient();
	const [tokenData, setTokenData] = useState<TokenData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [tokenImageUrl, setTokenImageUrl] = useState<string>();

	useEffect(() => {
		async function fetchTokenData() {
			try {
				const data = await publicClient.readContract({
					...astaverdeContractConfig,
					functionName: "tokens",
					args: [params.id],
				}) as TokenData;
				setTokenData(data);
			} catch (err) {
				console.error("Error fetching token data:", err);
				setError("Failed to fetch token data");
			} finally {
				setIsLoading(false);
			}
		}

		fetchTokenData();
	}, [publicClient, params.id]);

	const fetchTokenImageUrl = async (tokenCID: string) => {
		try {
			const response = await fetch(`${IPFS_GATEWAY_URL}${tokenCID}`);
			const metadata = await response.json();
			const imageUrl = metadata.image;
			return imageUrl;
		} catch (error) {
			return null;
		}
	};

	useEffect(() => {
		const fetchData = async () => {
			if (tokenData && tokenData[2]) {
				const tokenImageCID = await fetchTokenImageUrl(tokenData[2]);
				if (tokenImageCID) {
					const parts = tokenImageCID.split("ipfs://");
					const CID = parts[1];
					setTokenImageUrl(IPFS_GATEWAY_URL + CID);
				}
			}
		};
		void fetchData();
	}, [tokenData, isLoading]);

	if (isLoading) {
		return (
			<div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-screen">
				<p>Loading token data...</p>
			</div>
		);
	} else if (error) {
		return (
			<div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-screen">
				<p>Error: {error}</p>
			</div>
		);
	}

	if (!tokenData || tokenData[1] === "0x0000000000000000000000000000000000000000") {
		return (
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					height: "100vh",
				}}
			>
				<div
					style={{
						backgroundColor: "#f0f0f0",
						padding: "20px",
						borderRadius: "5px",
					}}
				>
					Token doesn&apos;t exist
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-screen">
			<div className="w-full max-w-2xl">
				<TokenCard
					tokenId={params.id}
					tokenData={tokenData}
					tokenImageUrl={tokenImageUrl}
					showLink={false}
				/>
			</div>
		</div>
	);
}