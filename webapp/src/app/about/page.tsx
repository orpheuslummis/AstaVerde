"use client";

export default function Page() {
	return (
		<div className="max-w-4xl mx-auto px-6 py-8 bg-white">
			<section className="mb-12">
				<h1 className="text-4xl font-bold mb-6 text-primary">EcoTradeZone</h1>
				<p className="text-lg leading-relaxed mb-6 text-gray-700">
					EcoTradeZone revolutionizes the way biochar production is valued and
					traded. It stands as a unique marketplace where the diligent work of
					biochar producers is transformed into tangible tokens, each
					representing their creation. These tokens are not just symbolic; they
					embody the genuine environmental impact of the producers' efforts,
					quantified as one tonne of carbon dioxide equivalent. At EcoTradeZone,
					these tokens can be both purchased and redeemed, offering a direct and
					meaningful way to participate in climate action. This system not only
					incentivizes biochar production but also connects the efforts of
					producers with individuals and organizations eager to contribute to
					global carbon reduction. By making each token a claimable
					representation of a real-world environmental benefit, EcoTradeZone
					fosters a new, eco-conscious economy where sustainable practices are
					both recognized and rewarded.
				</p>
				<a
					href="/What.is.an.EcoAsset.pdf"
					className="inline-block bg-primary text-white py-2 px-4 rounded hover:bg-primary-dark transition duration-300"
				>
					Read Everything about EcoAssets before buying
				</a>
			</section>

			<section className="mb-12 bg-gray-100 p-6 rounded-lg">
				<h2 className="text-2xl font-bold mb-4 text-primary">Bug Report</h2>
				<p className="mb-4 text-gray-700">
					Please tell us about any bugs you find, we want to keep this place
					running smoothly to help producers get their earnings. There may be
					some small rewards for bugs found, depending on the bug.
				</p>
				<div className="bg-white p-4 rounded-md shadow-sm">
					<p className="mb-2">
						Email:{" "}
						<a href="mailto:chris@bionerg.com" className="text-primary hover:underline">
							chris@bionerg.com
						</a>
					</p>
					<p>Title: Bug Found</p>
				</div>
			</section>

			<section>
				<h2 className="text-2xl font-bold mb-6 text-primary">FAQ</h2>
				<div className="space-y-6">
					<div className="bg-gray-100 p-6 rounded-lg">
						<h3 className="font-bold text-lg mb-2 text-primary">
							Q: Why don't the Ethereums work here to buy eco assets?
						</h3>
						<p className="text-gray-700">
							A: This is on the Base network, which runs in parallel to the main
							Ethereum network and has responsibilities to it in terms of its data
							integrity. But this means that you need the currencies that are used
							on this Base network. Coinbase wallets work natively with Base and
							the currency that you purchase in is USDC so make sure that the
							currency you have on your Base network wallet.
						</p>
					</div>
					<div className="bg-gray-100 p-6 rounded-lg">
						<h3 className="font-bold text-lg mb-2 text-primary">
							Q: What do I need to know about using my wallet here?
						</h3>
						<p className="text-gray-700 mb-4">
							A: Transactions here are conducted using Base native USDC, issued by
							Circle. For more understanding:
						</p>
						<div className="space-y-2">
							<a
								href="https://base.mirror.xyz/Ouwm--AtTIVyz40He3FxI0fDAC05lOQwN6EzFMD_2UM"
								className="block text-primary hover:underline transition duration-300"
							>
								Learn about Base
							</a>
							<a
								href="https://help.coinbase.com/en/coinbase/other-topics/other/base"
								className="block text-primary hover:underline transition duration-300"
							>
								Base from Coinbase
							</a>
							<a
								href="https://www.circle.com/blog/usdc-now-available-natively-on-base"
								className="block text-primary hover:underline transition duration-300"
							>
								USDC on Base
							</a>
						</div>
					</div>
					<div className="bg-gray-100 p-6 rounded-lg">
						<h3 className="font-bold text-lg mb-2 text-primary">
							Q: What do I need to buy eco assets?
						</h3>
						<div className="text-gray-700">
							<p>A: You need two currencies:</p>
							<ol className="list-decimal list-inside mt-2">
								<li>Enough USDC to make the auction price, and</li>
								<li>A few dollars worth of Ethereums ON Base to pay for the transaction gas.</li>
							</ol>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}