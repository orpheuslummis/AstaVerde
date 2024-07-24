"use client";

import { CurrencyDollarIcon, InformationCircleIcon, ShieldCheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from "react";

export function OnboardingModal() {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShowModal(!localStorage.getItem("onboardingCompleted"));
    }
  }, []);

  const handleConfirmation = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("onboardingCompleted", "true");
    }
    setShowModal(false);
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 bg-gradient-to-r from-primary to-primary-light text-white">
          <h2 className="text-3xl font-bold">Welcome to EcoTradeZone</h2>
          <button onClick={handleConfirmation} className="text-white hover:text-gray-200">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="space-y-8">
            <section className="text-center mb-8">
              <p className="text-xl text-gray-700">You're about to enter a revolutionary marketplace for environmental assets. Before you dive in, here's what you need to know:</p>
            </section>

            <div className="grid md:grid-cols-2 gap-8">
              <section className="flex items-start space-x-4">
                <ShieldCheckIcon className="h-8 w-8 text-primary flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-primary">Web3 Powered Security</h3>
                  <p>EcoTradeZone operates on secure blockchain technology. Connect your crypto wallet to participate and ensure the safety of your transactions.</p>
                </div>
              </section>

              <section className="flex items-start space-x-4">
                <CurrencyDollarIcon className="h-8 w-8 text-primary flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-primary">USDC Transactions</h3>
                  <p>We use Base native USDC for all transactions. Ensure your wallet is compatible and funded. <a href="#" className="text-blue-600 hover:underline">Learn more about Base and USDC</a>.</p>
                </div>
              </section>

              <section className="flex items-start space-x-4">
                <InformationCircleIcon className="h-8 w-8 text-primary flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-primary">Understanding EcoAssets</h3>
                  <p>EcoAssets represent real environmental impact. Once redeemed, they're recorded in your wallet and lose their tradable value. <a href="#" className="text-blue-600 hover:underline">Explore EcoAssets</a>.</p>
                </div>
              </section>

              <section className="flex items-start space-x-4">
                <ShieldCheckIcon className="h-8 w-8 text-primary flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-primary">Your Responsibilities</h3>
                  <p>Trading EcoAssets may have tax implications. You're responsible for complying with local regulations. <a href="#" className="text-blue-600 hover:underline">Read our Terms of Service</a>.</p>
                </div>
              </section>
            </div>

            <section className="text-center mt-8">
              <p className="text-lg text-gray-700">By entering EcoTradeZone, you acknowledge that you understand and agree to these terms.</p>
            </section>
          </div>
        </div>
        <div className="p-6 bg-gray-100 flex justify-end">
          <button
            onClick={handleConfirmation}
            className="bg-primary text-white py-3 px-8 rounded-lg text-lg font-semibold hover:bg-primary-dark transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50"
          >
            Enter EcoTradeZone
          </button>
        </div>
      </div>
    </div>
  );
}