describe('Basic Test - Verify Setup', () => {
  it('should load the app', () => {
    cy.visit('/', { timeout: 30000 });
    
    // Wait for React app to load - look for the header component
    cy.get('header', { timeout: 30000 }).should('exist');
    
    // Check for app content - more flexible selectors
    cy.get('body').then(($body) => {
      // Log what we see for debugging
      cy.log('Page loaded, checking for content...');
      
      // Look for various indicators the app loaded
      const hasHeader = $body.find('header').length > 0;
      const hasMain = $body.find('main').length > 0;
      const hasContent = $body.text().includes('Eco') || 
                        $body.text().includes('Asset') || 
                        $body.text().includes('Market');
      
      expect(hasHeader || hasMain || hasContent).to.be.true;
    });
  });
});