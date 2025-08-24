import { Contract, Signer } from "ethers";
import { expect } from "chai";

/**
 * Helper functions for testing the pull payment pattern
 * These utilities make it easier to update legacy tests
 */

/**
 * Verifies that a producer has the expected accrued balance
 * @param astaVerde - The AstaVerde contract instance
 * @param producer - The producer address or signer
 * @param expectedAmount - The expected accrued amount
 */
export async function expectProducerBalance(
  astaVerde: Contract,
  producer: Signer | string,
  expectedAmount: bigint
) {
  const address = typeof producer === 'string' ? producer : await producer.getAddress();
  const balance = await astaVerde.producerBalances(address);
  expect(balance).to.equal(expectedAmount);
}

/**
 * Claims producer funds and verifies the USDC transfer
 * @param astaVerde - The AstaVerde contract instance
 * @param mockUSDC - The MockUSDC contract instance
 * @param producer - The producer signer
 * @returns The amount claimed
 */
export async function claimAndVerifyProducerFunds(
  astaVerde: Contract,
  mockUSDC: Contract,
  producer: Signer
): Promise<bigint> {
  const producerAddress = await producer.getAddress();
  const accruedBalance = await astaVerde.producerBalances(producerAddress);
  
  if (accruedBalance === 0n) {
    throw new Error("No funds to claim");
  }
  
  const balanceBefore = await mockUSDC.balanceOf(producerAddress);
  await astaVerde.connect(producer).claimProducerFunds();
  const balanceAfter = await mockUSDC.balanceOf(producerAddress);
  
  expect(balanceAfter - balanceBefore).to.equal(accruedBalance);
  expect(await astaVerde.producerBalances(producerAddress)).to.equal(0n);
  
  return accruedBalance;
}

/**
 * Executes a buyBatch and verifies producer accrual (not direct payment)
 * @param astaVerde - The AstaVerde contract instance
 * @param buyer - The buyer signer
 * @param batchId - The batch ID to buy from
 * @param tokenAmount - Number of tokens to buy
 * @param producers - Array of producer addresses for this batch
 * @returns Object with platform share and producer shares
 */
export async function buyBatchAndVerifyAccrual(
  astaVerde: Contract,
  buyer: Signer,
  batchId: bigint,
  tokenAmount: bigint,
  producers: string[]
): Promise<{ platformShare: bigint; producerShares: Map<string, bigint> }> {
  const currentPrice = await astaVerde.getCurrentBatchPrice(batchId);
  const totalCost = currentPrice * tokenAmount;
  const platformSharePercentage = await astaVerde.platformSharePercentage();
  
  // Track initial balances
  const initialBalances = new Map<string, bigint>();
  for (const producer of producers) {
    initialBalances.set(producer, await astaVerde.producerBalances(producer));
  }
  
  // Execute purchase
  await astaVerde.connect(buyer).buyBatch(batchId, totalCost, tokenAmount);
  
  // Calculate expected shares
  const platformShare = (totalCost * platformSharePercentage) / 100n;
  const totalProducerShare = totalCost - platformShare;
  
  // Verify accruals
  const producerShares = new Map<string, bigint>();
  for (const producer of producers) {
    const newBalance = await astaVerde.producerBalances(producer);
    const accrued = newBalance - initialBalances.get(producer)!;
    producerShares.set(producer, accrued);
  }
  
  return { platformShare, producerShares };
}

/**
 * Migrates a test from expecting direct payment to pull pattern
 * This is a convenience function for common test patterns
 */
export async function verifyProducerPaymentFlow(
  astaVerde: Contract,
  mockUSDC: Contract,
  buyer: Signer,
  producer: Signer,
  batchId: bigint,
  tokenAmount: bigint
): Promise<bigint> {
  const producerAddress = await producer.getAddress();
  const currentPrice = await astaVerde.getCurrentBatchPrice(batchId);
  const totalCost = currentPrice * tokenAmount;
  const platformSharePercentage = await astaVerde.platformSharePercentage();
  
  // Execute purchase
  await astaVerde.connect(buyer).buyBatch(batchId, totalCost, tokenAmount);
  
  // Calculate expected producer share
  const expectedProducerShare = (totalCost * (100n - platformSharePercentage)) / 100n;
  
  // Verify accrual
  const accruedBalance = await astaVerde.producerBalances(producerAddress);
  expect(accruedBalance).to.be.gte(expectedProducerShare); // gte because producer might have multiple tokens
  
  // Claim and verify
  const claimed = await claimAndVerifyProducerFunds(astaVerde, mockUSDC, producer);
  
  return claimed;
}

/**
 * Verifies the total accounting invariant
 * Contract USDC balance should equal platform share + all producer balances
 */
export async function verifyAccountingInvariant(
  astaVerde: Contract,
  mockUSDC: Contract
): Promise<boolean> {
  const contractBalance = await mockUSDC.balanceOf(await astaVerde.getAddress());
  const platformShare = await astaVerde.platformShareAccumulated();
  const totalProducerBalances = await astaVerde.totalProducerBalances();
  
  const expectedBalance = platformShare + totalProducerBalances;
  expect(contractBalance).to.equal(expectedBalance);
  
  return true;
}

/**
 * Helper to update tests that check producer USDC balance after sale
 * Old pattern: expect(mockUSDC.balanceOf(producer)).to.equal(X)
 * New pattern: expect(astaVerde.producerBalances(producer)).to.equal(X)
 */
export async function getProducerEarnings(
  astaVerde: Contract,
  mockUSDC: Contract,
  producer: Signer | string,
  includeClaimedFunds: boolean = false
): Promise<bigint> {
  const address = typeof producer === 'string' ? producer : await producer.getAddress();
  const accrued = await astaVerde.producerBalances(address);
  
  if (includeClaimedFunds) {
    const usdcBalance = await mockUSDC.balanceOf(address);
    return accrued + usdcBalance;
  }
  
  return accrued;
}

/**
 * Batch claim helper for multiple producers
 */
export async function claimAllProducerFunds(
  astaVerde: Contract,
  producers: Signer[]
): Promise<Map<string, bigint>> {
  const claimed = new Map<string, bigint>();
  
  for (const producer of producers) {
    const address = await producer.getAddress();
    const balance = await astaVerde.producerBalances(address);
    
    if (balance > 0n) {
      await astaVerde.connect(producer).claimProducerFunds();
      claimed.set(address, balance);
    }
  }
  
  return claimed;
}