const { defineConfig } = require("cypress");

module.exports = defineConfig({
    e2e: {
        baseUrl: "http://localhost:3000",
        specPattern: "e2e/synpress/specs/**/*.cy.{js,ts}",
        supportFile: "e2e/synpress/support/e2e.js",
        fixturesFolder: false,
        video: false,
        screenshotOnRunFailure: false,
        // Shorter timeouts to prevent hanging
        defaultCommandTimeout: 10000,
        requestTimeout: 10000,
        responseTimeout: 10000,
        pageLoadTimeout: 30000,
        // Disable chrome security for cross-origin
        chromeWebSecurity: false,
        // Viewport
        viewportWidth: 1280,
        viewportHeight: 720,
        // Retries
        retries: {
            runMode: 0,
            openMode: 0,
        },
        // Exit on first failure to prevent hanging
        bail: true,

        env: {
            SKIP_METAMASK: true,
            NETWORK_NAME: "localhost",
            RPC_URL: "http://127.0.0.1:8545",
            CHAIN_ID: "31337",
            TEST_WALLET_ADDRESS: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        },

        setupNodeEvents(on, config) {
            // Add timeout handler
            on("task", {
                log(message) {
                    console.log(message);
                    return null;
                },
                // Force exit after timeout
                forceExit() {
                    process.exit(0);
                },
            });

            // Set test timeout
            config.taskTimeout = 60000;

            return config;
        },
    },
});
