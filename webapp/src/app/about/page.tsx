export default function Page() {
	return (
		<>
			<div className="w-full justify-center pt-4 flex gap-4 flex-col m-4">
				<div className="text-lg">
					<h1 className="font-bold text-2xl mb-4">EcoTradeZone</h1>
					<p className="mb-4">
						EcoTradeZone revolutionizes the way biochar production is valued and
						traded. It stands as a unique marketplace where the diligent work of
						biochar producers is transformed into tangible tokens, each
						representing their creation. These tokens are not just symbolic;
						they embody the genuine environmental impact of the producers'
						efforts, quantified as one tonne of carbon dioxide equivalent. At
						EcoTradeZone, these tokens can be both purchased and redeemed,
						offering a direct and meaningful way to participate in climate
						action. This system not only incentivizes biochar production but
						also connects the efforts of producers with individuals and
						organizations eager to contribute to global carbon reduction. By
						making each token a claimable representation of a real-world
						environmental benefit, EcoTradeZone fosters a new, eco-conscious
						economy where sustainable practices are both recognized and
						rewarded.
						<br />
						<a
							href="/What.is.an.EcoAsset.pdf"
							className="underline text-blue-500"
						>
							*Read Everything about EcoAssets before buying
						</a>
					</p>
				</div>
				<div>
					<h2 className="font-bold text-xl mb-4">Bug Report</h2>
					<p className="mb-2">
						Please tell us about any bugs you find, we want to keep this place
						running smoothly to help producers get their earnings. There may be
						some small rewards for bugs found, depending on the bug.
						<br />
						Email: <a href="mailto:chris@bionerg.com">chris@bionerg.com</a>
						<br />
						Title: Bug Found
					</p>
				</div>
				<h2 className="font-bold text-xl">FAQ</h2>
				<div>
					<p>
						<span className="font-bold">
							Q: Why don't the Ethereums work here to buy EcoAssets?
						</span>
						<br />
						A: This is on the Base network, which runs in parallel to the main
						Ethereum network and has responsibilities to it in terms of its data
						integrity. But this means that you need the currencies that are used
						on this Base network. Coinbase wallets work natively with Base and
						the currency that you purchase in is USDC so make sure that the
						currency you have on your base network wallet.
						<br />
						<span className="font-bold">
							Q: What do I need to know about using my wallet here?
						</span>
						<br />
						A: Transactions here are conducted using Base native USDC, issued by
						Circle. For more understanding:
						<br />
						<div className="pt-4">
							<a
								href="https://base.mirror.xyz/Ouwm--AtTIVyz40He3FxI0fDAC05lOQwN6EzFMD_2UM"
								className="underline text-blue-500 hover:text-blue-700 transition duration-150 ease-in-out"
							>
								Learn about Base
							</a>
							<br />
							<a
								href="https://help.coinbase.com/en/coinbase/other-topics/other/base"
								className="underline text-blue-500 hover:text-blue-700 transition duration-150 ease-in-out"
							>
								Base from Coinbase
							</a>
							<br />
							<a
								href="https://www.circle.com/blog/usdc-now-available-natively-on-base"
								className="underline text-blue-500 hover:text-blue-700 transition duration-150 ease-in-out"
							>
								USDC on Base
							</a>
						</div>
					</p>
				</div>
			</div>
		</>
	);
}
