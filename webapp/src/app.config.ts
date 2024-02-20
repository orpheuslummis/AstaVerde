export const metadata = {
	title: "wagmi",
};

export const USDC_DECIMALS = 6;

export const navigationLinks = [
	{ name: "Everything about EcoAssets", url: "/ecoassets" },
	{ name: "Market", url: "/" },
	{ name: "Redeem", url: "/mytokens" },
	{ name: "About", url: "/about" },
];

export const IPFS_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs/";

export const CHAIN_SELECTION =
	process.env.NEXT_PUBLIC_CHAIN_SELECTION || process.env.CHAIN_SELECTION;
console.log("config: CHAIN_SELECTION", CHAIN_SELECTION);

export const DEFAULT_IMAGE_URL = "/default_token_image.webp";
