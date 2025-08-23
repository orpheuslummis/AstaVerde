# AstaVerde Phase 2 - QA Testing Guide & Checklist

Welcome! This comprehensive guide will help you test the new EcoStabilizer vault system on the Base Sepolia testnet.

## 🚀 Quick Start (5 minutes)

### 1. Setup MetaMask Wallet

1. Install MetaMask browser extension from [metamask.io](https://metamask.io)
2. Create or import a wallet
3. **Add Base Sepolia Network** - Click "Add Network" and use these settings:
   - Network Name: `Base Sepolia`
   - RPC URL: `https://sepolia.base.org`
   - Chain ID: `84532`
   - Currency Symbol: `ETH`
   - Explorer: `https://sepolia.basescan.org`

### 2. Get Test Funds

You'll need test ETH for transactions and test USDC for purchases:

1. **Get Test ETH** (for gas fees):
   - Visit: https://www.alchemy.com/faucets/base-sepolia
   - Enter your wallet address
   - Receive 0.1 ETH (enough for many transactions)

2. **Get Test USDC** (optional, for buying NFTs):
   - Will be provided separately if needed for testing
   - Contact support if you need test USDC

### 3. Access the Test App

🌐 **Test URL**: [To be provided after deployment]

Connect your wallet when prompted. Make sure you're on Base Sepolia network!

## 📋 What You're Testing

The **EcoStabilizer Vault** allows users to:
- **Deposit** carbon offset NFTs to receive 20 SCC tokens (loan)
- **Withdraw** their exact NFT by repaying 20 SCC tokens

Think of it like a pawn shop for NFTs - you get an instant loan and can always get your exact item back.

## 🧪 Test Scenarios

### Scenario 1: Basic Deposit ✅

**Goal**: Deposit an NFT and receive SCC tokens

1. Go to "My Tokens" page
2. Find an NFT you own that shows "Deposit" button
3. Click "Deposit"
4. Approve the transaction in MetaMask (2 transactions: approval + deposit)
5. **Expected Result**: 
   - NFT shows "In Vault" status
   - Your SCC balance increases by 20
   - "Withdraw" button appears

### Scenario 2: Basic Withdrawal ✅

**Goal**: Get your NFT back from the vault

1. Make sure you have at least 20 SCC tokens
2. Find your vaulted NFT (shows "Withdraw" button)
3. Click "Withdraw"
4. Approve the transaction in MetaMask (may be 2 transactions)
5. **Expected Result**:
   - NFT returns to your wallet
   - 20 SCC deducted from balance
   - "Deposit" button reappears

### Scenario 3: Redeemed NFT Protection ❌

**Goal**: Verify redeemed NFTs cannot be deposited

1. Find an NFT marked as "Redeemed"
2. Check that NO deposit button appears
3. **Expected Result**: Redeemed NFTs should not have vault options

### Scenario 4: Insufficient SCC ⚠️

**Goal**: Test withdrawal with insufficient funds

1. Ensure you have less than 20 SCC
2. Try to withdraw a vaulted NFT
3. **Expected Result**: 
   - Button shows "Need 20 SCC" or similar
   - Transaction should not proceed

---

## ✅ Testing Checklist

Use this checklist to systematically test all features. Check off items as you complete them.

### 🔧 Setup Verification

- [ ] MetaMask installed and configured
- [ ] Connected to Base Sepolia network
- [ ] Test wallet funded with ETH (minimum 0.05 ETH)
- [ ] Webapp loads without errors
- [ ] Wallet connects successfully

### Core Functionality Tests

#### 1. NFT Display
- [ ] **My Tokens page loads** → Shows owned NFTs
- [ ] **NFT metadata displays** → Title, image, carbon credits visible
- [ ] **Vault status shows** → "Deposit" or "In Vault" status clear
- [ ] **SCC balance visible** → Header shows current SCC balance

#### 2. Deposit Flow
- [ ] **Deposit button enabled** → For unredeemed NFTs only
- [ ] **Approval request** → MetaMask prompts for NFT approval
- [ ] **Deposit transaction** → Second transaction for actual deposit
- [ ] **Success confirmation** → Toast/message shows success
- [ ] **NFT status updates** → Changes to "In Vault"
- [ ] **SCC balance increases** → +20 SCC added to balance
- [ ] **Withdraw button appears** → Replaces deposit button

#### 3. Withdraw Flow
- [ ] **Withdraw button enabled** → When user has 20+ SCC
- [ ] **SCC approval** → Prompts if not pre-approved
- [ ] **Withdraw transaction** → Burns SCC and returns NFT
- [ ] **Success confirmation** → Clear success message
- [ ] **NFT status updates** → Returns to normal state
- [ ] **SCC balance decreases** → -20 SCC from balance
- [ ] **Deposit button returns** → Can re-deposit if desired

### Error Handling Tests

#### 4. Redeemed NFT Protection
- [ ] **No deposit option** → Redeemed NFTs have no vault button
- [ ] **Clear indication** → Shows "Redeemed" status
- [ ] **Tooltip/help text** → Explains why not eligible

#### 5. Insufficient Balance
- [ ] **Withdraw disabled** → When SCC < 20
- [ ] **Clear message** → "Need 20 SCC" or similar
- [ ] **Balance shown** → Current SCC balance visible

#### 6. Transaction Failures
- [ ] **User rejection** → Canceling in MetaMask handled gracefully
- [ ] **Network errors** → Timeout/failure messages are clear
- [ ] **Retry option** → Can attempt transaction again

### UI/UX Tests

#### 7. Visual Feedback
- [ ] **Loading states** → Spinners during transactions
- [ ] **Disabled states** → Buttons properly disabled when processing
- [ ] **Success indicators** → Green checkmarks or success toasts
- [ ] **Error styling** → Red text/borders for errors

#### 8. Responsiveness
- [ ] **Mobile view** → Works on phone-sized screens
- [ ] **Tablet view** → Proper layout on tablets
- [ ] **Desktop view** → Full experience on desktop
- [ ] **Touch interactions** → Buttons work on touch devices

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

### Multi-Wallet Testing

#### 13. Wallet Compatibility
- [ ] **MetaMask** → Full functionality
- [ ] **WalletConnect** → Mobile wallets work
- [ ] **Coinbase Wallet** → If supported
- [ ] **Rainbow** → If supported

### Performance Tests

#### 14. Load Times
- [ ] **Initial load** → Under 5 seconds
- [ ] **NFT loading** → Images load within 3 seconds
- [ ] **Transaction speed** → Reasonable confirmation times
- [ ] **No memory leaks** → App remains responsive

#### 15. Gas Optimization
- [ ] **Deposit gas** → Under 200k gas units
- [ ] **Withdraw gas** → Under 150k gas units
- [ ] **Gas estimates** → Shown before confirmation
- [ ] **Gas price** → Reasonable for Base network

---

## 🐛 Reporting Issues

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
[Link from BaseScan]
```

### Where to Report
- Email: [Contact email]
- Or use the feedback form in the app

---

## ❓ Common Issues & Solutions

### "Transaction Failed"
- ✅ Check you have enough ETH for gas (need ~0.01 ETH)
- ✅ Make sure you're on Base Sepolia network
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

---

## 🎯 Success Metrics & Definition of Done

### Success Metrics
A successful test means:
- ✅ You can deposit an unredeemed NFT
- ✅ You receive exactly 20 SCC tokens
- ✅ You can withdraw your NFT by repaying 20 SCC
- ✅ Redeemed NFTs cannot be deposited
- ✅ Error messages are clear and helpful

### Definition of Done
The vault system is ready for production when:
- [ ] All core functionality tests pass
- [ ] No critical bugs found
- [ ] Error messages are clear and helpful
- [ ] UI is responsive and intuitive
- [ ] Gas costs are acceptable
- [ ] Multiple wallets tested successfully

## 💡 Tips for Testing

- Start with one NFT to understand the flow
- Keep track of your SCC balance
- Try both successful and failing scenarios
- Test on different devices if possible
- Take screenshots of any issues

## 📞 Need Help?

- **Stuck?** Check the Common Issues section above
- **Need test funds?** Contact support
- **Found a bug?** Use the bug report template
- **Questions?** Email [support email]

---

Thank you for helping test AstaVerde Phase 2! Your feedback is invaluable. Please submit this completed checklist along with any bug reports. 🙏