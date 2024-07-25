"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { TokenCard } from "../../components/TokenCard";
import { usePublicClient } from "../../contexts/PublicClientContext";

export default function Page() {
	const { address } = useAccount();
	const [tokens, setTokens] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const publicClient = usePublicClient();

	useEffect(() => {
		const fetchTokens = async () => {
			if (address && publicClient) {
				try {
					// Implement your token fetching logic here
					// For example:
					// const fetchedTokens = await publicClient.readContract({
					//     ...astaverdeContractConfig,
					//     functionName: "getTokensOfOwner",
					//     args: [address],
					// });
					// setTokens(fetchedTokens);
				} catch (error) {
					console.error("Error fetching tokens:", error);
				} finally {
					setIsLoading(false);
				}
			} else {
				setIsLoading(false);
			}
		};
		fetchTokens();
	}, [address, publicClient]);

	if (isLoading) {
		return <div className="container mx-auto px-4 py-8">Loading your tokens...</div>;
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="font-bold text-2xl mb-6">My Tokens</h1>
			{tokens.length === 0 ? (
				<p>You don't have any tokens yet.</p>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
					{tokens.map((token, index) => (
						<div key={index} className="flex justify-center">
							<TokenCard
								tokenId={token[0]}
								tokenData={token}
								showLink={true}
							/>
						</div>
					))}
				</div>
			)}
		</div>
	);
}