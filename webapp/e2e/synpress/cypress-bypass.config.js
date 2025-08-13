const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'e2e/synpress/specs/**/*.cy.{js,ts}',
    supportFile: 'e2e/synpress/support/e2e.js',
    fixturesFolder: 'e2e/synpress/fixtures',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 30000,
    requestTimeout: 30000,
    responseTimeout: 30000,
    pageLoadTimeout: 60000,
    chromeWebSecurity: false,
    
    env: {
      // Skip Synpress/MetaMask for now
      SKIP_METAMASK: true,
      // Network configuration
      NETWORK_NAME: 'localhost',
      RPC_URL: 'http://127.0.0.1:8545',
      CHAIN_ID: '31337',
      // Test wallet
      TEST_WALLET_ADDRESS: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      // Contract addresses from deployment
      ASTAVERDE_ADDRESS: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      USDC_ADDRESS: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      ECOSTABILIZER_ADDRESS: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
      SCC_ADDRESS: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    },
    
    setupNodeEvents(on, config) {
      // Basic event handlers without Synpress plugins for now
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
      });
      
      return config;
    },
  },
});