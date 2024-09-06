"use client";

export default function Page() {
    return (
        <div className="bg-gray-100 min-h-screen py-8">
            <div className="max-w-4xl mx-auto px-6 py-8 bg-white rounded-lg shadow-sm">
                <h1 className="text-3xl font-bold mb-6 text-gray-800">Eco Assets</h1>
                <p className="text-lg mb-8 text-gray-700 leading-relaxed">
                    Eco asset production is the core of our mission. These digital assets make the semi-tangible
                    commodity of 'carbon removal' into a single occurrence for a specific tonne. They do this by
                    gathering all of the proofs and audits that someone would need to know exactly how much carbon was
                    removed without being at the site, and then putting them in an NFT together to be exchanged and
                    redeemed.
                </p>

                <p className="mb-8 text-gray-700">
                    The eco asset shows a picture of the production and usage of the biochar that was audited for the
                    specific tonne of carbon removed.
                </p>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-gray-800">Components of an Eco Asset:</h2>
                <ul className="mb-8 text-gray-700 space-y-3">
                    <li className="flex items-start">
                        <span className="text-primary mr-2">•</span>
                        <span>
                            <strong>Item ID:</strong> A unique identifier in the sequence of eco assets
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

                <p className="mb-6 text-gray-700">
                    Every tonne of carbon removal in eco assets has been audited for an independent auditor's opinion
                    for how many tonnes are removed in accordance with ISO 14064-3. This includes meeting the EU's
                    concept of additionality.
                </p>

                <p className="mb-6 text-gray-700">
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

                <p className="mb-10 text-gray-700">
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

                <div className="flex flex-col space-y-4 mt-8">
                    <a
                        href="/Everything.about.eco.asset.pdf"
                        download
                        className="inline-block bg-emerald-600 text-white py-4 px-8 rounded-lg hover:bg-emerald-700 transition duration-300 text-lg font-semibold text-center shadow-md hover:shadow-lg"
                    >
                        Eco Asset Guide (PDF)
                    </a>
                    <a
                        href="https://xd.adobe.com/view/642e9fdf-2a25-4424-a4d0-d68c748a8c2b-317d/?fullscreen"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-blue-600 text-white py-4 px-8 rounded-lg hover:bg-blue-700 transition duration-300 text-lg font-semibold text-center shadow-md hover:shadow-lg"
                    >
                        Explore the eco asset
                    </a>
                </div>

                <h2 className="text-2xl font-semibold mt-10 mb-4 text-gray-800">FAQ</h2>
                <div className="mb-8">
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">
                        How do I create a wallet and connect it?
                    </h3>
                    <p className="text-gray-700">
                        You can use many browser extensions such as Coinbase wallet, Rainbow wallet, Metamask, Kraken
                        wallet, Rabby wallet and others. To move funds from your bank to your wallet, you will use a
                        regulated exchange such as Coinbase, Kraken, or Revolut depending on your country. Once you have
                        your funds on an exchange, you can move them to your wallet to purchase eco assets.
                    </p>
                    <p className="text-gray-700 mt-2">
                        <strong>Note:</strong> Different exchanges and wallets will have different or no fees to get
                        USDC on Base and Ethereum on Base.
                    </p>
                </div>
            </div>
        </div>
    );
}
