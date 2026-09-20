# AstaVerde V2 - Comprehensive QA Testing Plan

**Version:** 2.0.0  
**Last Updated:** 2025-08-31  
**Contracts:** AstaVerde.sol, EcoStabilizer.sol, StabilizedCarbonCoin.sol

This comprehensive testing plan covers both the Phase 1 marketplace and Phase 2 EcoStabilizer vault system for the Ethereum Sepolia testnet deployment.

Notes:

- Local QA runs the webapp via `npm run dev:sepolia` (port 3002).
- Webapp configuration uses a single untracked `webapp/.env.local` (copy from `webapp/.env.local.example`).

## Critical user flows (webapp)

These flows test the most important contract interactions via the webapp UI:

### Flow 1: Complete NFT Lifecycle

**Path**: Home → Purchase → My Tokens → Vault → Withdraw

1. **Purchase**: Home page → Click batch → Buy NFT → Confirm in MetaMask
2. **View**: My Tokens page → Verify NFT appears with correct metadata
3. **Deposit**: Click "Deposit to Vault" → Approve → Deposit → Verify +20 SCC
4. **Withdraw**: Click "Withdraw" → Approve SCC → Withdraw → Verify -20 SCC
5. **Verify**: NFT back in wallet, all status updates correct

### Flow 2: Redemption protection

**Path**: My Tokens → Redeem → Attempt Vault

1. **Own NFT**: Have unredeemed NFT in My Tokens
2. **Redeem**: Click "Redeem" button → Confirm transaction
3. **Verify Badge**: NFT shows "Redeemed" status
4. **No Vault**: Confirm NO "Deposit to Vault" button appears
5. **Contract check**: Direct contract call should revert with "redeemed asset"

### Flow 3: Bulk vault operations

**Path**: My Tokens → Select Multiple → Bulk Actions

1. **Own Multiple**: Have 5+ unredeemed NFTs from same batch
2. **Bulk Deposit**: Click "Deposit All" on batch group
3. **Verify SCC**: Balance increases by (count × 20)
4. **Withdraw**: Use the single-token "Withdraw" button on each vaulted NFT (no bulk withdraw UI)
5. Optional: Test contract-level `withdrawBatch(tokenIds)` via explorer or script

### Flow 4: Producer Revenue Claim

**Path**: Producer Page → View Balance → Claim

1. **Login as Producer**: Use producer wallet account
2. **Navigate**: Go to `/producer` page
3. **Check Balance**: View accumulated producer balance
4. **Claim Funds**: Click "Claim" → Confirm transaction
5. **Verify**: USDC transferred to wallet

### Flow 5: Admin Price Management

**Path**: Admin → Pricing → Adjust Parameters

1. **Login as Admin**: Use admin/owner account
2. **View Current**: Check current base price, floor, thresholds
3. **Adjust Base**: Change base price within bounds (40-200)
4. **Monitor Events**: Check for BasePriceAdjusted event
5. **Verify Home**: New batches reflect updated base price

### Flow 6: Emergency pause operations

**Path**: Admin → Status → Pause Controls

1. **Login as Admin**: Must be contract owner
2. **Check Status**: View paused state for AstaVerde
3. **Pause Marketplace**: Click pause button for AstaVerde contract
4. **Verify**: No purchases allowed, existing NFTs still visible
5. **Pause Vault**: Use Etherscan (or a script) to call `pause()` on `EcoStabilizer` (no current UI control)
6. **Verify**: No deposits/withdrawals, but SCC transfers still work
7. **Unpause**: Resume operations (unpause marketplace in UI; unpause vault via explorer) and verify functionality restored

### Flow 7: Batch Redemption

**Path**: My Tokens → Select Multiple → Redeem Selected

1. **Own Multiple**: Have 10+ unredeemed NFTs
2. **Select Tokens**: Use checkboxes to select multiple NFTs
3. **Click Redeem**: "Redeem Selected" button with count
4. **Progress Bar**: Shows "Redeeming X of Y..."
5. **Batch Processing**: Automatic batching if >50 tokens
6. **Verify**: All selected tokens show "Redeemed" badge
7. **Vault Check**: Redeemed tokens have no deposit option

### Flow 8: USDC Surplus Recovery

**Path**: Admin → Gas Optimization → Recover Surplus

1. **Check Surplus**: View estimated recoverable amount
2. **Enter Address**: Input recipient address for recovery
3. **Verify Amount**: Surplus = contract balance - accounted balance
4. **Execute Recovery**: Click "Recover Surplus USDC"
5. **Check History**: View recent recovery events
6. **Verify Transfer**: USDC sent to specified address

### Flow 9: Gas Optimization Controls

**Path**: Admin → Gas Optimization → Iteration Limits

1. **View Current**: Check maxPriceUpdateIterations value
2. **Monitor Warnings**: Check for iteration limit warnings
3. **Adjust Limit**: Set between 50-100 based on gas needs
4. **Test Purchase**: Buy after many days to trigger updates
5. **Check Events**: Verify PriceUpdateIterationLimitReached
6. **Balance Trade-offs**: Lower = less gas, delayed price updates

