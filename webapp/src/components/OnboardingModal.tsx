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
          <h2 className="text-2xl mb-4">Introduction to Asta Verde</h2>
          <p>Welcome to our app! This is a paragraph of random text to guide you about the apps usage.</p>
          <button
            onClick={handleConfirmation}
            className="confirm-button absolute bottom-5 right-5 bg-secondary text-white py-2 px-4 rounded"
          >
            Confirm
          </button>
        </div>
      </div>
    )
  );
}
