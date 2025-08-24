import type { PublicClient, WalletClient } from "viem";
import { parseEther } from "viem";
import {
  getAstaVerdeContract,
  getEcoStabilizerContract,
  getSccContract,
  isVaultAvailable,
} from "../../config/contracts";
import { SCC_PER_ASSET } from "../../config/constants";
import type { VaultLoan } from "../../features/vault/types";

export class VaultService {
  constructor(
    private publicClient: PublicClient,
    private walletClient: WalletClient | undefined,
  ) {}

  // Core vault operations
  async deposit(tokenId: bigint): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error("Wallet not connected");
    }

    if (!isVaultAvailable()) {
      throw new Error("Vault contracts not available");
    }

    // Check NFT approval first
    await this.ensureNftApproval();

    const vaultContract = getEcoStabilizerContract();
    const { request } = await this.publicClient.simulateContract({
      ...vaultContract,
      functionName: "deposit",
      args: [tokenId],
      account: this.walletClient!.account,
    });

    return this.walletClient.writeContract(request);
  }

  async withdraw(tokenId: bigint): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error("Wallet not connected");
    }

    if (!isVaultAvailable()) {
      throw new Error("Vault contracts not available");
    }

    // Check SCC approval and balance
    await this.ensureSccApproval(SCC_PER_ASSET);

    const vaultContract = getEcoStabilizerContract();
    const { request } = await this.publicClient.simulateContract({
      ...vaultContract,
      functionName: "withdraw",
      args: [tokenId],
      account: this.walletClient!.account,
    });

    return this.walletClient.writeContract(request);
  }

  async repayAndWithdraw(tokenId: bigint): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error("Wallet not connected");
    }

    if (!isVaultAvailable()) {
      throw new Error("Vault contracts not available");
    }

    // Backward-compatible alias to withdraw. Ensure SCC approval
    await this.ensureSccApproval(SCC_PER_ASSET);

    const vaultContract = getEcoStabilizerContract();
    const { request } = await this.publicClient.simulateContract({
      ...vaultContract,
      functionName: "withdraw",
      args: [tokenId],
      account: this.walletClient!.account,
    });

    return this.walletClient.writeContract(request);
  }

  // Read operations
  async getUserLoans(userAddress: string): Promise<bigint[]> {
    if (!isVaultAvailable()) {
      return [];
    }

    const vaultContract = getEcoStabilizerContract();
    const loans = await this.publicClient.readContract({
      ...vaultContract,
      functionName: "getUserLoans",
      args: [userAddress],
    });

    return (loans as bigint[]) || [];
  }

  async getTotalActiveLoans(): Promise<bigint> {
    if (!isVaultAvailable()) {
      return 0n;
    }

    const vaultContract = getEcoStabilizerContract();
    const total = await this.publicClient.readContract({
      ...vaultContract,
      functionName: "getTotalActiveLoans",
    });

    return (total as bigint) || 0n;
  }

  async getLoanStatus(tokenId: bigint): Promise<VaultLoan | null> {
    if (!isVaultAvailable()) {
      return null;
    }

    try {
      const vaultContract = getEcoStabilizerContract();
      const loanData = await this.publicClient.readContract({
        ...vaultContract,
        functionName: "loans",
        args: [tokenId],
      });

      if (!Array.isArray(loanData) || loanData.length < 2) {
        return null;
      }

      return {
        tokenId,
        borrower: loanData[0] as string,
        active: loanData[1] as boolean,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching loan status:", error);
      return null;
    }
  }

  async getSccBalance(address: string): Promise<bigint> {
    if (!isVaultAvailable()) {
      return 0n;
    }

    const sccContract = getSccContract();
    const balance = await this.publicClient.readContract({
      ...sccContract,
      functionName: "balanceOf",
      args: [address],
    });

    return (balance as bigint) || 0n;
  }

  async getSccAllowance(owner: string, spender: string): Promise<bigint> {
    if (!isVaultAvailable()) {
      return 0n;
    }

    const sccContract = getSccContract();
    const allowance = await this.publicClient.readContract({
      ...sccContract,
      functionName: "allowance",
      args: [owner, spender],
    });

    return (allowance as bigint) || 0n;
  }

  // Approval operations
  async approveNft(): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error("Wallet not connected");
    }

    const astaverdeContract = getAstaVerdeContract();
    const vaultContract = getEcoStabilizerContract();

    const { request } = await this.publicClient.simulateContract({
      ...astaverdeContract,
      functionName: "setApprovalForAll",
      args: [vaultContract.address, true],
      account: this.walletClient!.account,
    });

    return this.walletClient.writeContract(request);
  }

  async approveScc(amount: bigint = SCC_PER_ASSET): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error("Wallet not connected");
    }

    const sccContract = getSccContract();
    const vaultContract = getEcoStabilizerContract();

    const { request } = await this.publicClient.simulateContract({
      ...sccContract,
      functionName: "approve",
      args: [vaultContract.address, amount],
      account: this.walletClient!.account,
    });

    return this.walletClient.writeContract(request);
  }

  // Helper methods
  private async ensureNftApproval(): Promise<void> {
    if (!this.walletClient) return;

    const astaverdeContract = getAstaVerdeContract();
    const vaultContract = getEcoStabilizerContract();

    const isApproved = (await this.publicClient.readContract({
      ...astaverdeContract,
      functionName: "isApprovedForAll",
      args: [this.walletClient!.account!.address, vaultContract.address],
    })) as boolean;

    if (!isApproved) {
      const approveTx = await this.approveNft();
      await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
    }
  }

  private async ensureSccApproval(amount: bigint): Promise<void> {
    if (!this.walletClient) return;

    const vaultContract = getEcoStabilizerContract();
    const allowance = await this.getSccAllowance(this.walletClient!.account!.address, vaultContract.address);

    if (allowance < amount) {
      const approveTx = await this.approveScc(amount);
      await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
    }
  }

  // Check if vault is available
  static isAvailable(): boolean {
    return isVaultAvailable();
  }
}