### Flow 10: NFT Mint and Distribution

**Path**: Admin → Mint → Create New Batch

1. **Prepare Data**: List of producer addresses and CIDs
2. **Navigate to Mint**: Admin page → Mint tab
3. **Enter Producers**: Add up to 50 producer addresses
4. **Enter CIDs**: Add corresponding IPFS content hashes
5. **Execute Mint**: Click "Mint Batch" → Confirm gas
6. **Verify Creation**: New batch appears on Home page
7. **Check Metadata**: Token details show correct producer/CID

### Flow 11: Failed Transaction Recovery

**Path**: Any transaction → Error → Retry

1. **Insufficient Gas**: Transaction fails due to low gas
2. **Error Display**: Clear message with reason
3. **Adjust Gas**: Increase gas limit/price in MetaMask
4. **Retry Action**: Button remains enabled for retry
5. **Network Issues**: Handle RPC timeouts gracefully
6. **State Recovery**: UI state consistent after failure

### Flow 12: Cross-Wallet NFT Transfer

**Path**: External Wallet → Transfer → My Tokens Update

1. **Own NFT**: Have NFT in Wallet A
2. **Transfer**: Send NFT to Wallet B (via MetaMask/Etherscan)
3. **Switch Wallet**: Connect Wallet B to webapp
4. **Verify Receipt**: NFT appears in My Tokens for Wallet B
5. **Vault Status**: If was vaulted, only original borrower can withdraw
6. **New Deposit**: New owner can deposit if unredeemed

### Flow 13: Approval management

**Path**: Various pages → Approval states

1. **USDC approval**: First purchase auto-prompts approval; UI uses a buffered amount
2. **Allowance**: No in-app allowance UI; use wallet/explorer to view or revoke
3. **NFT approval**: Vault deposit requires `setApprovalForAll` (auto-prompted when needed)
4. **SCC approval**: First withdrawal requires SCC approval (auto-prompted)
5. **Infinite approval**: Optional via wallet/explorer if desired
6. **Revoke**: Set allowance to 0 via wallet/explorer if needed
7. **Gas**: Subsequent operations skip re-approval

### Flow 14: Concurrent Operations Protection

**Path**: Multiple Tabs/Windows → Simultaneous Actions

1. **Open Multiple**: Same wallet in 2+ browser tabs
2. **Start Transaction**: Begin deposit in Tab 1
3. **Attempt Second**: Try same action in Tab 2
4. **Verify Lock**: Tab 2 shows "Transaction Pending"
5. **Complete First**: Finish transaction in Tab 1
6. **Auto-Update**: Tab 2 reflects new state without refresh

### Flow 15: Ownership transfer

**Path**: Admin → Ownership → Transfer Control

1. **Current Owner**: View current contract owner
2. **Initiate Transfer**: Enter new owner address
3. **Transfer**: Execute `transferOwnership(newOwner)` (single step)
4. **Verify Access**: Old owner loses admin access; new owner has full admin rights

## Testing priorities

### CRITICAL (Must Pass - Security/Financial Impact)

1. Redemption status enforcement in vault
2. Access control and role management
3. Price calculation accuracy
4. Revenue split correctness
5. Gas DoS prevention

### HIGH (Core Functionality)

1. Dutch auction mechanics
2. Dynamic base price adjustments
3. Deposit/withdraw cycles
4. SCC minting/burning
5. Batch operations

### MEDIUM (User Experience)

1. Error messages clarity
2. Transaction gas estimates
3. View function performance
4. Event emissions

### LOW (Nice to Have)

1. UI polish
2. Load time optimizations
3. Browser compatibility

## Quick start (5 minutes)

### 1. Setup MetaMask Wallet

