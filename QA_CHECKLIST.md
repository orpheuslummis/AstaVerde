# AstaVerde Phase 2 - QA Testing Checklist

Use this checklist to systematically test the EcoStabilizer vault system. Check off items as you complete them.

## 🔧 Setup Verification

- [ ] MetaMask installed and configured
- [ ] Connected to Base Sepolia network
- [ ] Test wallet funded with ETH (minimum 0.05 ETH)
- [ ] Webapp loads without errors
- [ ] Wallet connects successfully

## ✅ Core Functionality Tests

### 1. NFT Display
- [ ] **My Tokens page loads** → Shows owned NFTs
- [ ] **NFT metadata displays** → Title, image, carbon credits visible
- [ ] **Vault status shows** → "Deposit" or "In Vault" status clear
- [ ] **SCC balance visible** → Header shows current SCC balance

### 2. Deposit Flow
- [ ] **Deposit button enabled** → For unredeemed NFTs only
- [ ] **Approval request** → MetaMask prompts for NFT approval
- [ ] **Deposit transaction** → Second transaction for actual deposit
- [ ] **Success confirmation** → Toast/message shows success
- [ ] **NFT status updates** → Changes to "In Vault"
- [ ] **SCC balance increases** → +20 SCC added to balance
- [ ] **Withdraw button appears** → Replaces deposit button

### 3. Withdraw Flow
- [ ] **Withdraw button enabled** → When user has 20+ SCC
- [ ] **SCC approval** → Prompts if not pre-approved
- [ ] **Withdraw transaction** → Burns SCC and returns NFT
- [ ] **Success confirmation** → Clear success message
- [ ] **NFT status updates** → Returns to normal state
- [ ] **SCC balance decreases** → -20 SCC from balance
- [ ] **Deposit button returns** → Can re-deposit if desired

## ❌ Error Handling Tests

### 4. Redeemed NFT Protection
- [ ] **No deposit option** → Redeemed NFTs have no vault button
- [ ] **Clear indication** → Shows "Redeemed" status
- [ ] **Tooltip/help text** → Explains why not eligible

### 5. Insufficient Balance
- [ ] **Withdraw disabled** → When SCC < 20
- [ ] **Clear message** → "Need 20 SCC" or similar
- [ ] **Balance shown** → Current SCC balance visible

### 6. Transaction Failures
- [ ] **User rejection** → Canceling in MetaMask handled gracefully
- [ ] **Network errors** → Timeout/failure messages are clear
- [ ] **Retry option** → Can attempt transaction again

## 🎨 UI/UX Tests

### 7. Visual Feedback
- [ ] **Loading states** → Spinners during transactions
- [ ] **Disabled states** → Buttons properly disabled when processing
- [ ] **Success indicators** → Green checkmarks or success toasts
- [ ] **Error styling** → Red text/borders for errors

### 8. Responsiveness
- [ ] **Mobile view** → Works on phone-sized screens
- [ ] **Tablet view** → Proper layout on tablets
- [ ] **Desktop view** → Full experience on desktop
- [ ] **Touch interactions** → Buttons work on touch devices

### 9. Navigation
- [ ] **Page transitions** → Smooth navigation between pages
- [ ] **Back button** → Browser back works correctly
- [ ] **Refresh handling** → State persists after refresh
- [ ] **Deep links** → Direct URLs work (if applicable)

## 🔄 Edge Cases

### 10. Rapid Actions
- [ ] **Double-click prevention** → Can't submit twice
- [ ] **Quick navigation** → Leaving page during transaction
- [ ] **Multiple tabs** → Having app open in multiple tabs

### 11. Wallet Switching
- [ ] **Account change** → App updates when switching accounts
- [ ] **Network change** → Warning when wrong network
- [ ] **Disconnect/reconnect** → Handles wallet disconnection

### 12. Data Edge Cases
- [ ] **0 NFTs owned** → Appropriate empty state
- [ ] **Many NFTs** → Pagination or scrolling works
- [ ] **Mixed states** → Some vaulted, some not, some redeemed

## 📱 Multi-Wallet Testing

### 13. Wallet Compatibility
- [ ] **MetaMask** → Full functionality
- [ ] **WalletConnect** → Mobile wallets work
- [ ] **Coinbase Wallet** → If supported
- [ ] **Rainbow** → If supported

## 🚀 Performance Tests

### 14. Load Times
- [ ] **Initial load** → Under 5 seconds
- [ ] **NFT loading** → Images load within 3 seconds
- [ ] **Transaction speed** → Reasonable confirmation times
- [ ] **No memory leaks** → App remains responsive

### 15. Gas Optimization
- [ ] **Deposit gas** → Under 200k gas units
- [ ] **Withdraw gas** → Under 150k gas units
- [ ] **Gas estimates** → Shown before confirmation
- [ ] **Gas price** → Reasonable for Base network

## 📊 Test Results Summary

### Pass/Fail Totals
- **Passed**: ___ / 50
- **Failed**: ___ / 50
- **Blocked**: ___ / 50
- **Not Tested**: ___ / 50

### Critical Issues Found
1. ________________________________
2. ________________________________
3. ________________________________

### Minor Issues Found
1. ________________________________
2. ________________________________
3. ________________________________

### Suggestions for Improvement
1. ________________________________
2. ________________________________
3. ________________________________

## 📝 Additional Notes

_Space for any additional observations, questions, or feedback:_

---

**Tester Name**: _______________
**Date**: _______________
**Wallet Address**: _______________
**Browser/Device**: _______________

## 🎯 Definition of Done

The vault system is ready for production when:
- [ ] All core functionality tests pass
- [ ] No critical bugs found
- [ ] Error messages are clear and helpful
- [ ] UI is responsive and intuitive
- [ ] Gas costs are acceptable
- [ ] Multiple wallets tested successfully

---

Thank you for your thorough testing! Please submit this completed checklist along with any bug reports.