import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying EcoStabilizer system with account:", deployer.address);

    // Check deployer balance first
    const balance = await deployer.provider.getBalance(deployer.address);
    const minimumBalance = ethers.parseEther("0.1"); // Require at least 0.1 ETH
    if (balance < minimumBalance) {
        throw new Error(`Insufficient balance: ${ethers.formatEther(balance)} ETH (minimum: 0.1 ETH required)`);
    }
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    // Get and validate AstaVerde addresses from environment or use default for local
    // AV_ADDR is the existing V1 marketplace (supports historical NFTs)
    // AV_ADDR_V11 is the hardened V1.1 marketplace for all future batches
    let astaVerdeAddress = process.env.AV_ADDR;
    let astaVerdeAddressV11 = process.env.AV_ADDR_V11;

    // For local development, use the standard deployed address
    if (!astaVerdeAddress && (await ethers.provider.getNetwork()).chainId === 31337n) {
        astaVerdeAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // Standard local AstaVerde address
        console.log("Using default local AstaVerde address:", astaVerdeAddress);
    }

    if (!astaVerdeAddress) {
        throw new Error("AV_ADDR environment variable not set");
    }
    if (!ethers.isAddress(astaVerdeAddress)) {
        throw new Error(`Invalid AV_ADDR format: ${astaVerdeAddress} (must be a valid Ethereum address)`);
    }
    if (!astaVerdeAddress.startsWith("0x")) {
        throw new Error("AV_ADDR must be a checksummed Ethereum address starting with 0x");
    }

    console.log("Using AstaVerde contract at:", astaVerdeAddress);
    console.log("Network:", (await ethers.provider.getNetwork()).name);

    // If a second address is provided, validate it as well
    if (astaVerdeAddressV11) {
        if (!ethers.isAddress(astaVerdeAddressV11)) {
            throw new Error(`Invalid AV_ADDR_V11 format: ${astaVerdeAddressV11} (must be a valid Ethereum address)`);
        }
        if (!astaVerdeAddressV11.startsWith("0x")) {
            throw new Error("AV_ADDR_V11 must be a checksummed Ethereum address starting with 0x");
        }
        console.log("Using AstaVerde V1.1 contract at:", astaVerdeAddressV11);
    }

    let scc, ecoStabilizer, ecoStabilizerV11;

    try {
        // Step 1: Deploy both contracts (SCC without vault initially)
        console.log("\n1. Deploying StabilizedCarbonCoin...");
        const SCCFactory = await ethers.getContractFactory("StabilizedCarbonCoin");
        scc = await SCCFactory.deploy(ethers.ZeroAddress); // Deploy without vault first
        await scc.waitForDeployment();
        console.log("StabilizedCarbonCoin deployed to:", await scc.getAddress());

        // Step 2: Deploy EcoStabilizer vault for V1
        console.log("\n2. Deploying EcoStabilizer vault (V1)...");
        const EcoStabilizerFactory = await ethers.getContractFactory("EcoStabilizer");
        ecoStabilizer = await EcoStabilizerFactory.deploy(astaVerdeAddress, await scc.getAddress());
        await ecoStabilizer.waitForDeployment();
        console.log("EcoStabilizer (V1) deployed to:", await ecoStabilizer.getAddress());

        // Optionally deploy a second EcoStabilizer vault for V1.1
        if (astaVerdeAddressV11) {
            console.log("\n2b. Deploying EcoStabilizer vault (V1.1)...");
            ecoStabilizerV11 = await EcoStabilizerFactory.deploy(astaVerdeAddressV11, await scc.getAddress());
            await ecoStabilizerV11.waitForDeployment();
            console.log("EcoStabilizer (V1.1) deployed to:", await ecoStabilizerV11.getAddress());
        }

        // Step 3: ATOMIC role management (critical security section)
        console.log("\n3. Configuring secure role management...");
        const MINTER_ROLE = await scc.MINTER_ROLE();
        const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();

        // Grant MINTER_ROLE to vault(s)
        console.log("Granting MINTER_ROLE to vault (V1)...");
        const grantRoleTx = await scc.grantRole(MINTER_ROLE, await ecoStabilizer.getAddress());
        await grantRoleTx.wait();
        console.log("✅ MINTER_ROLE granted to vault (V1)");

        if (ecoStabilizerV11) {
            console.log("Granting MINTER_ROLE to vault (V1.1)...");
            const grantRoleTx2 = await scc.grantRole(MINTER_ROLE, await ecoStabilizerV11.getAddress());
            await grantRoleTx2.wait();
            console.log("✅ MINTER_ROLE granted to vault (V1.1)");
        }

        // Immediately renounce admin privileges (minimize attack window)
        console.log("Renouncing deployer admin privileges...");
        const renounceAdminTx = await scc.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
        await renounceAdminTx.wait();
        console.log("✅ All deployer roles renounced - contracts are now immutable");
    } catch (error) {
        console.error("💥 DEPLOYMENT FAILED - System may be in insecure state!");
        console.error("Error details:", error);

        if (scc) {
            const MINTER_ROLE = await scc.MINTER_ROLE();
            const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();
            const deployerHasAdmin = await scc.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);

            console.error("🔍 Current security state:");
            console.error("- Deployer still has admin role:", deployerHasAdmin);

            if (deployerHasAdmin) {
                console.error("⚠️  CRITICAL: Deployer retains admin privileges - manual intervention required");
                console.error("   You may need to manually renounce roles or redeploy");
            }
        }

        throw error;
    }

    // Step 4: Configure trusted vault(s) on marketplaces (if supported)
    console.log("\n4. Configuring trusted vault(s) on marketplaces (if supported)...");
    try {
        // Configure V1.1 marketplace to trust its vault (recommended for pause safety)
        if (astaVerdeAddressV11 && ecoStabilizerV11) {
            console.log("Setting trustedVault on AstaVerde V1.1 → EcoStabilizer V1.1...");
            const av11: any = await ethers.getContractAt("AstaVerde", astaVerdeAddressV11);
            const setTx = await av11.setTrustedVault(await ecoStabilizerV11.getAddress());
            await setTx.wait();
            console.log("✅ trustedVault set on V1.1");
        }

        // Attempt to configure V1 marketplace to trust its vault (may not be supported on legacy V1)
        try {
            console.log("Attempting to set trustedVault on AstaVerde V1 → EcoStabilizer V1...");
            const av1: any = await ethers.getContractAt("AstaVerde", astaVerdeAddress);
            const setTx1 = await av1.setTrustedVault(await ecoStabilizer.getAddress());
            await setTx1.wait();
            console.log("✅ trustedVault set on V1");
        } catch (e: any) {
            console.warn("⚠️  Could not set trustedVault on V1 (likely unsupported). Continuing...");
        }
    } catch (e: any) {
        console.warn("⚠️  Skipping trustedVault configuration due to error:", e?.message || e);
    }

    // Step 5: Comprehensive verification
    console.log("\n5. Verifying deployment integrity...");

    try {
        // Check vault references
        const vaultAstaVerde = await ecoStabilizer.ecoAsset();
        const vaultSCC = await ecoStabilizer.scc();

        console.log("🔍 Contract references:");
        console.log("- Vault (V1) AstaVerde reference:", vaultAstaVerde);
        console.log("- Vault (V1) SCC reference:", vaultSCC);

        // Verify address consistency
        if (vaultAstaVerde.toLowerCase() !== astaVerdeAddress.toLowerCase()) {
            throw new Error(`Vault AstaVerde reference mismatch: ${vaultAstaVerde} != ${astaVerdeAddress}`);
        }
        if (vaultSCC.toLowerCase() !== (await scc.getAddress()).toLowerCase()) {
            throw new Error(`Vault SCC reference mismatch: ${vaultSCC} != ${await scc.getAddress()}`);
        }

        if (ecoStabilizerV11) {
            const vaultAstaVerde2 = await ecoStabilizerV11.ecoAsset();
            const vaultSCC2 = await ecoStabilizerV11.scc();
            console.log("- Vault (V1.1) AstaVerde reference:", vaultAstaVerde2);
            console.log("- Vault (V1.1) SCC reference:", vaultSCC2);
            if (vaultAstaVerde2.toLowerCase() !== (astaVerdeAddressV11 as string).toLowerCase()) {
                throw new Error(`Vault V1.1 AstaVerde reference mismatch: ${vaultAstaVerde2} != ${astaVerdeAddressV11}`);
            }
            if (vaultSCC2.toLowerCase() !== (await scc.getAddress()).toLowerCase()) {
                throw new Error(`Vault V1.1 SCC reference mismatch: ${vaultSCC2} != ${await scc.getAddress()}`);
            }
        }

        // Check SCC constants
        const sccDecimals = await scc.decimals();
        const sccName = await scc.name();
        const sccSymbol = await scc.symbol();
        const maxSupply = await scc.MAX_SUPPLY();

        console.log("🔍 SCC token configuration:");
        console.log("- Name:", sccName);
        console.log("- Symbol:", sccSymbol);
        console.log("- Decimals:", sccDecimals);
        console.log("- Max Supply:", ethers.formatEther(maxSupply), "SCC");

        // Check vault constants
        const sccPerAsset = await ecoStabilizer.SCC_PER_ASSET();
        const maxScanRange = await ecoStabilizer.maxScanRange();

        console.log("🔍 Vault configuration:");
        console.log("- SCC per asset:", ethers.formatEther(sccPerAsset));
        console.log("- Max scan range:", maxScanRange.toString());

        // Critical security verification
        const MINTER_ROLE = await scc.MINTER_ROLE();
        const DEFAULT_ADMIN_ROLE = await scc.DEFAULT_ADMIN_ROLE();

        const vaultHasMinterRole = await scc.hasRole(MINTER_ROLE, await ecoStabilizer.getAddress());
        const deployerHasAdminRole = await scc.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
        const deployerHasMinterRole = await scc.hasRole(MINTER_ROLE, deployer.address);

        console.log("🔒 Security verification:");
        console.log("- Vault (V1) has MINTER_ROLE:", vaultHasMinterRole);
        let vaultV11HasMinterRole = false;
        if (ecoStabilizerV11) {
            vaultV11HasMinterRole = await scc.hasRole(MINTER_ROLE, await ecoStabilizerV11.getAddress());
            console.log("- Vault (V1.1) has MINTER_ROLE:", vaultV11HasMinterRole);
        }
        console.log("- Deployer has DEFAULT_ADMIN_ROLE:", deployerHasAdminRole);
        console.log("- Deployer has MINTER_ROLE:", deployerHasMinterRole);

        // Verify security state (CRITICAL)
        if (!vaultHasMinterRole) {
            throw new Error("🚨 CRITICAL: Vault does not have MINTER_ROLE");
        }
        if (ecoStabilizerV11 && !vaultV11HasMinterRole) {
            throw new Error("🚨 CRITICAL: Vault (V1.1) does not have MINTER_ROLE");
        }
        if (deployerHasAdminRole) {
            throw new Error("🚨 CRITICAL: Deployer still has DEFAULT_ADMIN_ROLE");
        }
        if (deployerHasMinterRole) {
            throw new Error("🚨 CRITICAL: Deployer still has MINTER_ROLE");
        }

        console.log("✅ All security verifications passed!");
    } catch (error: any) {
        console.error("💥 VERIFICATION FAILED!");
        console.error("Error:", error.message);
        throw error;
    }

    // Step 6: Save deployment info
    console.log("\n6. Saving deployment information...");

    const network = await ethers.provider.getNetwork();
    const sccPerAsset = await ecoStabilizer.SCC_PER_ASSET();
    const sccDecimals = await scc.decimals();
    const maxSupply = await scc.MAX_SUPPLY();
    const maxScanRange = await ecoStabilizer.maxScanRange();

    const deploymentInfo = {
        network: {
            name: network.name,
            chainId: network.chainId.toString(),
        },
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        deployerBalance: ethers.formatEther(await deployer.provider.getBalance(deployer.address)),
        contracts: {
            AstaVerde: astaVerdeAddress,
            StabilizedCarbonCoin: await scc.getAddress(),
            EcoStabilizerV1: await ecoStabilizer.getAddress(),
            ...(ecoStabilizerV11
                ? { AstaVerdeV11: astaVerdeAddressV11, EcoStabilizerV11: await ecoStabilizerV11.getAddress() }
                : {}),
        },
        constants: {
            SCC_PER_ASSET: ethers.formatEther(sccPerAsset),
            SCC_DECIMALS: sccDecimals.toString(),
            MAX_SUPPLY: ethers.formatEther(maxSupply),
            MAX_SCAN_RANGE: maxScanRange.toString(),
        },
        security: {
            deployerRolesRenounced: true,
            vaultHasMinterRole: true,
            ...(ecoStabilizerV11 ? { vaultV11HasMinterRole: true } : {}),
            securityVerified: true,
            deploymentSecure: true,
        },
        gasUsed: {
            // Gas tracking would require more complex implementation
            // For now, just note that deployment was successful
            deploymentCompleted: true,
        },
    };

    // Save deployment info with error handling
    const deploymentPath = path.join(
        __dirname,
        "..",
        "deployments",
        `ecostabilizer-${deploymentInfo.network.chainId}.json`,
    );

    try {
        // Ensure deployments directory exists with proper permissions
        const deploymentsDir = path.dirname(deploymentPath);
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true, mode: 0o755 });
        }

        // Write deployment info with proper formatting
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2), { mode: 0o644 });
        console.log("✅ Deployment info saved to:", deploymentPath);
    } catch (error: unknown) {
        const msg = error && typeof error === 'object' && 'message' in error ? (error as any).message : String(error);
        console.error("⚠️  Warning: Failed to save deployment info:", msg);
        console.error("Deployment was successful, but info file could not be saved.");
    }

    console.log("\n🎉 EcoStabilizer deployment completed successfully!");
    console.log("\n📋 Deployment Summary:");
    console.log("- StabilizedCarbonCoin:", await scc.getAddress());
    console.log("- EcoStabilizer Vault (V1):", await ecoStabilizer.getAddress());
    if (ecoStabilizerV11) {
        console.log("- EcoStabilizer Vault (V1.1):", await ecoStabilizerV11.getAddress());
    }
    console.log("- Network:", deploymentInfo.network.name, `(${deploymentInfo.network.chainId})`);
    console.log("- Security State: ✅ Fully Secured (admin roles renounced)");

    console.log("\n📝 Next steps:");
    console.log("1. Verify contracts on block explorer");
    console.log("2. Run smoke tests with deployed addresses");
    console.log("3. Update frontend configuration files");
    console.log("4. Consider running additional security tests");

    return {
        scc: await scc.getAddress(),
        ecoStabilizer: await ecoStabilizer.getAddress(),
        astaVerde: astaVerdeAddress,
    };
}

// Execute deployment
if (require.main === module) {
    main()
        .then((result) => {
            console.log("\n✅ Deployment script completed successfully");
            console.log("Deployed contracts:", result);
            process.exit(0);
        })
        .catch((error: unknown) => {
            console.error("\n💥 DEPLOYMENT SCRIPT FAILED");
            if (error && typeof error === 'object' && 'message' in error) {
                console.error("❌ Error:", (error as any).message);
            } else {
                console.error("❌ Error:", error);
            }

            // Print stack if present
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((error as any)?.stack) {
                console.error("\n📍 Stack trace:");
                console.error((error as any).stack);
            }

            console.error("\n⚠️  IMPORTANT: If this was a partial deployment failure,");
            console.error("   please check the security state of any deployed contracts");
            console.error("   before attempting to redeploy or use the system.");

            process.exit(1);
        });
}

export default main;
