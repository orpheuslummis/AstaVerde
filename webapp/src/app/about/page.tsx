"use client";

export default function Page() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 bg-white dark:bg-gray-800">
      <section className="mb-12">
        <h1 className="text-4xl font-bold mb-6 text-primary dark:text-primary-dark">EcoTradeZone</h1>
        <p className="text-lg leading-relaxed mb-6 text-gray-700 dark:text-gray-300">
                    EcoTradeZone revolutionizes the way biochar production is valued and traded. It stands as a unique
                    marketplace where the diligent work of biochar producers is transformed into tangible tokens, each
                    representing their creation. These tokens are not just symbolic; they embody the genuine
                    environmental impact of the producers&apos; efforts, quantified as one tonne of carbon dioxide
                    equivalent. At EcoTradeZone, these tokens can be both purchased and redeemed, offering a direct and
                    meaningful way to participate in climate action. This system not only incentivizes biochar
                    production but also connects the efforts of producers with individuals and organizations eager to
                    contribute to global carbon reduction. By making each token a claimable representation of a
                    real-world environmental benefit, EcoTradeZone fosters a new, eco-conscious economy where
                    sustainable practices are both recognized and rewarded.
        </p>
        <a
          href="/Everything.about.eco.asset.pdf"
          className="inline-block bg-primary text-white py-2 px-4 rounded hover:bg-primary-dark transition duration-300 dark:bg-primary-dark dark:hover:bg-primary"
        >
                    Read Everything about Eco Assets before buying
        </a>
      </section>

      <section className="mb-12 bg-gray-100 dark:bg-gray-700 p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-4 text-primary dark:text-primary-dark">Bug Report</h2>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
                    Please tell us about any bugs you find, we want to keep this place running smoothly to help
                    producers get their earnings. There may be some small rewards for bugs found, depending on the bug.
        </p>
        <div className="bg-white dark:bg-gray-600 p-4 rounded-md shadow-sm">
          <p className="mb-2 dark:text-gray-300">
                        Email:{" "}
            <a href="mailto:chris@bionerg.com" className="text-primary dark:text-primary-dark hover:underline">
                            chris@bionerg.com
            </a>
          </p>
          <p className="dark:text-gray-300">Title: Bug Found</p>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6 text-primary dark:text-primary-dark">FAQ</h2>
        <div className="space-y-6">
          <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-lg">
            <h3 className="font-bold text-lg mb-2 text-primary dark:text-primary-dark">
                            Q: Why don&apos;t the Ethereums work here to buy eco assets?
            </h3>
            <p className="text-gray-700 dark:text-gray-300">
                            A: This is on the Arbitrum network, which runs in parallel to the main Ethereum network and has
                            responsibilities to it in terms of its data integrity. But this means that you need the
                            currencies that are used on this Arbitrum network. Rainbow, Rabby, Coinbase wallets work
                            natively with Arbitrum and the currency that you purchase in is USDC so make sure that the
                            currency you have on your Arbitrum network wallet.
            </p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-lg">
            <h3 className="font-bold text-lg mb-2 text-primary dark:text-primary-dark">
                            Q: What do I need to know about using my wallet here?
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
                            A: Transactions here are conducted using Arbitrum native USDC, issued by Circle. For more
                            understanding:
            </p>
            <div className="space-y-2">
              <a
                href="https://arbitrum.io/"
                className="block text-primary hover:underline transition duration-300"
              >
                                Learn about Arbitrum
              </a>
              <a
                href="https://docs.arbitrum.io/arbitrum-bridge/usdc-arbitrum-one"
                className="block text-primary hover:underline transition duration-300"
              >
                                USDC on Arbitrum
              </a>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mt-3">
              We require native USDC (Circle): <span className="font-mono text-sm">0xaf88...e5831</span> on Arbitrum One and
              <span className="font-mono text-sm"> 0x75fa...AA4d</span> on Arbitrum Sepolia. Bridged USDC.e (
              <span className="font-mono text-sm">0xff97...5CC8</span>) will not work for purchases.
            </p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-lg">
            <h3 className="font-bold text-lg mb-2 text-primary dark:text-primary-dark">Q: What do I need to buy eco assets?</h3>
            <div className="text-gray-700 dark:text-gray-300">
              <p>A: You need two currencies:</p>
              <ol className="list-decimal list-inside mt-2">
                <li>Enough USDC to make the auction price, and</li>
                <li>A few dollars worth of Ethereums ON Arbitrum to pay for the transaction gas.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
