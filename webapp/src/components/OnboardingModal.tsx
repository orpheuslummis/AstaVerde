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
    showModal && (
      <div className="modal fixed inset-0 flex items-center justify-center z-50">
        <div className="modal-content border p-5 bg-white rounded shadow-lg relative">

          return (
          showModal && (
          <div className="modal fixed inset-0 flex items-center justify-center z-50">
            <div className="modal-content border p-5 bg-white rounded shadow-lg relative">
              <h2 className="text-2xl mb-4">Welcome to EcoTradeZone!</h2>
              <p>
                Before entering, the following must be understood:
              </p>
              <ul>
                <li>
                  You are now entering a web3 zone, which means that you will need to connect your crypto wallet to participate.
                </li>
                <li>
                  Buying and selling tokens have local responsibilities in terms of tax and declaration. If you proceed into this zone, you will be fully responsible for what these are for you.
                </li>
                <li>
                  The zone you are entering handles transactions on Base native USDC issued by Circle. These links explain both of these:
                  <ul>
                    <li>
                      Base: <a href="https://base.mirror.xyz/Ouwm--AtTIVyz40He3FxI0fDAC05lOQwN6EzFMD_2UM" target="_blank" rel="noopener noreferrer">https://base.mirror.xyz/Ouwm--AtTIVyz40He3FxI0fDAC05lOQwN6EzFMD_2UM</a>
                    </li>
                    <li>
                      About Base from Coinbase: <a href="https://help.coinbase.com/en/coinbase/other-topics/other/base" target="_blank" rel="noopener noreferrer">https://help.coinbase.com/en/coinbase/other-topics/other/base</a>
                    </li>
                    <li>
                      USDC on Base: <a href="https://www.circle.com/blog/usdc-now-available-natively-on-base" target="_blank" rel="noopener noreferrer">https://www.circle.com/blog/usdc-now-available-natively-on-base</a>
                    </li>
                  </ul>
                </li>
                <li>
                  You will need your crypto wallet to interact with Base. The Coinbase wallet does this automatically. Learn how to use your crypto wallet with this Base zone: <a href="https://docs.base.org/using-base/">https://docs.base.org/using-base/</a>
                </li>
                <li>
                  Understand what these EcoAssets are on the 'Everything about EcoAssets' page.
                </li>
                <li>
                  Redemption is non-reversible. When you redeem an EcoAsset, it loses its intrinsic tonne of carbon dioxide equivalent, and your wallet is the proof of when you made this choice.
                </li>
              </ul>
              <button
                onClick={handleConfirmation}
                className="confirm-button absolute bottom-4 right-4 bg-secondary text-white py-4 px-4 rounded"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  );
}
