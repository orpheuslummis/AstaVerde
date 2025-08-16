"use client";

import { CurrencyDollarIcon, InformationCircleIcon, ShieldCheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from "react";

export function OnboardingModal() {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Skip modal in test environments
    const isTestEnvironment = 
      typeof window !== "undefined" && (
        window.Cypress || 
        (window as unknown as { __PLAYWRIGHT__?: boolean }).__PLAYWRIGHT__ || // Add Playwright detection
        process.env.NODE_ENV === 'test' ||
        localStorage.getItem("e2e-testing") === "true" ||
        localStorage.getItem("skipOnboarding") === "true"
      );
    
    if (isTestEnvironment) {
      setShowModal(false);
    } else {
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
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4"
      data-fixed-overlay="true"
      suppressHydrationWarning
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 bg-gradient-to-r from-emerald-600 to-teal-500 text-white">
          <h2 className="text-3xl font-bold">Welcome to AstaVerde</h2>
          <button onClick={handleConfirmation} className="text-white hover:text-gray-200 transition-colors">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="space-y-8">
            <section className="text-center mb-8">
              <p className="text-xl text-gray-700 dark:text-gray-300">You&apos;re about to enter a revolutionary marketplace for environmental assets. Before you dive in, here&apos;s what you need to know:</p>
            </section>

            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  icon: <ShieldCheckIcon className="h-8 w-8 text-emerald-500 flex-shrink-0" />,
                  title: "Web3 Powered Security",
                  description: "AstaVerde operates on secure blockchain technology. Connect your crypto wallet to participate and ensure the safety of your transactions."
                },
                {
                  icon: <CurrencyDollarIcon className="h-8 w-8 text-emerald-500 flex-shrink-0" />,
                  title: "USDC Transactions",
                  description: "We use Base native USDC for all transactions. Ensure your wallet is compatible and funded.",
                  link: { text: "Learn more about Base and USDC", href: "#" }
                },
                {
                  icon: <InformationCircleIcon className="h-8 w-8 text-emerald-500 flex-shrink-0" />,
                  title: "Understanding Eco Assets",
                  description: "Eco Assets represent real environmental impact. Once redeemed, they're recorded in your wallet and lose their tradable value.",
                  link: { text: "Explore Eco Assets", href: "#" }
                },
                {
                  icon: <ShieldCheckIcon className="h-8 w-8 text-emerald-500 flex-shrink-0" />,
                  title: "Your Responsibilities",
                  description: "Trading Eco Assets may have tax implications. You're responsible for complying with local regulations.",
                  link: { text: "Read our Terms of Service", href: "#" }
                }
              ].map((item, index) => (
                <section key={index} className="flex items-start space-x-4 bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow-md">
                  {item.icon}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-emerald-600 dark:text-emerald-400">{item.title}</h3>
                    <p className="text-gray-600 dark:text-gray-300">{item.description}</p>
                    {item.link && (
                      <a href={item.link.href} className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 mt-2 inline-block">
                        {item.link.text}
                      </a>
                    )}
                  </div>
                </section>
              ))}
            </div>

            <section className="text-center mt-8">
              <p className="text-lg text-gray-700 dark:text-gray-300">By entering AstaVerde, you acknowledge that you understand and agree to these terms.</p>
            </section>
          </div>
        </div>
        <div className="p-6 bg-gray-100 dark:bg-gray-700 flex justify-end">
          <button
            onClick={handleConfirmation}
            className="bg-emerald-600 text-white py-3 px-8 rounded-lg text-lg font-semibold hover:bg-emerald-700 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-50"
          >
            Enter AstaVerde
          </button>
        </div>
      </div>
    </div>
  );
}