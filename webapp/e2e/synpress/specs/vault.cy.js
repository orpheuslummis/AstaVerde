describe('Vault Operations', () => {
  beforeEach(() => {
    // Visit My Tokens page
    cy.visit('/mytokens');
    cy.wait(2000);
    
    // Connect wallet
    cy.connectWallet();
  });

  it('should deposit NFT to vault and receive 20 SCC', () => {
    // Check if user has eligible NFTs
    cy.get('body').then($body => {
      const hasEligibleTokens = $body.find('.token-card').not(':contains("redeemed")').not(':contains("vaulted")').length > 0;
      
      if (!hasEligibleTokens) {
        // Need to purchase an NFT first
        cy.log('No eligible NFTs, purchasing one first');
        cy.visit('/');
        cy.wait(2000);
        cy.purchaseNFT(1);
        cy.visit('/mytokens');
        cy.wait(2000);
      }
      
      // Get initial SCC balance
      cy.getSCCBalance().then(initialScc => {
        cy.log(`Initial SCC balance: ${initialScc}`);
        
        // Find eligible token and deposit
        cy.get('.token-card').not(':contains("redeemed")').not(':contains("vaulted")').first().within(() => {
          // Click deposit button
          cy.get('button').contains(/deposit|vault/i).click();
        });
        
        // Wait for MetaMask popup
        cy.wait(3000);
        
        // Approve NFT transfer (SetApprovalForAll)
        cy.confirmMetamaskPermissionToSpend();
        cy.log('✅ NFT transfer approved');
        
        // Wait for approval transaction
        cy.wait(5000);
        
        // Click deposit again if needed
        cy.get('.token-card').first().within(() => {
          cy.get('button').contains(/deposit|vault/i).then($btn => {
            if (!$btn.prop('disabled')) {
              cy.wrap($btn).click();
            }
          });
        });
        
        // Confirm deposit transaction
        cy.wait(3000);
        cy.confirmMetamaskTransaction();
        cy.log('✅ Deposit transaction confirmed');
        
        // Wait for transaction completion
        cy.wait(10000);
        
        // Refresh to see updated state
        cy.reload();
        cy.wait(2000);
        
        // Check new SCC balance
        cy.getSCCBalance().then(newScc => {
          cy.log(`New SCC balance: ${newScc}`);
          
          // Should have gained 20 SCC
          expect(newScc).to.equal(initialScc + 20);
        });
        
        // Token should show as vaulted
        cy.contains(/vaulted/i).should('be.visible');
        cy.log('✅ NFT successfully deposited, received 20 SCC');
      });
    });
  });

  it('should withdraw NFT from vault by repaying 20 SCC', () => {
    // Find vaulted token
    cy.get('body').then($body => {
      const hasVaultedTokens = $body.find('.token-card:contains("vaulted")').length > 0;
      
      if (!hasVaultedTokens) {
        cy.log('No vaulted NFTs found, skipping withdrawal test');
        return;
      }
      
      // Check SCC balance
      cy.getSCCBalance().then(sccBalance => {
        cy.log(`Current SCC balance: ${sccBalance}`);
        
        if (sccBalance < 20) {
          cy.log('Insufficient SCC for withdrawal (need 20)');
          return;
        }
        
        // Find vaulted token and withdraw
        cy.get('.token-card').contains(/vaulted/i).parent('.token-card').within(() => {
          // Click withdraw button
          cy.get('button').contains(/withdraw|repay/i).click();
        });
        
        // Wait for MetaMask popup
        cy.wait(3000);
        
        // Approve SCC spending
        cy.confirmMetamaskPermissionToSpend();
        cy.log('✅ SCC spending approved');
        
        // Wait for approval
        cy.wait(5000);
        
        // Click withdraw again if needed
        cy.get('.token-card').contains(/vaulted/i).parent('.token-card').within(() => {
          cy.get('button').contains(/withdraw|repay/i).then($btn => {
            if (!$btn.prop('disabled')) {
              cy.wrap($btn).click();
            }
          });
        });
        
        // Confirm withdrawal
        cy.wait(3000);
        cy.confirmMetamaskTransaction();
        cy.log('✅ Withdrawal confirmed');
        
        // Wait for transaction
        cy.wait(10000);
        
        // Refresh page
        cy.reload();
        cy.wait(2000);
        
        // Check SCC balance decreased by 20
        cy.getSCCBalance().then(newScc => {
          cy.log(`New SCC balance: ${newScc}`);
          expect(newScc).to.equal(sccBalance - 20);
        });
        
        // Token should no longer be vaulted
        cy.get('.token-card').first().should('not.contain', 'vaulted');
        cy.log('✅ NFT successfully withdrawn from vault');
      });
    });
  });

  it('should reject deposit of redeemed NFTs', () => {
    // Find redeemed token
    cy.get('body').then($body => {
      const hasRedeemedTokens = $body.find('.token-card:contains("redeemed")').length > 0;
      
      if (!hasRedeemedTokens) {
        cy.log('No redeemed NFTs to test');
        return;
      }
      
      // Check that deposit button is disabled for redeemed tokens
      cy.get('.token-card').contains(/redeemed/i).parent('.token-card').within(() => {
        // Deposit button should be disabled or not exist
        cy.get('button').contains(/deposit|vault/i).should($btn => {
          if ($btn.length > 0) {
            expect($btn).to.be.disabled;
            cy.log('✅ Deposit button correctly disabled for redeemed NFT');
          } else {
            cy.log('✅ No deposit button shown for redeemed NFT');
          }
        });
      });
      
      // Should show explanation
      cy.contains(/redeemed.*cannot/i).should('exist');
      cy.log('✅ Explanation shown for why redeemed NFTs cannot be deposited');
    });
  });

  it('should display correct vault statistics', () => {
    // Look for vault stats
    cy.get('body').then($body => {
      if ($body.find(':contains("vault")').filter(':contains("stats"), :contains("statistics")').length > 0) {
        // Check total vaulted
        cy.contains(/total.*vaulted/i).then($el => {
          const totalVaulted = $el.text();
          cy.log(`Total vaulted: ${totalVaulted}`);
          
          const vaultedCount = parseInt(totalVaulted.match(/(\d+)/)?.[1] || '0');
          
          // Check SCC supply
          cy.contains(/scc.*supply|circulation/i).then($supply => {
            const sccSupply = $supply.text();
            cy.log(`SCC in circulation: ${sccSupply}`);
            
            const sccAmount = parseFloat(sccSupply.match(/(\d+\.?\d*)/)?.[1] || '0');
            
            // Verify numbers make sense (20 SCC per vaulted NFT)
            if (vaultedCount > 0) {
              expect(sccAmount).to.equal(vaultedCount * 20);
              cy.log('✅ Vault statistics are consistent');
            }
          });
        });
      }
    });
  });
});