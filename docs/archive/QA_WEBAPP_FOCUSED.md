# AstaVerde Webapp-Focused QA Guide

## What's Already Tested (Skip These)

Our automated test suite (171 passing tests) already covers:

- ✅ Contract logic: deposit, withdraw, redemption, access control
- ✅ Security: reentrancy, redeemed NFT rejection, role management
- ✅ Gas optimization: deposit <165k, withdraw <120k
- ✅ Edge cases: insufficient funds, zero amounts, invalid inputs
- ✅ Math correctness: 20 SCC per NFT, price calculations

## What Needs Manual Webapp Testing

Focus on **USER EXPERIENCE** and **UI INTERACTIONS** that automated tests cannot verify.

## Critical Webapp-Only Test Scenarios

### 1. Wallet Connection Flow

**NOT tested by automated tests**

**Test with MetaMask:**

1. First-time connection
    - Click "Connect Wallet"
    - MetaMask popup appears
    - Select account and approve
    - Verify address shows in header
    - Verify correct network (localhost)

2. Wrong network handling
    - Switch to mainnet in MetaMask
    - Verify warning message appears
    - Click "Switch Network" button
    - Verify auto-switches to localhost

3. Account switching
    - Change account in MetaMask
    - Verify UI updates immediately
    - Verify balances refresh
    - Verify "My Tokens" updates

4. Disconnect/Reconnect
    - Disconnect wallet
    - Verify UI shows disconnected state
    - Reconnect
    - Verify previous state restored

### 2. Real-Time UI Updates

**NOT tested by automated tests**

**Test dynamic updates:**

1. Multi-tab synchronization
    - Open app in 2 browser tabs
    - Buy NFT in tab 1
    - Verify tab 2 updates without refresh

2. Transaction feedback
    - Submit transaction
    - Verify loading spinner appears
    - Verify toast notifications show
    - Verify success/error messages clear
    - Verify button states during pending

3. Balance updates
    - After NFT purchase → USDC balance updates
    - After vault deposit → SCC balance in header updates
    - After withdrawal → both balances update

### 3. User Journey Completeness

**NOT tested by automated tests**

**Test complete flows:**

#### Journey A: New User Onboarding

1. Land on homepage (no wallet)
2. Read project description
3. Click "Get Started"
4. Connect wallet
5. Navigate to marketplace
6. Filter/sort NFTs
7. View NFT details
8. Make first purchase
9. Check "My Tokens"
10. Explore vault option

#### Journey B: Returning User Vault Flow

1. Connect wallet (Alice with NFTs)
2. Go to "My Tokens"
3. See owned NFTs with vault status
4. Deposit unredeemed NFT
5. See SCC balance update in header
6. Try to deposit redeemed NFT (should show disabled)
7. Withdraw NFT using SCC
8. Verify NFT back in wallet

### 4. Error Recovery & Edge Cases

**NOT tested by automated tests**

**Test error handling:**

1. MetaMask rejection
    - Reject transaction in MetaMask
    - Verify graceful error handling
    - Verify can retry

2. Network interruption
    - Disconnect network mid-transaction
    - Verify timeout handling
    - Reconnect and verify state

3. Concurrent actions
    - Open 2 accounts in different browsers
    - Both try to buy same NFT
    - Verify loser gets clear error
    - Verify can proceed with other NFT

### 5. Visual & Responsive Design

**NOT tested by automated tests**

**Test on devices:**

#### Mobile (375x667)

- Hamburger menu works
- Cards stack vertically
- Buttons are tap-friendly
- Modals fit screen
- No horizontal scroll

#### Tablet (768x1024)

- Grid layouts adjust
- Sidebar navigation
- Touch interactions work

#### Desktop (1920x1080)

- Full layout visible
- Hover states work
- Tooltips appear

#### Dark Mode

- Toggle dark/light mode
- All text readable
- Contrast sufficient
- Images visible

### 6. Data Display & Formatting

**NOT tested by automated tests**

**Verify display formats:**

1. Token amounts
    - USDC shows 6 decimals correctly
    - SCC shows 18 decimals correctly
    - Large numbers abbreviated (1.5M)

2. Addresses
    - Truncated format (0x1234...5678)
    - Copy button works
    - Links to explorer work

3. Timestamps
    - Relative time (2 hours ago)
    - Hover shows full date
    - Timezone correct

4. Status indicators
    - Available/Sold/Redeemed badges
    - In Vault status clear
    - Loading states obvious

### 7. Navigation & Routing

**NOT tested by automated tests**

**Test navigation:**

1. Direct URL access
    - `/marketplace` loads correctly
    - `/token/123` shows token details
    - `/mytokens` requires wallet
    - Invalid routes show 404

2. Browser back/forward
    - Navigation history works
    - State preserved
    - No duplicate entries

3. Deep linking
    - Share token URL
    - Opens in new browser
    - Shows correct token

### 8. Performance & UX Polish

**NOT tested by automated tests**

**Measure user experience:**

1. Page load performance
    - Time to interactive <3s
    - No layout shift
    - Images lazy load

2. Interaction responsiveness
    - Button clicks immediate
    - No double-click issues
    - Form validation instant

3. Search & Filter
    - Results update as typing
    - Filters combine correctly
    - Clear filters works

## Quick Validation Checklist

### ✅ Wallet Integration

- [ ] Connect/disconnect smooth
- [ ] Network switching works
- [ ] Account changes reflect
- [ ] Transaction signing clear

### ✅ User Feedback

- [ ] Loading states visible
- [ ] Success messages clear
- [ ] Error messages helpful
- [ ] Progress indicators work

### ✅ Data Accuracy

- [ ] Balances match blockchain
- [ ] NFT metadata displays
- [ ] Prices calculate correctly
- [ ] Status badges accurate

### ✅ Mobile Experience

- [ ] Touch targets 44px+
- [ ] No pinch zoom needed
- [ ] Modals accessible
- [ ] Forms usable

### ✅ Accessibility

- [ ] Keyboard navigation works
- [ ] Screen reader friendly
- [ ] Color contrast sufficient
- [ ] Focus indicators visible

## Test Execution Tips

1. **Use Real Wallets**: Test with actual MetaMask, not just automated scripts
2. **Test Cross-Browser**: Chrome, Firefox, Safari, Edge
3. **Simulate Real Users**: Click around naturally, not just happy paths
4. **Check Console**: No errors or warnings in browser console
5. **Network Tab**: Verify API calls succeed, no failed requests

## What NOT to Test (Already Covered)

Don't waste time manually testing:

- Contract math (20 SCC = 1 NFT)
- Access control (who can withdraw)
- Gas limits (automated tests verify)
- Reentrancy protection
- Role permissions
- Token transfers
- Supply caps

## Bug Reporting Focus

For webapp issues, include:

- Browser/version
- Wallet type
- Screenshots
- Console errors
- Network requests
- Steps to reproduce

## Success Criteria

Webapp QA passes when:

1. All user journeys completable
2. No UI/UX blockers
3. Responsive on all devices
4. Clear error messages
5. Smooth wallet integration
6. Fast page loads
7. Intuitive navigation
