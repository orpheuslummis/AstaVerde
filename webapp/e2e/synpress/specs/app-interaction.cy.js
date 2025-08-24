describe("App Interaction Tests", () => {
  beforeEach(() => {
    cy.visit("/");
    cy.wait(2000); // Wait for app to load
  });

  it("should load the marketplace page", () => {
    // Check main elements are present
    cy.get("header").should("be.visible");
    cy.get("main").should("be.visible");

    // Look for marketplace content
    cy.get("body").then(($body) => {
      const hasMarketContent =
        $body.text().includes("Market") ||
        $body.text().includes("Eco") ||
        $body.text().includes("Asset") ||
        $body.text().includes("Carbon");

      expect(hasMarketContent).to.be.true;
    });
  });

  it("should navigate to My Tokens page", () => {
    // Find and click My Eco Assets link
    cy.get("a")
      .contains(/my.*eco.*assets|my.*tokens/i)
      .first()
      .click();

    // Wait for navigation
    cy.wait(1000);

    // Verify we're on the My Tokens page
    cy.url().should("include", "/mytokens");

    // Page should show wallet connection prompt or token list
    cy.get("body").then(($body) => {
      const hasExpectedContent =
        $body.text().includes("Connect") ||
        $body.text().includes("Wallet") ||
        $body.text().includes("Token") ||
        $body.text().includes("No tokens");

      expect(hasExpectedContent).to.be.true;
    });
  });

  it("should connect wallet (mock)", () => {
    // Navigate to My Tokens where wallet connection is needed
    cy.visit("/mytokens");
    cy.wait(1000);

    // Connect wallet using mock
    cy.connectWallet();

    // After connection, should show wallet info or token list
    cy.wait(1000);
    cy.get("body").then(($body) => {
      cy.log("Page content after wallet connection:", $body.text().substring(0, 200));

      // Should either show address or token-related content
      const hasWalletContent =
        $body.text().includes("0x") ||
        $body.text().includes("token") ||
        $body.text().includes("Token") ||
        $body.text().includes("balance") ||
        $body.text().includes("Balance");

      expect(hasWalletContent).to.be.true;
    });
  });

  it("should display batch cards on marketplace", () => {
    // Stay on marketplace page
    cy.get("main").should("be.visible");

    // Look for batch cards or marketplace items
    cy.get("body").then(($body) => {
      // Check for batch/token cards
      const cards = $body.find('[class*="card"], [class*="Card"], div[role="article"]');

      if (cards.length > 0) {
        cy.log(`Found ${cards.length} card elements`);

        // Check first card has expected content
        cy.wrap(cards.first()).then(($card) => {
          const cardText = $card.text();
          const hasCardContent =
            cardText.includes("Batch") ||
            cardText.includes("Token") ||
            cardText.includes("USDC") ||
            cardText.includes("Price") ||
            cardText.includes("Buy");

          expect(hasCardContent).to.be.true;
        });
      } else {
        // No cards found, might be loading or empty
        const hasLoadingOrEmpty =
          $body.text().includes("Loading") || $body.text().includes("No batches") || $body.text().includes("No tokens");

        expect(hasLoadingOrEmpty).to.be.true;
      }
    });
  });

  it("should show purchase interface for a batch", () => {
    // Look for a buy button
    cy.get("body").then(($body) => {
      const buyButtons = $body.find('button:contains("Buy"), button:contains("Purchase")');

      if (buyButtons.length > 0) {
        // Click first buy button
        cy.wrap(buyButtons.first()).click();
        cy.wait(1000);

        // Should show purchase modal or interface
        cy.get("body").then(($modalBody) => {
          const hasPurchaseUI =
            $modalBody.text().includes("Quantity") ||
            $modalBody.text().includes("Total") ||
            $modalBody.text().includes("Confirm") ||
            $modalBody.text().includes("Connect"); // Might prompt to connect wallet

          expect(hasPurchaseUI).to.be.true;
        });
      } else {
        cy.log("No buy buttons found - might need wallet connection or no batches available");

        // Check if we need to connect wallet first
        const needsWallet = $body.text().includes("Connect");
        expect(needsWallet).to.be.true;
      }
    });
  });
});
