import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("show-balance", "Shows the balance of an account")
    .addParam("account", "The account's address")
    .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
        const balance = await hre.ethers.provider.getBalance(taskArgs.account);

        console.log(`Balance of ${taskArgs.account}: ${hre.ethers.formatEther(balance)} ETH`);
    });