1. Install MetaMask browser extension from [metamask.io](https://metamask.io)
2. Create or import a wallet
3. **Select Ethereum Sepolia** - MetaMask ships with it: enable Settings → Advanced → "Show test
   networks", then pick `Sepolia` from the network dropdown (chain ID `11155111`, currency `ETH`,
   explorer https://sepolia.etherscan.io). No manual RPC entry is needed.

### 2. Get Test Funds

You'll need test ETH for transactions and test USDC for purchases:

1. **Get Test ETH** (for gas fees):
    - Use a Sepolia faucet (for example Alchemy's or Google Cloud's Sepolia faucet)
    - Enter your wallet address
    - Receive 0.1 ETH (enough for many transactions)

2. **Get Test USDC** (optional, for buying NFTs):
    - Will be provided separately if needed for testing
    - Contact support if you need test USDC

### 3. Access the Test App

🌐 **Test URL**: [To be provided after deployment]

Connect your wallet when prompted. Make sure you're on the Ethereum Sepolia network!

## Test data requirements

### Marketplace Test Data

- **Batches**: At least 10 batches with varying ages (0-90 days)
- **NFTs**: 100+ tokens across different batches
- **Producers**: 5+ unique producer addresses
- **Price points**: Batches at base, floor, and mid-decay prices
- **Redemption states**: Mix of redeemed and unredeemed tokens

### Vault Test Data

- **Active loans**: 20+ loans across 5+ users
- **SCC distribution**: Users with 0, <20, 20, 100+ SCC
- **NFT states**: Owned, vaulted, redeemed, transferred
- **Edge cases**: Max loans per user, empty vault, paused state

### User Test Accounts

1. **Admin**: Multisig owner account
2. **Producer**: Account receiving 70% revenue
3. **Regular User**: Multiple NFTs, some vaulted
4. **New User**: No NFTs or SCC
5. **Whale**: Large NFT/SCC holder

## 📋 Testing Scope Overview

### Phase 1: AstaVerde Marketplace

- **Dutch Auction System**: Prices decay from base price to 40 USDC floor over 90 days
- **Dynamic Base Price**: Adjusts +10 USDC for quick sales, -10 USDC after stagnation
- **Batch Minting**: Up to 50 NFTs per batch with unique CIDs
- **Revenue Split**: Platform fee (30% default) and producer payments
- **Redemption System**: Mark NFTs as redeemed for real-world carbon offset claims

### Phase 2: EcoStabilizer Vault

- **Fixed Collateralization**: Each NFT backs exactly 20 SCC tokens
- **No Liquidations**: Always reclaim your exact NFT upon repayment
- **Redemption Protection**: Only un-redeemed NFTs accepted as collateral
- **Access Control**: SCC minting exclusive to vault via MINTER_ROLE
- **Gas Optimization**: Target <230k for deposit, <120k for withdraw

## Critical test scenarios (webapp navigation)

### Phase 1: Marketplace Testing via Webapp

#### Scenario 1.1: Dutch Auction Purchase

**Priority**: HIGH  
**Goal**: Verify price decay mechanism  
**Webapp Path**: Home → Available Batches

1. Navigate to **Home page** (`/`)
2. Scroll to "Available Batches" section
3. Click on any batch card to view details (`/batch/[id]`)
4. Note the current price displayed (should match base price for new batches)
5. Wait 24 hours (or use time manipulation in test env)
6. Refresh the batch page - verify price decreased by exactly 1 USDC
7. Click "Buy" button and complete purchase with MetaMask
8. **Expected**:
    - Price formula: max(basePrice - daysSinceCreation, 40 USDC)
    - Transaction success toast appears
    - NFT appears in "My Tokens" page

#### Scenario 1.2: Dynamic Base Price Adjustment

**Priority**: CRITICAL  
**Goal**: Test automatic price adjustments  
**Webapp Path**: Admin → Pricing Parameters

1. As admin, navigate to **Admin page** (`/admin`)
2. Check "Current Base Price" in the Pricing tab
3. Purchase entire batch within 2 days from Home page
4. Return to Admin page - verify base price increased by 10 USDC
5. Wait 4+ days without any purchases
6. Check Admin page - verify base price decreased by 10 USDC
7. **Expected**:
    - Price bounded between 40-200 USDC
    - Events visible in transaction logs

#### Scenario 1.3: Gas-Bounded Price Updates

**Priority**: HIGH  
**Goal**: Prevent DoS via iteration limits

1. Create many batches (>100)
2. Attempt purchase after long period
3. Monitor gas usage and events
4. **Expected**: PriceUpdateIterationLimitReached event if limit hit

### Phase 2: Vault Testing via Webapp

#### Scenario 2.1: Complete Deposit-Withdraw Cycle

**Priority**: CRITICAL  
**Goal**: Core vault functionality  
**Webapp Path**: My Tokens → Vault Actions

1. Navigate to **My Tokens page** (`/mytokens`)
2. Find an unredeemed NFT (no "Redeemed" badge)
3. Click **"Deposit to Vault"** button on the token card
4. Approve NFT transfer in MetaMask (first transaction)
5. Confirm deposit transaction (second transaction, gas <230k)
6. Check SCC balance in header - should increase by 20 SCC
7. Token card now shows **"In Vault"** status with **"Withdraw"** button
8. Click **"Withdraw"** button
9. Approve SCC spending if needed (may be auto-approved)
10. Confirm withdrawal (gas <120k)
11. **Expected**:
    - Original NFT returns to "Available" status
    - 20 SCC deducted from balance
    - All transactions visible in MetaMask history

#### Scenario 2.2: Batch vault operations

**Priority**: HIGH  
**Goal**: Gas efficiency for multiple operations  
**Webapp Path**: My Tokens → Bulk Actions

1. Navigate to **My Tokens page** (`/mytokens`)
2. Use **"All"** tab to see all owned tokens
3. Find a batch group with 5+ unredeemed NFTs
4. Click **"Deposit All"** button on the batch group card
5. Confirm bulk deposit transaction in MetaMask
6. Verify SCC balance increased by 100 (5 × 20 SCC)
7. Switch to **"In Vault"** tab
8. Withdraw via single-token buttons (bulk withdraw not available in UI)
9. Optional: Use contract `withdrawBatch` via explorer or script
10. **Expected**:
    - Batch deposit uses ~75% less gas than individual
    - Progress indicator shows "Depositing 1/5..." during bulk deposit
    - All NFTs update status correctly

#### Scenario 2.3: Redemption Status Protection

**Priority**: CRITICAL  
**Goal**: Prevent redeemed NFT deposits  
**Webapp Path**: My Tokens → Redeem → Vault

1. Navigate to **My Tokens page** (`/mytokens`)
2. Find an unredeemed NFT you own
3. Click **"Redeem"** button (if available)
4. Confirm redemption in MetaMask
5. Wait for transaction confirmation
6. Token now shows **"Redeemed"** badge
7. Observe that **NO "Deposit to Vault"** button appears
8. If attempting via direct contract call:
    - Transaction should revert with "redeemed asset"
9. **Expected**:
    - UI prevents deposit action for redeemed tokens
    - Redeemed badge clearly visible
    - Tooltip explains why deposit unavailable

#### Scenario 2.4: Access Control Verification

**Priority**: CRITICAL  
**Goal**: Validate exclusive minting rights

1. Attempt direct SCC mint (not via vault)
2. Verify only vault has MINTER_ROLE
3. **Expected**: Unauthorized mint attempts fail

---

## Testing checklist

Use this checklist to systematically test all features. Check off items as you complete them.

### Setup verification

- [ ] MetaMask installed and configured
- [ ] Connected to Ethereum Sepolia network
- [ ] Test wallet funded with ETH (minimum 0.05 ETH)
- [ ] Webapp loads without errors
- [ ] Wallet connects successfully

### Core Functionality Tests

#### 1. Marketplace Functions (AstaVerde.sol)

##### 1.1 Batch Operations (Webapp Navigation)

- [ ] **View batches** → Home page shows all available batches with prices
- [ ] **Batch details** → Click batch card navigates to `/batch/[id]` with full info
- [ ] **Price display** → Current price shown correctly (decayed from base)
- [ ] **Availability** → "X available" count matches actual remaining NFTs
- [ ] **Purchase flow** → "Buy" button → quantity selector → MetaMask confirmation
- [ ] **Max purchase** → Cannot select more than available quantity
- [ ] **IPFS images** → NFT images load from IPFS URLs properly
- [ ] **Producer info** → Producer address shown in token details (`/token/[id]`)

##### 1.2 Dutch Auction Mechanics

- [ ] **Initial price** → New batches start at current basePrice
- [ ] **Daily decay** → Price decreases 1 USDC per day
- [ ] **Price floor** → Never goes below 40 USDC
- [ ] **90-day window** → Price frozen after PRICE_WINDOW
- [ ] **Individual batch timing** → Each batch decays independently

##### 1.3 Dynamic Base Price

- [ ] **Quick sale increase** → +10 USDC if sold <2 days
- [ ] **Stagnation decrease** → -10 USDC if no sales >4 days
- [ ] **Bounds enforcement** → 40 ≤ basePrice ≤ 200 USDC
- [ ] **Event emission** → BasePriceAdjusted(newPrice, increased)
- [ ] **Iteration limit** → maxPriceUpdateIterations prevents DoS

##### 1.4 Revenue Management

- [ ] **Platform fee** → 30% default (max 50%)
- [ ] **Producer payment** → 70% credited to producer balance
- [ ] **Pull pattern** → Producers withdraw via claimProducerFunds()
- [ ] **Platform withdrawal** → Owner claims via claimPlatformFunds()
- [ ] **Surplus recovery** → recoverSurplusUSDC() for direct transfers

#### 2. Vault Functions (EcoStabilizer.sol)

##### 2.1 Vault Deposit Operations (Webapp UI)

- [ ] **Token display** → My Tokens page shows all owned NFTs with status
- [ ] **Deposit button** → Visible only for unredeemed, non-vaulted NFTs
- [ ] **Approval flow** → Clear two-step process (approve NFT, then deposit)
- [ ] **SCC balance** → Header updates immediately after deposit (+20 SCC)
- [ ] **Status update** → Token card changes from "Available" to "In Vault"
- [ ] **Batch deposit** → "Deposit All" works for token groups
- [ ] **Progress indicator** → Shows "Depositing X of Y..." for bulk operations
- [ ] **Gas display** → MetaMask shows <230k gas estimate

##### 2.2 Vault withdraw operations (webapp UI)

- [ ] **Vault tab** → "In Vault" tab shows only vaulted NFTs
- [ ] **Withdraw button** → Enabled when user has ≥20 SCC per NFT
- [ ] **Insufficient SCC** → Button shows "Need 20 SCC" when balance too low
- [ ] **SCC approval** → Auto-prompts for approval if needed
- [ ] **Balance update** → Header SCC balance decreases by 20 per NFT
- [ ] **Status change** → NFT returns to "Available" status
- [ ] **Withdraw (single)** → Use per-token withdraw buttons (bulk withdraw via explorer)
- [ ] **Gas estimate** → Shows <120k for single withdrawal

##### 2.3 View functions

- [ ] **Loan status** → `loans(tokenId)` reflects borrower/active correctly
- [ ] **User loans** → `getUserLoans(user)` correct
- [ ] **Paginated loans** → `getUserLoansIndexed(user, offset, limit)` works
- [ ] **Total stats** → totalActiveLoans accurate
- [ ] **Max page size** → Respects 2000 item limit

#### 3. SCC Token (StabilizedCarbonCoin.sol)

##### 3.1 Minting Controls

- [ ] **Exclusive minting** → Only vault has MINTER_ROLE
- [ ] **Supply cap** → Cannot exceed 1B SCC total
- [ ] **Zero checks** → Rejects zero address/amount
- [ ] **Event emission** → Transfer events on mint/burn

##### 3.2 Burning mechanisms

- [ ] **Direct burn** → burn(amount) by token holder
- [ ] **Approved burn** → burnFrom() with allowance
- [ ] **Vault burns** → During NFT withdrawal
- [ ] **Balance updates** → Accurate after burns

### Security & Error Handling Tests

#### 4. Access Control & Permissions

##### 4.1 Marketplace Access

- [ ] **Owner functions** → Only owner can mint, set params, pause
- [ ] **Pause mechanism** → No purchases when paused
- [ ] **Parameter bounds** → Rejects invalid settings
- [ ] **Multisig requirement** → Owner should be multisig

##### 4.2 Vault Access

- [ ] **Loan ownership** → Only borrower can withdraw
- [ ] **Admin functions** → Only owner can pause/unpause
- [ ] **Emergency withdrawal** → Admin can sweep unsolicited NFTs
- [ ] **Role management** → MINTER_ROLE immutable after setup

#### 5. Edge Cases & Attack Vectors

##### 5.1 Reentrancy Protection

- [ ] **Marketplace** → ReentrancyGuard on buyBatch()
- [ ] **Vault deposits** → CEI pattern prevents reentrancy
- [ ] **Vault withdraws** → State updates before transfers
- [ ] **Producer claims** → Pull pattern prevents DoS

##### 5.2 Integer Overflow/Underflow

- [ ] **Price calculations** → No overflow at max values
- [ ] **Batch sizing** → Respects maxBatchSize limit
- [ ] **SCC supply** → Cannot exceed 1B cap
- [ ] **Balance tracking** → Accurate with large numbers

##### 5.3 Gas Griefing Prevention

- [ ] **Iteration limit** → maxPriceUpdateIterations bounds gas
- [ ] **Batch limits** → Max 50 NFTs prevents DoS
- [ ] **Page size limit** → Max 2000 items in views
- [ ] **Pull payments** → No unbounded loops in transfers

#### 6. Failure Recovery

##### 6.1 Transaction Failures

- [ ] **Insufficient USDC** → Clear error message
- [ ] **Insufficient SCC** → "Need 20 SCC" message
- [ ] **Wrong network** → Network mismatch warning
- [ ] **User rejection** → Graceful handling
- [ ] **Gas estimation** → Accurate before submission

##### 6.2 State Recovery

- [ ] **Failed deposits** → NFT remains with user
- [ ] **Failed withdraws** → NFT stays in vault
- [ ] **Partial batch ops** → Atomic (all or nothing)
- [ ] **Emergency pause** → Admin can halt operations

### UI/UX tests

#### 7. Visual Feedback & UI Elements

##### 7.1 Navigation & Layout

- [ ] **Header navigation** → Links to Home, My Tokens, About, Producer/Admin (if applicable)
- [ ] **SCC balance** → Always visible in header when wallet connected
- [ ] **Network indicator** → Shows current network (Ethereum Sepolia/Mainnet)
- [ ] **Wallet connection** → ConnectKit modal for wallet selection

##### 7.2 Transaction feedback

- [ ] **Loading states** → Spinner overlay during transactions
- [ ] **Toast notifications** → Success/error messages appear top-right
- [ ] **Transaction status** → "Approving...", "Depositing...", etc.
- [ ] **Disabled states** → Buttons disabled during processing
- [ ] **Error messages** → Clear, actionable error text in red
- [ ] **Success indicators** → Green checkmarks, success toasts
- [ ] **Gas estimate vs used** → Validate gasUsed in receipt; estimates may include UI buffer

#### 8. Webapp Pages & Routes

##### 8.1 Core Pages

- [ ] **Home** (`/`) → Shows available batches, marketplace info
- [ ] **My Tokens** (`/mytokens`) → Lists owned NFTs with vault actions
- [ ] **Batch Details** (`/batch/[id]`) → Individual batch info and purchase
- [ ] **Token Details** (`/token/[id]`) → Single NFT metadata and actions
- [ ] **Eco Assets** (`/ecoassets`) → Information about carbon credits
- [ ] **About** (`/about`) → Project information

##### 8.2 Restricted Pages

- [ ] **Producer** (`/producer`) → Only for producer accounts (claim funds)
- [ ] **Admin** (`/admin`) → Only for admin accounts (platform controls)
- [ ] **Test Vault** (`/test-vault`) → Development testing page (if enabled)

##### 8.3 Responsive Design

- [ ] **Mobile** → Token cards stack vertically, navigation hamburger menu
- [ ] **Tablet** → 2-column grid for tokens, side navigation
- [ ] **Desktop** → 3-4 column grid, full navigation bar
- [ ] **Touch** → All buttons/links work with touch gestures

#### 9. Navigation

- [ ] **Page transitions** → Smooth navigation between pages
- [ ] **Back button** → Browser back works correctly
- [ ] **Refresh handling** → State persists after refresh
- [ ] **Deep links** → Direct URLs work (if applicable)

### Edge Cases

#### 10. Rapid Actions

- [ ] **Double-click prevention** → Can't submit twice
- [ ] **Quick navigation** → Leaving page during transaction
- [ ] **Multiple tabs** → Having app open in multiple tabs

#### 11. Wallet Switching

- [ ] **Account change** → App updates when switching accounts
- [ ] **Network change** → Warning when wrong network
- [ ] **Disconnect/reconnect** → Handles wallet disconnection

#### 12. Data Edge Cases

- [ ] **0 NFTs owned** → Appropriate empty state
- [ ] **Many NFTs** → Pagination or scrolling works
- [ ] **Mixed states** → Some vaulted, some not, some redeemed

### Multi-wallet testing

#### 13. Wallet Compatibility

- [ ] **MetaMask** → Full functionality
- [ ] **WalletConnect** → Mobile wallets work
- [ ] **Coinbase Wallet** → If supported
- [ ] **Rainbow** → If supported

### Webapp–contract integration tests

#### UI-Contract Sync Testing

- [ ] **Price updates** → UI reflects on-chain price changes immediately
- [ ] **Balance sync** → SCC balance in header matches contract state
- [ ] **NFT ownership** → My Tokens page shows correct ownership
- [ ] **Vault status** → UI correctly shows vaulted vs available NFTs
- [ ] **Transaction pending** → UI disables actions during pending txs
- [ ] **Event listeners** → UI updates when contract events fire
- [ ] **Error handling** → Contract reverts show user-friendly messages

### Integration tests (cross-contract)

#### Integration 1: Marketplace → Vault Flow

- [ ] **Purchase NFT** → Buy from AstaVerde marketplace
- [ ] **Verify ownership** → NFT appears in wallet
- [ ] **Deposit to vault** → NFT accepted by EcoStabilizer
- [ ] **Redeem NFT** → Mark as redeemed in marketplace
- [ ] **Attempt deposit** → Vault rejects redeemed NFT
- [ ] **Expected**: Seamless flow with proper validations

#### Integration 2: SCC Token Economics

- [ ] **Deposit multiple NFTs** → Accumulate SCC balance
- [ ] **Transfer SCC** → Send between accounts
- [ ] **Partial withdrawal** → Use SCC for some NFTs
- [ ] **Market making** → Arbitrage between NFT and SCC prices
- [ ] **Expected**: Price discovery around 1/20 NFT floor

#### Integration 3: Emergency Scenarios

- [ ] **Pause marketplace** → No new purchases
- [ ] **Pause vault** → No deposits/withdrawals
- [ ] **SCC transfers** → Continue working when vault paused
- [ ] **Unpause recovery** → Normal operations resume
- [ ] **Expected**: Graceful degradation and recovery

### Performance & Gas Tests

#### 7. Gas Consumption Targets

##### 7.1 Marketplace Operations

- [ ] **Single purchase** → ~200-500k (includes price updates)
- [ ] **Batch purchase (5)** → <600k total
- [ ] **Producer claim** → <100k gas
- [ ] **Platform claim** → <100k gas
- [ ] **Mint batch (50)** → <2M gas

##### 7.2 Vault Operations

- [ ] **Single deposit** → <230k gas (target: ~215k)
- [ ] **Batch deposit (5)** → <600k (~120k per NFT)
- [ ] **Single withdraw** → <120k gas (target: ~110k)
- [ ] **Batch withdraw (5)** → <350k (~70k per NFT)
- [ ] **View functions** → <50k for paginated queries

##### 7.3 SCC Operations

- [ ] **Transfer** → Standard ERC20 gas (~65k)
- [ ] **Approve** → Standard ERC20 gas (~45k)
- [ ] **Burn** → <50k gas
- [ ] **Balance check** → Constant gas (view)

#### 8. Load & Stress Testing

##### 8.1 High Volume Scenarios

- [ ] **100+ batches** → Price updates still bounded
- [ ] **1000+ NFTs** → Pagination works correctly
- [ ] **50+ active loans** → View functions responsive
- [ ] **Concurrent users** → No race conditions

##### 8.2 Performance Metrics

- [ ] **Response time** → <3s for all operations
- [ ] **Memory usage** → No leaks over time
- [ ] **RPC reliability** → Handles network issues
- [ ] **Event indexing** → Logs properly indexed

---

## Reporting issues

If something doesn't work as expected:

### Quick Bug Report Template

```
**What happened:**
[Describe what you saw]

**What should have happened:**
[Describe what you expected]

**Steps to reproduce:**
1. [First step]
2. [Second step]
3. [etc.]

**Wallet address:**
[Your test wallet address]

**Transaction hash (if applicable):**
[Link from Etherscan]
```

### Where to Report

- Email: [Contact email]
- Or use the feedback form in the app

---

## Common issues & solutions

### "Transaction Failed"

- ✅ Check you have enough ETH for gas (need ~0.01 ETH)
- ✅ Make sure you're on the Ethereum Sepolia network
- ✅ Try refreshing the page

### "Can't see my NFTs"

- ✅ Confirm wallet is connected
- ✅ Check you're on the correct network
- ✅ Refresh the page or reconnect wallet

### "Deposit button disabled"

- ✅ NFT might be redeemed (check status)
- ✅ Transaction might be pending (wait a moment)
- ✅ Check browser console for errors (F12)

### "Withdraw button shows 'Need 20 SCC'"

- ✅ You need exactly 20 SCC to withdraw
- ✅ Deposit another NFT to get more SCC
- ✅ Or request test SCC from support

---

## Test results summary

### Test Coverage by Contract

#### AstaVerde.sol (Marketplace)

- **Passed**: \_\_\_ / 35
- **Failed**: \_\_\_ / 35
- **Blocked**: \_\_\_ / 35
- **Not Tested**: \_\_\_ / 35

#### EcoStabilizer.sol (Vault)

- **Passed**: \_\_\_ / 30
- **Failed**: \_\_\_ / 30
- **Blocked**: \_\_\_ / 30
- **Not Tested**: \_\_\_ / 30

#### StabilizedCarbonCoin.sol (SCC)

- **Passed**: \_\_\_ / 15
- **Failed**: \_\_\_ / 15
- **Blocked**: \_\_\_ / 15
- **Not Tested**: \_\_\_ / 15

### Overall Statistics

- **Total Tests**: 80
- **Pass Rate**: \_\_\_\_%
- **Critical Issues**: \_\_\_
- **High Priority Issues**: \_\_\_
- **Medium/Low Issues**: \_\_\_

### Critical Issues Found (MUST FIX)

| ID  | Contract | Description | Steps to Reproduce | Impact |
| --- | -------- | ----------- | ------------------ | ------ |
| C1  |          |             |                    |        |
| C2  |          |             |                    |        |
| C3  |          |             |                    |        |

### High Priority Issues (SHOULD FIX)

| ID  | Contract | Description | Recommendation | Priority |
| --- | -------- | ----------- | -------------- | -------- |
| H1  |          |             |                |          |
| H2  |          |             |                |          |
| H3  |          |             |                |          |

### Medium/Low Priority Issues

| ID  | Category | Description | Severity |
| --- | -------- | ----------- | -------- |
| M1  |          |             |          |
| M2  |          |             |          |
| L1  |          |             |          |
| L2  |          |             |          |

### Gas Optimization Opportunities

| Contract | Function | Current Gas | Potential Saving | Method |
| -------- | -------- | ----------- | ---------------- | ------ |
|          |          |             |                  |        |
|          |          |             |                  |        |

## Additional notes

_Space for any additional observations, questions, or feedback:_

---

**Tester Name**: **\*\***\_\_\_**\*\***
**Date**: **\*\***\_\_\_**\*\***
**Wallet Address**: **\*\***\_\_\_**\*\***
**Browser/Device**: **\*\***\_\_\_**\*\***

---

## Success metrics & definition of done

### Success Metrics

#### Phase 1 (Marketplace) Success Criteria:

- ✅ Dutch auction prices decay correctly (1 USDC/day)
- ✅ Base price adjusts dynamically within bounds (40-200 USDC)
- ✅ Revenue splits correctly (platform 30%, producer 70%)
- ✅ Gas-bounded operations prevent DoS attacks
- ✅ Redeemed NFTs properly marked and tracked

#### Phase 2 (Vault) success criteria:

- ✅ Fixed 20 SCC issuance per NFT deposit
- ✅ Exact NFT recovery on loan repayment
- ✅ Redeemed NFTs rejected for collateral
- ✅ Gas targets met (<230k deposit, <120k withdraw)
- ✅ Exclusive SCC minting via MINTER_ROLE

### Definition of done

The system is ready for production when:

- [ ] All CRITICAL tests pass (100% required)
- [ ] All HIGH priority tests pass (95% required)
- [ ] MEDIUM priority tests pass (80% required)
- [ ] No security vulnerabilities found
- [ ] Gas consumption within targets
- [ ] Error messages clear and actionable
- [ ] Multi-wallet compatibility verified
- [ ] Load testing shows stability at 10x expected volume
- [ ] All events properly emitted and indexed
- [ ] Admin functions restricted to multisig

## Testing best practices

### Test Execution Order

1. **Setup & Access**: Verify wallet connection and network
2. **Happy Path**: Test all success scenarios first
3. **Edge Cases**: Test boundary conditions
4. **Error Cases**: Verify all failure modes
5. **Security Tests**: Attempt unauthorized actions
6. **Performance**: Measure gas and load times

### Testing Tools & Techniques

- **Browser DevTools**: Monitor network requests and console errors
- **Explorer (Etherscan)**: Verify contract interactions
- **Gas Profiler**: Track actual vs estimated gas
- **Multiple Wallets**: Test with MetaMask, WalletConnect, Coinbase
- **Time Manipulation**: Use test environment time controls for auction testing

### Data Collection

- Screenshot all errors with console open
- Record transaction hashes for all operations
- Note exact gas used vs estimates
- Document response times for each action
- Track any unexpected behaviors

## Testing support & resources

### Quick Links

- **Contract Documentation**: `/docs/CONTRACTS.md`
- **Integration Guide**: `/test/INTEGRATION_TESTING.md`
- **Local Testing (legacy)**: `npm run dev:local` for full stack
- **Sepolia Testing**: `npm run dev:sepolia` with deployed contracts

### Support Channels

- **Technical Issues**: Create GitHub issue with reproduction steps
- **Test Fund Requests**: Contact team for test USDC/ETH
- **Security Concerns**: Private disclosure via security@astaverde
- **General Questions**: Team chat or support email

### Automated Testing

- Run `npm run test` for unit tests
- Run `npm run coverage` for coverage report
- Run `npm run qa:full` for complete QA suite

---

## Automated testing scripts

### Running Test Suites

```bash
# Unit tests for all contracts
npm run test

# Coverage report
npm run coverage

# Quick QA check
npm run qa:status

# Fast QA (basic scenarios)
npm run qa:fast

# Full QA suite
npm run qa:full

# Local testing environment
npm run dev:local

# Sepolia testing
npm run dev:sepolia
```

### Contract Verification

```bash
# Verify ABIs match deployment
npm run validate:abis

# Check contract sizes
npx hardhat size-contracts

# Verify deployment addresses
node scripts/check-current-state.js
```

### Monitoring Commands

```bash
# Watch contract events (edit the chain/block range in events/index.mjs first)
cd scripts/events && node index.mjs

# Check current state
node scripts/check-current-state.js
```

---

## Flow coverage summary

### Total user flows: 15

1. ✅ Complete NFT Lifecycle (Purchase → Vault → Withdraw)
2. ✅ Redemption Protection (Redeem → Block Vault)
3. ✅ Bulk Vault Operations (Batch Deposit/Withdraw)
4. ✅ Producer Revenue Claim (Balance → Claim USDC)
5. ✅ Admin Price Management (Adjust Base/Floor/Thresholds)
6. ✅ Emergency pause operations (Marketplace UI; vault via explorer)
7. ✅ Batch Redemption (Multi-Select → Progress Bar)
8. ✅ USDC Surplus Recovery (Direct Transfer Recovery)
9. ✅ Gas Optimization Controls (Iteration Limits)
10. ✅ NFT Mint and Distribution (Admin Batch Creation)
11. ✅ Failed Transaction Recovery (Error → Retry)
12. ✅ Cross-Wallet NFT Transfer (Transfer → New Owner)
13. ✅ Approval Management (USDC/NFT/SCC Approvals)
14. ✅ Concurrent Operations Protection (Multi-Tab Safety)
15. ✅ Ownership transfer (single-step Ownable)

## Contract coverage verification

### Critical Contract Functions Tested via Webapp UI:

#### AstaVerde.sol coverage

- ✅ **buyBatch()** → Home page "Buy" button on batch cards
- ✅ **redeemToken()** → My Tokens "Redeem" button
- ✅ **claimProducerFunds()** → Producer page "Claim" button
- ✅ **getCurrentBatchPrice()** → Price display on batch cards
- ✅ **getTokenProducer()** → Token details page shows producer
- ✅ **getTokenCid()** → IPFS metadata displayed
- ✅ **isRedeemed()** → "Redeemed" badge on tokens

#### EcoStabilizer.sol coverage

- ✅ **deposit()** → My Tokens "Deposit to Vault" button
- ✅ **depositBatch()** → "Deposit All" batch action
- ✅ **withdraw()** → "Withdraw" button on vaulted tokens
- (UI) **withdraw** only (bulk withdraw not available in UI)
- ✅ **loans()** → Vault status display on token cards
- ✅ **getUserLoanIds()** → "In Vault" tab filtering

#### StabilizedCarbonCoin.sol coverage

- ✅ **balanceOf()** → SCC balance in header
- ✅ **approve()** → Automatic during withdraw flow
- ✅ **mint()** → Triggered by vault deposits (20 SCC per NFT)
- ✅ **burn()** → Triggered by vault withdrawals

### Critical Security Paths Tested:

1. **Redemption Protection**: UI prevents depositing redeemed NFTs
2. **Access Control**: Producer/Admin pages restricted by role
3. **Balance Verification**: SCC balance always matches contract state
4. **Gas Limits**: All operations stay within target gas usage
5. **Error Handling**: Contract reverts show clear user messages

---

Thank you for helping test AstaVerde V2! Your thorough testing ensures the security and reliability of our carbon offset marketplace and vault system. Please submit this completed checklist along with any bug reports. 🙏
