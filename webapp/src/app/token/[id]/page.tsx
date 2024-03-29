"use client";

import { IPFS_GATEWAY_URL } from "../../../app.config";
import { astaverdeContractConfig } from "../../../lib/contracts";
import React, { useEffect, useState } from "react";
import { useContractRead } from "wagmi";

export default function Page({ params }: { params: { id: bigint } }) {
	const {
		data,
		isError,
		isLoading,
		error: lastBatchIDError,
	} = useContractRead({
		...astaverdeContractConfig,
		functionName: "tokens",
		args: [params.id],
	});
	const [tokenImageUrl, setTokenImageUrl] = useState<string>();

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
			if (data && data[2]) {
				const tokenImageCID = await fetchTokenImageUrl(data[2]);
				const parts = tokenImageCID.split("ipfs://");
				const CID = parts[1];
				setTokenImageUrl(IPFS_GATEWAY_URL + CID);
			}
		};
		void fetchData();
	}, [data, isLoading]);

	if (isLoading) {
		return <p>Loading...</p>;
	} else if (isError) {
		return <p>Error: {lastBatchIDError && lastBatchIDError.message}</p>;
	}

	if (
		data &&
		data[1].toString() === "0x0000000000000000000000000000000000000000"
	) {
		return (
			<>
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
			</>
		);
	}

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
				<div className="w-full h-64 overflow-hidden rounded shadow-lg">
					<img
						className="w-full h-full object-cover"
						src={tokenImageUrl}
						alt="Batch Image"
					/>
				</div>
				<h1>Token: {params.id.toString()}</h1>
				<p>Token ID: {data && data[0].toString()}</p>
				<p>Producer: {data && data[1]}</p>
				<p>CID: {data && data[2]}</p>
				<p>Is redeemed: {data && data[3] ? "Redeemed" : "Not redeemed"}</p>
			</div>
		</div>
	);
}
