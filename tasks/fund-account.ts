import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

task("fund-account", "Funds an account with 100 ETH")
    .addParam("account", "The account's address")
    .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
        const amount = hre.ethers.parseEther("100");

        await hre.network.provider.send("hardhat_setBalance", [taskArgs.account, hre.ethers.toQuantity(amount)]);

        console.log(`Funded ${taskArgs.account} with 100 ETH`);
    });
