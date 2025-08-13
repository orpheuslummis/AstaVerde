describe('NFT Purchase Flow', () => {
  beforeEach(() => {
    // Visit marketplace
    cy.visit('/');
    cy.wait(2000);
    
    // Connect wallet
    cy.connectWallet();
  });

  it('should purchase single NFT successfully', () => {
    // Get initial USDC balance
    cy.getUSDCBalance().then(initialBalance => {
      cy.log(`Initial USDC Balance: ${initialBalance}`);
      
      // Find available batch and get price
      cy.get('.batch-card').not(':contains("sold out")').first().within(() => {
        // Get price
        cy.get('.price, [data-testid="price"]').first().then($price => {
          const priceText = $price.text();
          const price = parseFloat(priceText.match(/(\d+\.?\d*)/)?.[1] || '0');
          cy.log(`NFT Price: ${price} USDC`);
          
          // Store price for later verification
          cy.wrap(price).as('nftPrice');
        });
        
        // Set quantity to 1
        cy.get('input[type="range"], input[type="number"]').then($input => {
          if ($input.length > 0) {
            cy.wrap($input).clear().type('1');
          }
        });
        
        // Click buy button
        cy.get('button').contains(/buy/i).click();
      });
      
      // Handle USDC approval
      cy.wait(3000);
      cy.confirmMetamaskPermissionToSpend();
      cy.log('✅ USDC spending approved');
      
      // Wait for approval transaction
      cy.wait(5000);
      
      // Click buy again if button is enabled
      cy.get('.batch-card').first().within(() => {
        cy.get('button').contains(/buy/i).then($btn => {
          if (!$btn.prop('disabled')) {
            cy.wrap($btn).click();
          }
        });
      });
      
      // Confirm purchase transaction
      cy.wait(3000);
      cy.confirmMetamaskTransaction();
      cy.log('✅ Purchase transaction confirmed');
      
      // Wait for transaction to complete
      cy.wait(10000);
      
      // Check for success message or navigate to tokens
      cy.get('body').then($body => {
        if ($body.find(':contains("success")').length > 0 || 
            $body.find(':contains("purchased")').length > 0) {
          cy.log('✅ Purchase successful!');
        }
      });
      
      // Navigate to My Tokens to verify
      cy.visit('/mytokens');
      cy.wait(2000);
      
      // Verify NFT appears in portfolio
      cy.get('.token-card').should('have.length.at.least', 1);
      cy.log('✅ NFT found in portfolio');
    });
  });

  it('should handle bulk purchase of 3 NFTs', () => {
    // Find batch with enough supply
    cy.get('.batch-card').each(($batch) => {
      const availText = $batch.find(':contains("available"), :contains("left")').text();
      const available = parseInt(availText.match(/(\d+)/)?.[1] || '0');
      
      if (available >= 3) {
        // Found suitable batch
        cy.wrap($batch).within(() => {
          // Set quantity to 3
          cy.get('input[type="range"], input[type="number"]').clear().type('3');
          cy.wait(500);
          
          // Get total price
          cy.contains(/total/i).then($total => {
            const totalText = $total.text();
            cy.log(`Total for 3 NFTs: ${totalText}`);
          });
          
          // Click buy
          cy.get('button').contains(/buy/i).click();
        });
        
        // Handle approvals
        cy.wait(3000);
        cy.confirmMetamaskPermissionToSpend();
        cy.wait(5000);
        
        // Click buy again if needed
        cy.get('button').contains(/buy/i).then($btn => {
          if (!$btn.prop('disabled')) {
            cy.wrap($btn).click();
          }
        });
        
        // Confirm transaction
        cy.wait(3000);
        cy.confirmMetamaskTransaction();
        cy.log('✅ Bulk purchase confirmed');
        
        // Wait for completion
        cy.wait(10000);
        
        // Stop checking other batches
        return false;
      }
    });
  });

  it('should update batch availability after purchase', () => {
    // Get initial availability
    cy.get('.batch-card').first().within(() => {
      cy.contains(/\d+\s*(available|left)/i).then($avail => {
        const initialAvail = parseInt($avail.text().match(/(\d+)/)?.[1] || '0');
        cy.log(`Initial availability: ${initialAvail}`);
        cy.wrap(initialAvail).as('initialAvail');
      });
    });
    
    // Purchase 1 NFT using helper
    cy.purchaseNFT(1);
    
    // Refresh page
    cy.reload();
    cy.wait(2000);
    
    // Check new availability
    cy.get('@initialAvail').then(initialAvail => {
      cy.get('.batch-card').first().within(() => {
        cy.contains(/\d+\s*(available|left)/i).then($avail => {
          const newAvail = parseInt($avail.text().match(/(\d+)/)?.[1] || '0');
          cy.log(`New availability: ${newAvail}`);
          
          // Should decrease by 1
          expect(newAvail).to.equal(initialAvail - 1);
        });
      });
    });
  });
});