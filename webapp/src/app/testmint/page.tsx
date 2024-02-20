"use client";

import React, { useState } from "react";
import {
	astaverdeContractConfig,
	getUsdcContractConfig,
} from "../../lib/contracts";
import { useAccount, useContractWrite, usePrepareContractWrite } from "wagmi";
import { USDC_DECIMALS } from "../../app.config";

export default function Page() {
	const { address } = useAccount();
	const tenthousand = 10000n * 10n ** BigInt(USDC_DECIMALS);
	const [awaitedHash, setAwaitedHash] = useState<`0x${string}`>();
	const usdcContractConfig = getUsdcContractConfig();
	const { config: configApprove } = usePrepareContractWrite({
		...usdcContractConfig,
		functionName: "approve",
		args: [astaverdeContractConfig.address, tenthousand],
	});
	const { writeAsync: approve } = useContractWrite(configApprove);
	const { config: configMint } = usePrepareContractWrite({
		...usdcContractConfig,
		functionName: "mint",
		args: [address, tenthousand],
	});
	const { writeAsync: mint } = useContractWrite(configMint);

	return (
		<div>
			<h1>Mint 10000 USDC</h1>
			<button
				type="button"
				className="border p-4 font-bold m-4"
				onClick={async () => {
					if (approve) {
						const result = await approve();
						setAwaitedHash(result.hash);
					}
				}}
			>
				Approve
			</button>
			<button
				type="button"
				className="border p-4 font-bold m-4"
				onClick={async () => {
					if (mint) {
						const result = await mint();
						setAwaitedHash(result.hash);
					}
				}}
			>
				Mint
			</button>
		</div>
	);
}
