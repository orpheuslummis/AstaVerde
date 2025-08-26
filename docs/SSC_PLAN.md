# EcoStabilizer Vault — _Developer‑Ready_ Implementation Spec (v0.3, 24 Jul 2025)

> **Changes from v0.2**
> • Production chain switched to **Base Mainnet** (OP‑Stack L2).
> • Vault is deployed _alongside_ the already‑live `AstaVerde` contract (address passed in constructor — no changes to the original code).
> • **Redeemed EcoAssets are strictly ineligible** as collateral (enforced on‑chain).
> • No treasury LP, no abandoned‑loan forfeiture mechanism in MVP.

---

## 0 │ Scope & Assumptions

- _EcoAsset_ NFTs are the **ERC‑1155** tokens minted by the existing `AstaVerde` contract **already deployed on Base**. The Vault references it via constructor parameter.
- Only **un‑redeemed** EcoAssets can be deposited; this is enforced by querying the public `tokens(tokenId)` getter in `AstaVerde`.
- **Networks** – Sepolia (test) ▶ Base Mainnet (prod). Native **USDC.e** liquidity is available on Base for SCC ↔ USDC pools.
- Contracts are **non‑upgradeable** in v0.3; future upgrades require new deployments + optional migrator.

---

## 1 │ Contract Topology & High‑Level Responsibilities

| Contract                         | Base                                                        | Deployed by         | Key Responsibilities                                                      |
| -------------------------------- | ----------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| **`StabilizedCarbonCoin` (SCC)** | `ERC20`, `AccessControl`                                    | Vault deployer      | Fungible debt token, `MINTER_ROLE` exclusively granted to Vault.          |
| **`EcoStabilizer` (Vault)**      | `ReentrancyGuard`, `Pausable`, `Ownable`, `ERC1155Receiver` | Deployer (same EOA) | Holds NFTs as collateral, mints/burns SCC, validates _un‑redeemed_ state. |
| **`AstaVerde`**                  | _existing_                                                  | –                   | Primary market — **unchanged**, exposes `tokens(uint256)` public getter.  |

---

## 2 │ Canonical Interfaces

### 2.1 Required interfaces

```solidity
// For reading token state AND ERC1155 transfers
interface IAstaVerde is IERC1155 {
    function tokens(uint256) external view returns (
        address owner,
        uint256 tokenId,
        address producer,
        string  memory cid,
        bool    redeemed
    );
}
```

### 2.2 StabilizedCarbonCoin.sol (unchanged)

```solidity
// SPDX‑License‑Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract StabilizedCarbonCoin is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor() ERC20("Stabilized Carbon Coin", "SCC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // MINTER_ROLE granted explicitly after vault deployment
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
```

### 2.3 EcoStabilizer.sol (Vault)

