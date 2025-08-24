describe("Wallet Connection", () => {
  beforeEach(() => {
    // Visit the app
    cy.visit("/");
    cy.wait(2000);
  });

  it("should connect MetaMask wallet successfully", () => {
    // Connect wallet using custom command
    cy.connectWallet();

    // Verify wallet address is displayed
    cy.get("button")
      .contains(/0x[a-fA-F0-9]{4}/i)
      .should("be.visible");

    // Log success
    cy.log("✅ Wallet connected successfully");
  });

  it("should display USDC balance after connection", () => {
    // Connect wallet
    cy.connectWallet();

    // Check for USDC balance display
    cy.contains(/\d+(\.\d+)?\s*USDC/i).should("be.visible");

    // Get and log balance
    cy.getUSDCBalance().then((balance) => {
      cy.log(`USDC Balance: ${balance}`);
      expect(balance).to.be.at.least(0);
    });
  });

  it("should persist connection on page refresh", () => {
    // Connect wallet
    cy.connectWallet();

    // Get wallet address
    cy.get("button")
      .contains(/0x[a-fA-F0-9]{4}/i)
      .then(($btn) => {
        const address = $btn.text();

        // Refresh page
        cy.reload();
        cy.wait(2000);

        // Verify wallet is still connected
        cy.get("button").contains(address).should("be.visible");
      });
  });

  it("should navigate to My Eco Assets page when connected", () => {
    // Connect wallet
    cy.connectWallet();

    // Navigate to My Eco Assets
    cy.get('a[href="/mytokens"]').click();

    // Verify we're on the correct page
    cy.url().should("include", "/mytokens");

    // Check for page content
    cy.contains(/my eco assets|my tokens/i).should("be.visible");
  });
});
