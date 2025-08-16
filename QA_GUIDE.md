# AstaVerde Phase 2 - QA Testing Guide

Welcome! This guide will help you test the new EcoStabilizer vault system on the Base Sepolia testnet.

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

## 📊 What We're Looking For

Please pay attention to:

1. **Functionality**: Do all features work as described?
2. **User Experience**: Is it clear what to do?
3. **Error Messages**: Are errors helpful and clear?
4. **Performance**: Any slow loading or delays?
5. **Mobile**: Does it work on mobile wallets?

## 🎯 Success Metrics

A successful test means:
- ✅ You can deposit an unredeemed NFT
- ✅ You receive exactly 20 SCC tokens
- ✅ You can withdraw your NFT by repaying 20 SCC
- ✅ Redeemed NFTs cannot be deposited
- ✅ Error messages are clear and helpful

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

Thank you for helping test AstaVerde Phase 2! Your feedback is invaluable. 🙏