```solidity
// SPDX‑License‑Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./StabilizedCarbonCoin.sol";
import "./IAstaVerde.sol";

contract EcoStabilizer is ERC1155Holder, ReentrancyGuard, Pausable, Ownable {
    /** CONSTANTS **/
    uint256 public constant SCC_PER_ASSET = 20 * 1e18; // 20 SCC, 18 decimals

    /** IMMUTABLES **/
    IAstaVerde             public immutable ecoAsset; // ERC1155 + token data
    StabilizedCarbonCoin   public immutable scc;

    /** STATE **/
    struct Loan { address borrower; bool active; }
    mapping(uint256 => Loan) public loans; // tokenId → Loan

    /** EVENTS **/
    event Deposited(address indexed user, uint256 indexed tokenId);
    event Withdrawn(address indexed user, uint256 indexed tokenId);
    event EmergencyNFTWithdrawn(address indexed to, uint256 indexed tokenId);

    constructor(address _ecoAsset, address _scc) {
        ecoAsset = IAstaVerde(_ecoAsset);
        scc = StabilizedCarbonCoin(_scc);
    }

    /*────────────────────────  CORE FUNCTIONS  ───────────────────────*/
    function deposit(uint256 tokenId) external nonReentrant whenNotPaused {
        require(!loans[tokenId].active, "loan active");
        (, , , , bool redeemed) = ecoAsset.tokens(tokenId);
        require(!redeemed, "redeemed asset");

        // Transfer NFT (IAstaVerde inherits from IERC1155)
        ecoAsset.safeTransferFrom(msg.sender, address(this), tokenId, 1, "");

        loans[tokenId] = Loan(msg.sender, true);
        scc.mint(msg.sender, SCC_PER_ASSET);
        emit Deposited(msg.sender, tokenId);
    }

    function withdraw(uint256 tokenId) external nonReentrant whenNotPaused {
        Loan memory L = loans[tokenId];
        require(L.active && L.borrower == msg.sender, "not borrower");

        scc.transferFrom(msg.sender, address(this), SCC_PER_ASSET);
        scc.burn(SCC_PER_ASSET);

        // Transfer NFT back (IAstaVerde inherits from IERC1155)
        ecoAsset.safeTransferFrom(address(this), msg.sender, tokenId, 1, "");
        loans[tokenId].active = false;
        emit Withdrawn(msg.sender, tokenId);
    }

    /*────────────────────────  ADMIN  ───────────────────────────────*/
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /** Rescue function for unsolicited NFT transfers */
    function adminSweepNFT(uint256 tokenId, address to) external onlyOwner {
        require(!loans[tokenId].active, "loan active");
        ecoAsset.safeTransferFrom(address(this), to, tokenId, 1, "");
        emit EmergencyNFTWithdrawn(to, tokenId);
    }

    /*────────────────────────  VIEW FUNCTIONS  ─────────────────────*/
    function getUserLoans(address user) external view returns (uint256[] memory) {
        // Count active loans for user first
        uint256 count = 0;
        for (uint256 i = 1; i <= 10000; i++) { // Adjust max range as needed
            if (loans[i].active && loans[i].borrower == user) count++;
        }

        // Collect loan token IDs
        uint256[] memory userLoans = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= 10000; i++) {
            if (loans[i].active && loans[i].borrower == user) {
                userLoans[index] = i;
                index++;
            }
        }
        return userLoans;
    }

    function getTotalActiveLoans() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 1; i <= 10000; i++) { // Adjust max range as needed
            if (loans[i].active) count++;
        }
        return count;
    }
}
```

**Compile note:** `IAstaVerde` now inherits from `IERC1155`, so all transfer functions compile correctly.

---

## 3 │ Security Checklist (delta)

- Added **redeemed‑asset guard** in `deposit()`.
- Deployment script MUST **renounce `MINTER_ROLE` and `DEFAULT_ADMIN_ROLE`** from deployer after assigning vault.
- Confirm Base‑specific ERC‑1155 safe‑transfer quirks (same as mainnet—no change).

---

## 4 │ Test Suite (additions)

| File                         | Purpose                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `Vault_Redeemed.t.sol`       | Attempt deposit of redeemed token → expect revert "redeemed asset" |
| `Vault_DirectTransfer.t.sol` | Unsolicited ERC‑1155 transfer, then `adminSweepNFT` works          |

All previous tests remain.

---

## 5 │ Deployment Notes for Base

- **USDC address:** `0xd9aA147f52ACa67747d34cE24dA23A4eA897C3E8` (native Circle USDC on Base - verify before deployment).
- Environment variables:

    ```ini
    AV_ADDR=0xExistingAstaVerdeOnBase
    BASE_RPC=https://mainnet.base.org
    PRIVATE_KEY=...
    ```

- Script steps:
    1. Deploy **SCC** (no constructor parameters).
    2. Deploy **EcoStabilizer** with `AV_ADDR` & `SCC_ADDR`.
    3. Call `grantRole(MINTER_ROLE, VAULT_ADDR)` on SCC.
    4. **Renounce** both `MINTER_ROLE` and `DEFAULT_ADMIN_ROLE` from deployer.
    5. Verify both contracts on BaseScan.
    6. Run smoke test: deposit testnet NFT → mint SCC → withdraw.

---

## 6 │ Task Breakdown for AI Coders (updated)

1. Add `IAstaVerde` interface inheriting from `IERC1155`.
2. Insert redeemed‑token unit test.
3. Update deployment script for Base.
4. Review README (remove treasury LP & forfeiture mentions).

## Appendix: the initial spec

