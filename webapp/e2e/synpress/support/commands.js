// Custom Cypress commands for AstaVerde tests

/**
 * Connect wallet to the dapp
 */
Cypress.Commands.add('connectWallet', () => {
  // Click connect button
  cy.get('button').contains(/connect/i).first().click();
  
  // If modal appears, select MetaMask
  cy.get('body').then($body => {
    if ($body.find('text=/metamask/i').length > 0) {
      cy.contains(/metamask/i).click();
    }
  });
  
  // Accept MetaMask connection
  cy.acceptMetamaskAccess();
  
  // Wait for connection to complete
  cy.wait(2000);
  
  // Verify wallet is connected
  cy.get('button').contains(/0x[a-fA-F0-9]{4}/i).should('be.visible');
});

/**
 * Get USDC balance from UI
 */
Cypress.Commands.add('getUSDCBalance', () => {
  return cy.get('body').then($body => {
    const balanceText = $body.find(':contains("USDC")').text();
    const match = balanceText.match(/(\d+\.?\d*)\s*USDC/);
    return match ? parseFloat(match[1]) : 0;
  });
});

/**
 * Get SCC balance from UI
 */
Cypress.Commands.add('getSCCBalance', () => {
  return cy.get('body').then($body => {
    const balanceText = $body.find(':contains("SCC")').text();
    const match = balanceText.match(/(\d+\.?\d*)\s*SCC/);
    return match ? parseFloat(match[1]) : 0;
  });
});

/**
 * Purchase NFT
 */
Cypress.Commands.add('purchaseNFT', (quantity = 1) => {
  // Find available batch
  cy.get('.batch-card').not(':contains("sold out")').first().within(() => {
    // Set quantity if input exists
    cy.get('input[type="range"], input[type="number"]').then($input => {
      if ($input.length > 0) {
        cy.wrap($input).clear().type(quantity.toString());
      }
    });
    
    // Click buy button
    cy.get('button').contains(/buy/i).click();
  });
  
  // Handle USDC approval if needed
  cy.wait(2000);
  cy.confirmMetamaskPermissionToSpend();
  
  // Wait for approval transaction
  cy.wait(5000);
  
  // Click buy again if needed
  cy.get('button').contains(/buy/i).then($btn => {
    if (!$btn.prop('disabled')) {
      cy.wrap($btn).click();
    }
  });
  
  // Confirm purchase transaction
  cy.wait(2000);
  cy.confirmMetamaskTransaction();
  
  // Wait for transaction completion
  cy.wait(10000);
});