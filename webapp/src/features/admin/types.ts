export interface AdminControls {
  setPriceDelta: (amount: bigint) => Promise<string>;
  setDailyPriceDecay: (amount: bigint) => Promise<string>;
  pauseContract: () => Promise<string>;
  unpauseContract: () => Promise<string>;
  claimPlatformFunds: (recipient: string) => Promise<string>;
  setPriceFloor: (amount: string) => Promise<void>;
  setBasePrice: (amount: bigint) => Promise<void>;
  setMaxBatchSize: (size: bigint) => Promise<void>;
  setAuctionDayThresholds: (increase: string, decrease: string) => Promise<void>;
  setPlatformSharePercentage: (percentage: string) => Promise<void>;
  setURI: (uri: string) => Promise<void>;
  mintBatch: (producers: string[], cids: string[]) => Promise<string>;
}

export interface AdminPanelProps {
  controls: AdminControls;
  isAdmin: boolean;
}