The EcoStabilizer Vault is a decentralized protocol designed to solve the illiquidity of EcoAsset NFTs. It introduces a non-fungible Collateralized Debt Position (CDP) system that allows NFT holders to lock a specific asset as collateral to mint a fixed-rate loan in a new fungible ERC-20 token, the **Stabilized Carbon Coin (SCC)**. This provides owners with instant liquidity without requiring them to sell their underlying unique asset.

## **Core objectives**

- **Provide instant liquidity:** Enable any EcoAsset holder to leverage their NFT for an immediate, predictable loan.
- **Enhance primary market:** Make new EcoAsset NFTs more attractive by providing a clear and immediate use case for them beyond simple ownership.
- **Establish a debt market:** Create a liquid, real-time market for SCC, the ecosystem's native debt instrument, improving price discovery and financial utility.

## **System architecture**

The system is composed of two new smart contracts that interact with the existing AstaVerde ERC-1155 contract in a modular, non-intrusive way.

- **StabilizedCarbonCoin.sol (SCC):** A standard ERC-20 token. Its supply is exclusively controlled (mint/burn) by the Vault.
- **EcoStabilizer.sol (The Vault):** The core logic contract that holds NFTs as collateral, manages individual loans, and is the sole minter/burner of SCC.

## **Cryptoeconomic model: Non-fungible CDPs**

The vault’s design prioritizes security and predictability over capital efficiency. Each EcoAsset NFT serves as unique, non-fungible collateral for its own distinct loan.

- **Core Mechanism:** 1 specific EcoAsset NFT is locked ⟺ a fixed loan of 20 SCC is minted.
- **Fixed Issuance Rate:** The system uses a constant rate (SCC_PER_ASSET = 20) to completely eliminate the need for price oracles, a major security risk in DeFi.

**Advantages of this model:**

- **Zero oracle risk:** Immune to price feed manipulation and failure.
- **No liquidations:** A user's collateral can **never** be liquidated and sold to a third party. The loan is a bilateral agreement between the user and the protocol.
- **No systemic risk:** A default on one loan has no financial impact on any other user's position, preventing cascading failures.
- **Immune to adverse selection:** Users deposit and reclaim their *exact* NFT, eliminating the "lemon problem" of pooling high and low-quality assets.

**SCC price peg mechanism:**

The market price of 20 SCC is pegged to the primary market price of a *new* EcoAsset from the AstaVerde contract via arbitrage.

- **Price ceiling (arbitrage):** If Price(20 SCC) > Price(New EcoAsset), arbitrageurs can buy a new EcoAsset, deposit() it to mint 20 SCC, and sell the SCC on a DEX for a profit. This sell pressure drives the SCC price down, enforcing a ceiling.
- **Price Floor (incentive):** If Price(20 SCC) < Value(Vaulted EcoAsset), the owner is incentivized to buy cheap SCC from a DEX to withdraw() their more valuable NFT, creating buy pressure that supports the price.

**Key user flows**

1. **Deposit & mint loan:**
    - A user holding an un-redeemed EcoAsset NFT approves the Vault contract.
    - They call deposit(tokenId), which transfers their **specific NFT** to the Vault.
    - The Vault mints **exactly 20 SCC** to the user's wallet.
2. **Withdraw & repay Loan:**
    - The user acquires 20 SCC (from a DEX or other means).
    - They approve the Vault to spend their SCC.
    - They call withdraw(tokenId), which burns **exactly 20 SCC** from their wallet and transfers their **exact NFT** back.

## **Risks & mitigations**

| **Risk**                                      | **Impact**                                                                                                                                                      | **Mitigation (MVP)**                                                                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Orphaned collateral** (Default / Lost keys) | The NFT is permanently locked in the vault. The 20 SCC minted against it can never be burned, creating a permanent, unbacked "ghost supply".                    | **Accepted risk.** This is the core tradeoff for eliminating liquidations. The UI must forcefully communicate this risk to the user before they deposit. |
| **Primary market dependency**                 | The SCC price ceiling is critically dependent on a continuous supply of new assets from the AstaVerde contract. If the primary market halts, the peg can break. | **Operational commitment.** The EcoTradeZone platform must ensure a healthy primary market. A treasury can be used to provide SCC liquidity if needed.   |
| **Capital inefficiency**                      | The fixed loan value (20 SCC) may represent a low Loan-to-Value (LTV) ratio for highly valuable NFTs, limiting the vault's utility for top-tier assets.         | **Accepted tradeoff.** This is a design choice for the MVP to prioritize security.                                                                       |

