const hre = require("hardhat");

async function main() {
  console.log("Checking deployed contracts...\n");

  // Expected addresses from .env.local
  const addresses = {
    AstaVerde: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    USDC: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    EcoStabilizer: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    SCC: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
  };

  for (const [name, address] of Object.entries(addresses)) {
    const code = await hre.ethers.provider.getCode(address);
    if (code === "0x") {
      console.log(`❌ ${name}: No contract at ${address}`);
    } else {
      console.log(`✅ ${name}: Contract deployed at ${address} (${code.length} bytes)`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });