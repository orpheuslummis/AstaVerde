const hre = require("hardhat");

async function main() {
    const [owner] = await hre.ethers.getSigners();
    console.log("Using owner account:", owner.address);

    const astaVerdeAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const AstaVerde = await hre.ethers.getContractAt("AstaVerde", astaVerdeAddress);

    // Check if paused
    const isPaused = await AstaVerde.paused();
    console.log("Contract paused?", isPaused);

    if (isPaused) {
        console.log("Unpausing contract...");
        const tx = await AstaVerde.unpause();
        await tx.wait();
        console.log("✅ Contract unpaused successfully!");
    } else {
        console.log("✅ Contract is already unpaused");
    }

    // Verify
    const isPausedAfter = await AstaVerde.paused();
    console.log("Contract paused status after:", isPausedAfter);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
