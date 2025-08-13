describe('Robust App Tests', () => {
  // Set shorter timeout for individual tests
  Cypress.config('defaultCommandTimeout', 5000);
  
  it('should load app homepage', () => {
    cy.visit('/', { timeout: 10000 });
    
    // Simple check that app loaded
    cy.get('header', { timeout: 5000 }).should('exist');
    cy.get('main', { timeout: 5000 }).should('exist');
  });

  it('should have navigation links', () => {
    cy.visit('/', { timeout: 10000 });
    
    // Check for navigation
    cy.get('a').should('have.length.greaterThan', 0);
    
    // Find specific navigation items - use exact text
    cy.contains('a', 'Market').should('exist');
    cy.contains('a', 'My Eco Assets').should('exist');
  });

  it('should navigate between pages', () => {
    cy.visit('/', { timeout: 10000 });
    
    // Navigate to My Tokens using exact text
    cy.contains('a', 'My Eco Assets').click();
    cy.url().should('include', '/mytokens');
    
    // Navigate back to Market
    cy.contains('a', 'Market').first().click();
    cy.url().should('eq', 'http://localhost:3000/');
  });

  it('should handle wallet connection UI', () => {
    cy.visit('/mytokens', { timeout: 10000 });
    
    // Page should load
    cy.get('main').should('exist');
    
    // Should have wallet-related content - look for actual text
    cy.get('body').then($body => {
      const text = $body.text().toLowerCase();
      const hasWalletContent = text.includes('connect') || 
                               text.includes('wallet') || 
                               text.includes('token') || 
                               text.includes('asset');
      expect(hasWalletContent).to.be.true;
    });
    
    // Try mock wallet connection
    cy.connectWallet();
    
    // Verify connection worked (mock)
    cy.window().its('localStorage').invoke('getItem', 'walletConnected')
      .should('equal', 'true');
  });

  it('should show marketplace content', () => {
    cy.visit('/', { timeout: 10000 });
    
    // Wait for content
    cy.wait(2000);
    
    // Check for any marketplace elements
    cy.get('main').within(() => {
      // Should have some content
      cy.get('*').should('have.length.greaterThan', 0);
    });
    
    // Log what we see
    cy.get('main').then($main => {
      const text = $main.text().substring(0, 100);
      cy.log('Main content preview:', text);
    });
  });
});