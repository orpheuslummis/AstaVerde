const { ethers } = require("hardhat");

async function main() {
    const [deployer, alice, bob] = await ethers.getSigners();

    const usdcAddress = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";
    const astaVerdeAddress = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0";

    // Use Bob's address which might match MetaMask account
    const userAddress = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199"; // Account #19 from Hardhat

    console.log("Testing with user address:", userAddress);

    // Get the MockUSDC contract instance
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = MockUSDC.attach(usdcAddress);

    // First, fund the user account
    console.log("\n1. Funding user account...");
    const fundTx = await usdc.connect(deployer).mint(userAddress, ethers.parseUnits("5000", 6));
    await fundTx.wait();

    const balance = await usdc.balanceOf(userAddress);
    console.log("User balance:", ethers.formatUnits(balance, 6), "USDC");

    // Try to reproduce the exact error
    console.log("\n2. Testing approve as if from webapp...");

    // Get a signer for the user
    const userSigner = await ethers.getImpersonatedSigner(userAddress);

    // Fund the user with ETH for gas
    await deployer.sendTransaction({
        to: userAddress,
        value: ethers.parseEther("1.0"),
    });

    try {
        // Try the approve with the user signer
        const approveTx = await usdc.connect(userSigner).approve(astaVerdeAddress, ethers.parseUnits("1000", 6));
        await approveTx.wait();
        console.log("✅ Approve successful!");

        const allowance = await usdc.allowance(userAddress, astaVerdeAddress);
        console.log("Allowance:", ethers.formatUnits(allowance, 6), "USDC");
    } catch (error) {
        console.error("❌ Approve failed:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);
        }
    }

    // Now test the raw transaction approach
    console.log("\n3. Testing with raw transaction encoding...");

    // Encode the approve function call
    const iface = new ethers.Interface(["function approve(address spender, uint256 value) returns (bool)"]);

    const data = iface.encodeFunctionData("approve", [astaVerdeAddress, ethers.parseUnits("500", 6)]);

    console.log("Encoded data:", data);

    try {
        const tx = await userSigner.sendTransaction({
            to: usdcAddress,
            data: data,
            gasLimit: 100000,
        });
        await tx.wait();
        console.log("✅ Raw transaction successful!");

        const newAllowance = await usdc.allowance(userAddress, astaVerdeAddress);
        console.log("New allowance:", ethers.formatUnits(newAllowance, 6), "USDC");
    } catch (error) {
        console.error("❌ Raw transaction failed:", error.message);
    }
}

main().catch(console.error);
