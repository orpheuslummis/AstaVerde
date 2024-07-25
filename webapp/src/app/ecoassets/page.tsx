"use client";

export default function Page() {
  return (
    <div className="bg-gray-100 min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-6 py-8 bg-white rounded-lg shadow-sm">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Welcome to Eco Assets</h1>
        <p className="text-lg mb-8 text-gray-700 leading-relaxed">
          Eco Assets are the core of our mission at EcoTradeZone. These digital assets represent the tangible environmental impact of biochar production. Each EcoAsset displays the time, date, and location of production, showcasing the efforts of our biochar producers in creating high-quality biochar and contributing to global carbon reduction.
        </p>

        <h2 className="text-2xl font-semibold mt-10 mb-4 text-gray-800">Components of an EcoAsset:</h2>
        <ul className="mb-8 text-gray-700 space-y-3">
          <li className="flex items-start">
            <span className="text-primary mr-2">•</span>
            <span><strong>Item ID:</strong> A unique identifier in the sequence of Eco Assets</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">•</span>
            <span><strong>Producer wallet:</strong> The digital address of the biochar producer</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">•</span>
            <span><strong>Audit ID:</strong> An impartial verification code from an independent auditing company</span>
          </li>
        </ul>

        <p className="mb-6 text-gray-700">
          Our audit methodology encompasses the 'additionality' of each project, the environmental sustainability of the biomass used, and the application of the biochar produced. We adhere to global standards, including the European Union's concept of additionality.
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
          </a>.
        </p>

        <p className="mb-6 text-gray-700">
          Upon verification, we create a proposal on EcoTradeZone. When an EcoAsset is purchased, a portion of the proceeds is allocated to both the producer and EcoTradeZone, ensuring a sustainable ecosystem.
        </p>

        <p className="mb-10 text-gray-700">
          The EcoAsset is created upon purchase and transferred directly to the buyer's wallet, completing the transaction.
        </p>

        <a
          href="/What.is.an.EcoAsset.pdf"
          download
          className="inline-block bg-primary text-white py-3 px-6 rounded-lg hover:bg-primary-dark transition duration-300 text-lg font-semibold"
        >
          EcoAsset Guide (PDF)
        </a>
      </div>
    </div>
  );
}