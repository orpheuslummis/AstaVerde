"use client";

import React from "react";

export function OnboardingModal() {
  const [showModal, setShowModal] = React.useState(false);

  React.useEffect(() => {
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

  return (
    true && (
      <div className="modal fixed inset-0 flex items-center justify-center z-50">
        <div className="flex flex-col modal-content border p-5 bg-white rounded shadow-lg relative max-w-xl gap-2">
          <h2 className="text-2xl mb-4">Welcome to the EcoTradeZone: Important Information Before You Enter</h2>
          <p>
            <strong>Web3 Zone Access:</strong> You're about to enter a web3 zone. This requires connecting your crypto
            wallet to participate. Make sure your wallet is ready.
          </p>
          <p>
            <strong>Tax and Legal Responsibilities:</strong> Be aware that buying and selling tokens involves local tax
            and declaration responsibilities. By entering, you accept full responsibility for complying with these
            obligations. More details are available in our Terms of Service.
          </p>
          <p>
            <strong>Transaction Currency:</strong> Transactions here are conducted using Base native USDC, issued by
            Circle. For more understanding:
            <ul>
              <li>
                Learn about Base:{" "}
                <a
                  href="https://base.mirror.xyz/Ouwm--AtTIVyz40He3FxI0fDAC05lOQwN6EzFMD_2UM"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Base Information
                </a>
              </li>
              <li>
                Base from Coinbase:{" "}
                <a
                  href="https://help.coinbase.com/en/coinbase/other-topics/other/base"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Coinbase on Base
                </a>
              </li>
              <li>
                USDC on Base:{" "}
                <a
                  href="https://www.circle.com/blog/usdc-now-available-natively-on-base"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  USDC Details
                </a>
              </li>
            </ul>
          </p>
          <p>
            <strong>Crypto Wallet Compatibility:</strong> You'll need your crypto wallet for interactions on Base.
            Coinbase wallets are automatically compatible. For other wallets, you may need to add Base manually. Learn
            more on our 'About and FAQ’s' page.
          </p>
          <p>
            <strong>Understanding EcoAssets:</strong> Before you buy, familiarize yourself with EcoAssets on our
            'Everything about EcoAssets' page. Know what you’re investing in.
          </p>
          <p>
            <strong>Non-reversible Redemption:</strong> Once you redeem an EcoAsset, it loses its intrinsic carbon
            dioxide equivalent value. This redemption will be recorded in your wallet.
          </p>
          <p>By clicking to enter the EcoTradeZone, you acknowledge that you have read and understood these terms.</p>
          <div className="flex w-full justify-end pt-4">
            <button onClick={handleConfirmation} className="bg-secondary text-white py-2 px-4 rounded">
              Confirm
            </button>
          </div>
        </div>
      </div>
    )
  );
}
