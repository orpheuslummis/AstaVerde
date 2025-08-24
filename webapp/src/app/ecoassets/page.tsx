"use client";

export default function Page() {
  return (
    <div className="min-h-screen py-12 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-8 py-10 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <h1 className="text-4xl font-bold mb-8 text-emerald-800 dark:text-emerald-400">Eco Assets</h1>
        <p className="text-xl mb-8 text-gray-700 dark:text-gray-300 leading-relaxed">
                    Eco asset production is the core of our mission. These digital assets transform the semi-tangible
                    commodity of &apos;carbon removal&apos; into a specific, verifiable occurrence for each tonne. By gathering
                    comprehensive proofs and audits, we enable anyone to understand exactly how much carbon was
                    removed without being at the site, all encapsulated in an exchangeable and redeemable NFT.
        </p>

        <p className="mb-8 text-gray-700 dark:text-gray-300">
                    The eco asset shows a picture of the production and usage of the biochar that was audited for the
                    specific tonne of carbon removed.
        </p>

        <h2 className="text-3xl font-semibold mt-12 mb-6 text-emerald-700 dark:text-emerald-500">Components of an Eco Asset:</h2>
        <ul className="mb-10 text-gray-700 dark:text-gray-300 space-y-4">
          <li className="flex items-start">
            <span className="text-emerald-500 mr-3 text-xl">•</span>
            <span>
              <strong className="text-emerald-400">Item ID:</strong> A unique identifier in the sequence of eco assets
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">•</span>
            <span>
              <strong>Producer wallet:</strong> The digital address of the biochar producer
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">•</span>
            <span>
              <strong>Description:</strong> Contains the link to the redacted audit report image hosted on
                            the blockchain, which specific tonne from the audit that you are purchasing, the link to the
                            production usage image hosted on the blockchain, and the link to the Methodology audited
                            against.
            </span>
          </li>
        </ul>

        <p className="mb-6 text-gray-700 dark:text-gray-300">
                    Every tonne of carbon removal in eco assets has been audited for an independent auditor&apos;s opinion
                    for how many tonnes are removed in accordance with ISO 14064-3. This includes meeting the EU&apos;s
                    concept of additionality.
        </p>

        <p className="mb-6 text-gray-700 dark:text-gray-300">
                    For more information on additionality, refer to the{" "}
          <a
            href="https://www.europarl.europa.eu/RegData/etudes/note/join/2012/433785/EXPO-DEVE_NT(2012)433785_EN.pdf"
            className="text-primary hover:underline font-semibold"
            target="_blank"
            rel="noopener noreferrer"
          >
                        EU Additionality Document
          </a>
                    .
        </p>

        <p className="mb-10 text-gray-700 dark:text-gray-300">
                    Producers receive their payments directly from the buyer, and you can follow their local development
                    from this on{" "}
          <a
            href="https://www.bionerg.com/"
            className="text-primary hover:underline font-semibold"
            target="_blank"
            rel="noopener noreferrer"
          >
                        Bionerg
          </a>
                    .
        </p>

        <div className="flex flex-col space-y-6 mt-12">
          <a
            href="/Everything.about.eco.asset.pdf"
            download
            className="eco-btn eco-btn-primary dark:bg-emerald-700 dark:hover:bg-emerald-600"
          >
                        Eco Asset Guide (PDF)
          </a>
          <a
            href="https://xd.adobe.com/view/642e9fdf-2a25-4424-a4d0-d68c748a8c2b-317d/?fullscreen"
            target="_blank"
            rel="noopener noreferrer"
            className="eco-btn eco-btn-secondary dark:bg-teal-700 dark:hover:bg-teal-600"
          >
                        Explore the eco asset
          </a>
        </div>

        <h2 className="text-3xl font-semibold mt-16 mb-6 text-emerald-700 dark:text-emerald-500">FAQ</h2>
        <div className="mb-8 bg-emerald-50 dark:bg-emerald-900 p-6 rounded-lg">
          <h3 className="text-2xl font-semibold mb-4 text-emerald-800 dark:text-emerald-400">
                        How do I create a wallet and connect it?
          </h3>
          <p className="text-gray-700 dark:text-gray-300">
                        You can use many browser extensions such as Coinbase wallet, Rainbow wallet, Metamask, Kraken
                        wallet, Rabby wallet and others. To move funds from your bank to your wallet, you will use a
                        regulated exchange such as Coinbase, Kraken, or Revolut depending on your country. Once you have
                        your funds on an exchange, you can move them to your wallet to purchase eco assets.
          </p>
          <p className="text-gray-700 dark:text-gray-300 mt-2">
            <strong>Note:</strong> Different exchanges and wallets will have different or no fees to get
                        USDC on Base and Ethereum on Base.
          </p>
        </div>
      </div>
    </div>
  );
}
