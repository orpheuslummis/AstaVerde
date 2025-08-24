const { defineConfig } = require("cypress");
const synpressPlugins = require("@synthetixio/synpress/plugins");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    specPattern: "e2e/synpress/specs/**/*.cy.{js,ts}",
    supportFile: "e2e/synpress/support/e2e.js",
    fixturesFolder: "e2e/synpress/fixtures",
    video: false,
    screenshotOnRunFailure: false,
    defaultCommandTimeout: 30000,
    requestTimeout: 30000,
    responseTimeout: 30000,

    setupNodeEvents(on, config) {
      // Synpress plugins for MetaMask integration
      synpressPlugins(on, config);

      // Set up environment variables for Synpress
      config.env = {
        ...config.env,
        // Network configuration
        NETWORK_NAME: "localhost",
        RPC_URL: "http://127.0.0.1:8545",
        CHAIN_ID: "31337",
        SYMBOL: "ETH",

        // Test wallet configuration (Hardhat default account #0)
        PRIVATE_KEY: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        SECRET_WORDS: "test test test test test test test test test test test junk",
        PASSWORD: "TestPassword123!",

        // Contract addresses
        ASTAVERDE_ADDRESS: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        USDC_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        ECOSTABILIZER_ADDRESS: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
        SCC_ADDRESS: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      };

      return config;
    },
  },
});
