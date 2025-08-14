// Mock wallet commands for testing without MetaMask
// These simulate wallet interactions for development testing

Cypress.Commands.add("mockConnectWallet", () => {
    cy.log("🔗 Mock: Connecting wallet...");

    // Simulate wallet connection by setting localStorage
    const mockAccount = Cypress.env("TEST_WALLET_ADDRESS") || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    cy.window().then((win) => {
        // Mock wallet connected state
        win.localStorage.setItem("walletConnected", "true");
        win.localStorage.setItem("walletAddress", mockAccount);

        // Trigger any wallet connection events if needed
        win.dispatchEvent(
            new CustomEvent("walletConnected", {
                detail: { address: mockAccount },
            }),
        );
    });

    // Look for connect button and simulate click
    cy.get("body").then(($body) => {
        const connectBtn = $body.find('button:contains("Connect"), button:contains("connect")').first();
        if (connectBtn.length) {
            cy.wrap(connectBtn).click();
            cy.wait(1000); // Wait for UI update
        }
    });

    cy.log(`✅ Mock: Wallet connected as ${mockAccount.slice(0, 6)}...${mockAccount.slice(-4)}`);
});

Cypress.Commands.add("mockApproveTransaction", () => {
    cy.log("✅ Mock: Transaction approved");
    cy.wait(2000); // Simulate transaction time
});

Cypress.Commands.add("mockGetBalance", (token = "USDC") => {
    cy.log(`💰 Mock: Getting ${token} balance`);

    // Return mock balances
    const balances = {
        USDC: 1000,
        SCC: 100,
        ETH: 10,
    };

    return cy.wrap(balances[token] || 0);
});

Cypress.Commands.add("mockPurchaseNFT", (quantity = 1) => {
    cy.log(`🎨 Mock: Purchasing ${quantity} NFT(s)`);

    // Click purchase button
    cy.get("button")
        .contains(/buy|purchase/i)
        .first()
        .click();
    cy.wait(1000);

    // If quantity selector exists, set it
    if (quantity > 1) {
        cy.get('input[type="number"], input[type="range"]')
            .first()
            .then(($input) => {
                if ($input.length) {
                    cy.wrap($input).clear().type(quantity.toString());
                }
            });
    }

    // Confirm purchase
    cy.get("button")
        .contains(/confirm|buy/i)
        .first()
        .click();
    cy.wait(2000);

    cy.log(`✅ Mock: Purchased ${quantity} NFT(s)`);
});

// Export for use in tests
module.exports = {
    mockConnectWallet: "mockConnectWallet",
    mockApproveTransaction: "mockApproveTransaction",
    mockGetBalance: "mockGetBalance",
    mockPurchaseNFT: "mockPurchaseNFT",
};
