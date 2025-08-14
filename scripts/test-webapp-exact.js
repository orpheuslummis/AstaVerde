const { ethers } = require("hardhat");

async function main() {
    const usdcAddress = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";
    const astaVerdeAddress = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0";

    console.log("=== Testing Webapp Exact Scenario ===\n");

    // Get the deployed MockUSDC contract
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = MockUSDC.attach(usdcAddress);

    // Check contract state (owner() might not exist or might be different in OpenZeppelin v5)
    console.log("1. Checking contract state:");
    try {
        // Try to get contract info
        const name = await usdc.name();
        const symbol = await usdc.symbol();
        const decimals = await usdc.decimals();
        console.log("   Token name:", name);
        console.log("   Token symbol:", symbol);
        console.log("   Token decimals:", decimals);
    } catch (e) {
        console.log("   Error getting token info:", e.message);
    }

    // Get contract code to verify deployment
    const code = await ethers.provider.getCode(usdcAddress);
    console.log("   Contract code length:", code.length);
    console.log("   Contract deployed:", code.length > 2);

    // Test with different accounts
    const signers = await ethers.getSigners();
    const testAddresses = [
        signers[0].address, // Deployer
        signers[1].address, // Alice
        signers[19].address, // Account #19 (often used by MetaMask)
    ];

    console.log("\n2. Testing approve with different accounts:");

    for (let i = 0; i < testAddresses.length; i++) {
        const address = testAddresses[i];
        const signer = signers[i === 0 ? 0 : i === 1 ? 1 : 19];

        console.log(`\n   Testing account ${i}: ${address}`);

        // Check balance
        const balance = await usdc.balanceOf(address);
        console.log(`   Balance: ${ethers.formatUnits(balance, 6)} USDC`);

        // If no balance, mint some
        if (balance === 0n) {
            console.log("   Minting 1000 USDC...");
            const mintTx = await usdc.connect(signers[0]).mint(address, ethers.parseUnits("1000", 6));
            await mintTx.wait();
        }

        // Try approve
        try {
            console.log("   Attempting approve...");
            const approveTx = await usdc.connect(signer).approve(astaVerdeAddress, ethers.parseUnits("100", 6));
            await approveTx.wait();
            console.log("   ✅ Approve successful!");

            const allowance = await usdc.allowance(address, astaVerdeAddress);
            console.log(`   Allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
        } catch (error) {
            console.log("   ❌ Approve failed:", error.message);
            if (error.data) {
                console.log("   Error data:", error.data);
            }
        }
    }

    // Test the exact encoding the webapp would use
    console.log("\n3. Testing exact webapp encoding:");

    // This is what viem would generate
    const iface = new ethers.Interface(["function approve(address spender, uint256 value) returns (bool)"]);

    const encodedData = iface.encodeFunctionData("approve", [astaVerdeAddress, ethers.parseUnits("100", 6)]);

    console.log("   Encoded function data:", encodedData);
    console.log("   Expected: 0x095ea7b3 + padded address + padded amount");

    // Decode to verify
    const decoded = iface.decodeFunctionData("approve", encodedData);
    console.log("   Decoded spender:", decoded[0]);
    console.log("   Decoded amount:", decoded[1].toString());

    // Test a direct call with this encoding
    const testSigner = signers[19];
    console.log("\n4. Testing direct transaction with encoded data:");
    console.log("   From:", testSigner.address);

    try {
        const tx = await testSigner.sendTransaction({
            to: usdcAddress,
            data: encodedData,
            gasLimit: 100000,
        });
        const receipt = await tx.wait();
        console.log("   ✅ Transaction successful!");
        console.log("   Gas used:", receipt.gasUsed.toString());
    } catch (error) {
        console.log("   ❌ Transaction failed:", error.message);
    }

    // Check if there's any access control issue
    console.log("\n5. Checking for access control issues:");

    // Try to call as non-owner (should work for approve)
    const nonOwner = signers[10];
    console.log("   Non-owner address:", nonOwner.address);

    // Mint some tokens for testing
    await usdc.connect(signers[0]).mint(nonOwner.address, ethers.parseUnits("100", 6));

    try {
        const tx = await usdc.connect(nonOwner).approve(astaVerdeAddress, ethers.parseUnits("50", 6));
        await tx.wait();
        console.log("   ✅ Non-owner can approve (as expected for ERC20)");
    } catch (error) {
        console.log("   ❌ Non-owner cannot approve:", error.message);
    }
}

main().catch(console.error);