**NOTE:** While the MVP design prioritizes security through simplicity, its long-term viability hinges on addressing its core economic dependencies. The system's primary challenges are the peg's total reliance on a healthy primary market, the gradual accumulation of unbacked "ghost supply" from orphaned collateral, and the potential for sustained sell pressure on SCC due to its limited initial utility. To proactively mitigate these issues and ensure sustainable growth, several strategic enhancements are proposed for future iterations. First, establishing a protocol-owned treasury, funded by a portion of AstaVerde's platform fees, to provide deep DEX liquidity and act as a stabilizing force for the peg. Second, creating a direct utility sink for SCC, such as enabling the purchase of new EcoAssets directly with the token, to generate organic buy pressure. Finally, exploring a long-term forfeiture mechanism to eventually reclaim abandoned NFTs, allowing the protocol to auction them off and burn the associated unbacked SCC, thereby maintaining the integrity of the system's balance sheet. Long‑run stability depends on (i) continuous new supply of EcoAssets above 20 SCC value, (ii) mechanisms to retire ghost supply, and (iii) deep SCC liquidity. Without those, the fixed‑rate, no‑liquidation design can accumulate hidden leverage and break the peg during market stress.

---

## 7 │ AI-Agent Implementation Enhancements (Budget-Conscious MVP)

### 7.1 Essential Contract Additions Only

**StabilizedCarbonCoin.sol - Minimal additions:**

```solidity
// Only essential for debugging - no enumeration functions
function decimals() public pure override returns (uint8) { return 18; }
```

**EcoStabilizer.sol - Essential view functions only:**

```solidity
// Core metrics for frontend (implemented in main contract above)
// - getUserLoans(address user) returns uint256[]
// - getTotalActiveLoans() returns uint256
// Note: These iterate through token ranges - optimize for production if needed
```

### 7.2 Focused Testing Requirements

**Essential Test Coverage:**

- **Unit tests**: Core deposit/withdraw functionality
- **Integration**: AstaVerde contract interaction + redeemed asset validation
- **Edge cases**: Error conditions, direct transfers, paused state
- **Gas tests**: Verify < 165k deposit, < 120k withdraw
- **Compilation test**: Verify IAstaVerde inheritance from IERC1155 compiles correctly

**Skip for MVP:** Complex batch operations, extensive minter enumeration tests

### 7.3 Streamlined Deployment

**Deployment Steps:**

```typescript
// deploy/deploy_scc.ts - Keep it simple
1. Validate AV_ADDR exists and responds
2. Deploy SCC (no constructor params)
3. Deploy Vault with AV_ADDR, SCC_ADDR
4. Grant MINTER_ROLE to vault on SCC contract
5. Renounce all deployer roles
6. Verify on Basescan
```

### 7.4 Minimal Frontend Integration

**Single React Hook - useVault:**

```typescript
export function useVault() {
    return {
        deposit: (tokenId: bigint) => Promise<void>,
        withdraw: (tokenId: bigint) => Promise<void>,
        getUserLoans: (address: Address) => Promise<bigint[]>,
        isLoading: boolean,
        error: string | null,
    };
}
```

### 7.5 Essential Metrics Only

**Track These Core Metrics:**

- Total active loans count
- Ghost supply incidents (failed withdrawals)
- Basic peg deviation alerts

**Skip for MVP:** Complex analytics dashboard, detailed health metrics

### 7.6 MVP Acceptance Criteria

**Must Have:**

- [ ] Deposit un-redeemed assets → get 20 SCC
- [ ] Withdraw exact NFT by burning 20 SCC
- [ ] Redeemed assets rejected on deposit
- [ ] Admin pause/unpause functionality
- [ ] Gas targets met (< 165k deposit, < 120k withdraw)

**Nice to Have (Skip for MVP):**

- Batch operations
- Advanced monitoring dashboard
- Complex error categorization
- Extensive view functions

### 7.7 Implementation Plan

**M1: Core Development**

- Implement 3 contracts with simplified IAstaVerde interface
- Essential unit tests
- Basic deployment script

**M2: Integration & Testing**

