export default function Page() {
  return (
    <>
      <div>
        <h2>
          EcoTradeZone
        </h2>
        <p>
          EcoTradeZone revolutionizes the way biochar production is valued and traded. It stands as a unique marketplace where the diligent work of biochar producers is transformed into tangible tokens, each representing their creation. These tokens are not just symbolic; they embody the genuine environmental impact of the producers' efforts, quantified as one tonne of carbon dioxide equivalent. At EcoTradeZone, these tokens can be both purchased and redeemed, offering a direct and meaningful way to participate in climate action. This system not only incentivizes biochar production but also connects the efforts of producers with individuals and organizations eager to contribute to global carbon reduction. By making each token a claimable representation of a real-world environmental benefit, EcoTradeZone fosters a new, eco-conscious economy where sustainable practices are both recognized and rewarded.
        </p>
      </div>

      <div>
        <h2>Bug Report</h2>
        <p>Please tell us about any bugs you find, we want to keep this place running smoothly to help producers get their earnings</p>
        <button>Bug report link</button>
      </div>

      <div>
        <h2>FAQ</h2>
        <p>
          Q: Why don't the Ethereums work here to buy EcoAssets?
          <br />
          A: This is on the Base network, which runs in parallel to the main Ethereum network and has responsibilities to it in terms of its data integrity. But this means that you need the currencies that are used on this Base network. Coinbase wallets work natively with Base and the currency that you purchase in is USDC so make sure that the currency you have on your base network wallet.
        </p>
      </div>
    </>
  );
}
