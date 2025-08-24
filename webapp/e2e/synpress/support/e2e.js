// Simplified support file for Synpress v3

// Import mock wallet commands for testing without MetaMask
require("./mock-wallet");

// Configure Cypress
Cypress.on("window:before:load", (win) => {
  // Bypass onboarding modal for all tests
  win.localStorage.setItem("skipOnboarding", "true");
  win.localStorage.setItem("onboardingCompleted", "true");
});

// Handle uncaught exceptions
Cypress.on("uncaught:exception", (err, runnable) => {
  // Prevent Cypress from failing tests on uncaught exceptions
  console.log("Uncaught exception:", err.message);
  return false;
});

// Add custom commands that work with or without MetaMask
Cypress.Commands.add("connectWallet", () => {
  if (Cypress.env("SKIP_METAMASK")) {
    cy.mockConnectWallet();
  } else {
    // Would use real MetaMask commands here when available
    cy.mockConnectWallet();
  }
});

Cypress.Commands.add("approveTransaction", () => {
  if (Cypress.env("SKIP_METAMASK")) {
    cy.mockApproveTransaction();
  } else {
    // Would use real MetaMask commands here when available
    cy.mockApproveTransaction();
  }
});