- AstaVerde integration tests
- Frontend hook implementation
- Gas optimization

**M3: Deployment & Polish**

- Testnet deployment
- Basic monitoring setup
- Documentation cleanup

---

## 8 │ Frontend Vault UI Implementation (merged)

**Priority: High | Estimate: 3–5 days**

- **Component**: `webapp/src/components/VaultCard.tsx`
    - Display user vault position (NFT collateral + SCC debt)
    - Deposit NFT (validate un-redeemed)
    - Withdraw NFT (burn 20 SCC and reclaim)
    - SCC balance display
    - Gas estimate + tx status feedback

- **Hook**: `webapp/src/hooks/useVault.ts`
    - `useDepositNFT(tokenId)` → deposit NFT, mint 20 SCC
    - `useWithdrawNFT(tokenId)` → burn 20 SCC, reclaim NFT
    - `useUserLoans()` → active positions
    - `useVaultStats()` → total active loans, SCC supply
    - Transaction state: pending, success, error

**Integration Points**

- `webapp/src/app/mytokens/page.tsx` references `VaultCard`
- `webapp/src/components/Header.tsx` shows SCC balance
- ABIs in `webapp/src/config/`

**UI Requirements**

- Deposit: Select un‑redeemed NFT → confirm → mint 20 SCC
- Withdraw: Select vaulted NFT → approve 20 SCC burn → reclaim NFT
- Errors: redeemed NFT rejection, insufficient SCC
- Gas estimation before execution
- Loading states during pending/confirmation

---

## 9 │ Production Deployment

**Priority: Medium | Estimate: 1–2 days**

Tasks

- Deploy SCC to Base Mainnet
- Deploy EcoStabilizer to Base Mainnet
- Grant `MINTER_ROLE` to EcoStabilizer
- Renounce admin roles
- Update `webapp/src/app.config.ts` with mainnet addresses
- Verify on Base Explorer

Pre‑Deployment Checklist

- Run `npm run verify:deploy` (all tests + webapp build)
- Audit final contract code
- Prepare deployment tx sequence
- Fund deployer for gas
- Test on Base Sepolia first

---

## 10 │ Implementation Guide

Getting Started

```bash
# Ensure environment is ready
npm run verify:deploy

# Start webapp development
npm run webapp:dev

# Test vault integration locally
npm run task:mint:local
```

Key Technical Details

- Contract addresses configured in `webapp/src/app.config.ts`
- Important constants:
    - `SCC_PER_ASSET = 20 * 1e18`
    - `MAX_SUPPLY = 1_000_000_000 * 1e18`

Security Considerations

- Only un‑redeemed NFTs can be deposited
- Exact‑NFT recovery, no liquidations
- Burns must equal minted amount (20 SCC per NFT)

Testing Flow

1. `npm run task:mint:local` to mint test NFTs
2. Connect wallet to localhost:3000
3. Deposit → receive 20 SCC
4. Withdraw → burn 20 SCC → reclaim NFT
5. Try depositing redeemed NFT (should revert)

Gas Targets

- Deposit: < 165,000 gas (enforced)
- Withdraw: < 120,000 gas (enforced)

---

## 11 │ Definition of Done

Frontend complete when

- Users can deposit un‑redeemed NFTs via UI
- Users can withdraw NFTs by burning SCC via UI
- Vault positions display correctly in `MyTokens`
- SCC balance updates in header after txs
- Error handling covers edge cases
- Gas estimation shown pre‑tx
- Loading states provide good UX

Production ready when

- Contracts deployed to Base Mainnet
- Webapp connected to mainnet contracts
- Functionality tested on mainnet
- User documentation published

---

## 12 │ References

- Canonical overview: root `README.md`
- Smart Contracts: `contracts/EcoStabilizer.sol`, `contracts/StabilizedCarbonCoin.sol`
- Tests: `test/EcoStabilizer.ts`, `test/IntegrationPhase1Phase2.ts`, `test/SCCInvariants.ts`
- Deployment: `deploy/deploy_ecostabilizer.ts`
- Webapp config: `webapp/src/app.config.ts`, `webapp/src/lib/contracts.ts`
- ABIs: `webapp/src/config/EcoStabilizer.json`, `webapp/src/config/StabilizedCarbonCoin.json`
