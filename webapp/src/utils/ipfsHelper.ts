import { ENV } from "../config/environment";
import {
  FALLBACK_IPFS_GATEWAY_URL,
  CLOUDFLARE_IPFS_GATEWAY_URL,
  WEB3_STORAGE_GATEWAY_HOST_CONSTRUCTION,
  WEB3_STORAGE_GATEWAY_PREFIX,
  WEB3_STORAGE_GATEWAY_SUFFIX,
} from "../config/constants";

export interface TokenMetadata {
  name: string;
  description: string;
  producer_address: string;
  image: File | null;
}

let cachedW3Client: unknown | null = null;
export async function initializeWeb3StorageClient() {
  try {
    if (cachedW3Client) return cachedW3Client;
    const { create } = await import("@web3-storage/w3up-client");
    cachedW3Client = await create();
    return cachedW3Client;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to load Web3Storage client:", error);
    throw error;
  }
}

export async function uploadToIPFS(client: unknown, content: File | string, contentType: string): Promise<string> {
  if (!client) {
    throw new Error("Web3Storage client is not initialized");
  }
  try {
    const blob = content instanceof File ? content : new Blob([content], { type: contentType });
    const cid = await client.uploadFile(blob);
    return cid.toString();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error in uploadToIPFS:", error);
    throw new Error(`Failed to upload to IPFS: ${(error as Error).message}`);
  }
}

export async function connectToSpace(client: unknown, email: string, spaceName: string) {
  if (!client) {
    throw new Error("Web3Storage client is not initialized");
  }
  try {
    const userAccount = await client.login(email);
    const space = await client.createSpace(spaceName);
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for plan selection
    await userAccount.provision(space.did());
    await space.createRecovery(userAccount.did());
    await space.save();
    await client.setCurrentSpace(space.did());
    return client;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error connecting to space:", error);
    throw error;
  }
}

export async function fetchJsonFromIpfsWithFallback(
  cidOrUri: string,
): Promise<{ data: unknown; gateway: string } | null> {
  const cid = cidOrUri.replace("ipfs://", "");

  // Simple fetch with timeout support
  async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }

  // Retry helper with small jittered backoff
  async function tryGateway(baseUrl: string, label: string, timeoutMs: number, retries = 1) {
    const url = `${baseUrl}${cid}`;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetchWithTimeout(url, timeoutMs);
        if (res.ok) {
          const data = await res.json();
          return { data, gateway: baseUrl } as const;
        }
        lastErr = new Error(`${label} responded ${res.status}`);
      } catch (e) {
        lastErr = e;
      }
      // jitter 150–450ms between attempts
      if (attempt < retries) {
        const jitter = 150 + Math.floor(Math.random() * 300);
        await new Promise((r) => setTimeout(r, jitter));
      }
    }
    // eslint-disable-next-line no-console
    console.warn(`${label} failed for ${cid}:`, lastErr);
    return null;
  }

  // For local development, return mock metadata instead of trying external gateways
  if (ENV.CHAIN_SELECTION === "local") {
    // Generate different mock data based on the CID to simulate variety
    // Extract the actual number from CIDs like QmTest1, QmTest2, QmVault1, etc.
    const extractedNumber = cid.match(/(\d+)$/)?.[1] || "1";
    const isVault = cid.includes("Vault");
    const isExtra = cid.includes("Extra");
    const mockNumber = isVault ? "V" : extractedNumber;

    // Create different visual patterns for variety
    const patterns = {
      "1": {
        gradient: ["#667eea", "#764ba2"], // Purple gradient
        pattern: "circles",
      },
      "2": {
        gradient: ["#f093fb", "#f5576c"], // Pink gradient
        pattern: "waves",
      },
      "3": {
        gradient: ["#4facfe", "#00f2fe"], // Blue gradient
        pattern: "triangles",
      },
      V: {
        gradient: ["#fa709a", "#fee140"], // Sunset gradient
        pattern: "hexagon",
      },
    };

    const style = patterns[mockNumber] || patterns["1"];

    const renderPatternMarkup = (pattern: string) => {
      switch (pattern) {
        case "circles":
          return `
                            <circle cx="20" cy="20" r="3" fill="white" opacity="0.3"/>
                            <circle cx="0" cy="0" r="3" fill="white" opacity="0.3"/>
                            <circle cx="40" cy="0" r="3" fill="white" opacity="0.3"/>
                            <circle cx="0" cy="40" r="3" fill="white" opacity="0.3"/>
                            <circle cx="40" cy="40" r="3" fill="white" opacity="0.3"/>
                        `;
        case "waves":
          return `
                            <path d="M0,20 Q10,10 20,20 T40,20" stroke="white" stroke-width="2" fill="none" opacity="0.3"/>
                            <path d="M0,30 Q10,20 20,30 T40,30" stroke="white" stroke-width="2" fill="none" opacity="0.3"/>
                        `;
        case "triangles":
          return `
                            <polygon points="20,5 30,25 10,25" fill="white" opacity="0.2"/>
                            <polygon points="0,25 10,5 -10,5" fill="white" opacity="0.2"/>
                            <polygon points="40,25 50,5 30,5" fill="white" opacity="0.2"/>
                        `;
        default:
          return `
                            <polygon points="20,5 35,15 35,35 20,45 5,35 5,15" fill="none" stroke="white" stroke-width="1" opacity="0.3"/>
                        `;
      }
    };

    // Generate a more interesting SVG with patterns and gradients
    const svgString = `
            <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:${style.gradient[0]};stop-opacity:1" />
                        <stop offset="100%" style="stop-color:${style.gradient[1]};stop-opacity:1" />
                    </linearGradient>
                    <pattern id="pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                        ${renderPatternMarkup(style.pattern)}
                    </pattern>
                </defs>
                <rect width="400" height="400" fill="url(#grad)"/>
                <rect width="400" height="400" fill="url(#pattern)"/>
                <circle cx="200" cy="200" r="80" fill="white" opacity="0.2"/>
                <text x="50%" y="45%" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" opacity="0.9">CO2</text>
                <text x="50%" y="58%" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle" opacity="0.8">OFFSET</text>
                <text x="50%" y="70%" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">#${isVault ? `V-${extractedNumber}` : isExtra ? `E-${extractedNumber}` : extractedNumber}</text>
            </svg>
        `;
    // Properly encode the SVG string to handle UTF-8 characters
    const svgImage = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;

    const tokenId = isVault ? `V-${extractedNumber}` : isExtra ? `E-${extractedNumber}` : extractedNumber;

    const mockData = {
      name: `Carbon Offset #${tokenId}`,
      description:
        "Test carbon offset NFT for local development. This represents verified carbon credits from renewable energy projects.",
      image: svgImage,
      producer_address: "0x1234567890123456789012345678901234567890",
      external_url: `https://example.com/token/${cid}`,
      attributes: [
        { trait_type: "Type", value: "Carbon Offset" },
        { trait_type: "Token ID", value: tokenId },
        { trait_type: "Status", value: "Active" },
      ],
    };

    return { data: mockData, gateway: "local-mock" };
  }

  // Try primary gateway (slightly longer timeout; 1 retry)
  const primary = await tryGateway(ENV.IPFS_GATEWAY_URL, "primary", 5000, 1);
  if (primary) return primary;

  // Try web3.storage gateway (second attempt)
  if (WEB3_STORAGE_GATEWAY_HOST_CONSTRUCTION) {
    // For host-style gateway, the full URL is https://<cid>.ipfs.w3s.link/
    // We must NOT append the CID again to the path.
    const web3StorageGatewayUrl = `${WEB3_STORAGE_GATEWAY_PREFIX}${cid}${WEB3_STORAGE_GATEWAY_SUFFIX}`;
    try {
      const res = await fetchWithTimeout(web3StorageGatewayUrl, 5000);
      if (res.ok) {
        const data = await res.json();
        const u = new URL(web3StorageGatewayUrl);
        const gatewayBase = `${u.protocol}//${u.hostname}/`;
        return { data, gateway: gatewayBase } as const;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("w3s.link host gateway failed", e);
    }
  }

  // Try fallback gateway (third attempt)
  const fallback = await tryGateway(FALLBACK_IPFS_GATEWAY_URL, "fallback", 5000, 1);
  if (fallback) return fallback;

  // Try Cloudflare IPFS gateway (fourth attempt)
  const cloudflare = await tryGateway(CLOUDFLARE_IPFS_GATEWAY_URL, "cloudflare", 5000, 1);
  if (cloudflare) return cloudflare;

  return null;
}

export function resolveIpfsUriToUrl(ipfsUri: string | undefined | null, gateway?: string): string {
  // For local mock data or data URLs, return as-is
  if (gateway === "local-mock" || (ipfsUri && ipfsUri.startsWith("data:"))) {
    return ipfsUri || "";
  }

  // Fallback to default configured gateway if none provided
  const effectiveGateway = gateway || ENV.IPFS_GATEWAY_URL;

  if (ipfsUri && ipfsUri.startsWith("ipfs://")) {
    const cid = ipfsUri.replace("ipfs://", "");
    // Handle subdomain gateway structure if the provided gateway is a base for it (e.g., "https://*.ipfs.w3s.link/")
    // This is a simplified check. A more robust solution might involve checking specific hostnames.
    if (effectiveGateway.includes(".w3s.link")) {
      // Check if it's the w3s.link special gateway
      return `${WEB3_STORAGE_GATEWAY_PREFIX}${cid}${WEB3_STORAGE_GATEWAY_SUFFIX}`;
    } else {
      return `${effectiveGateway}${cid}`;
    }
  }
  return ipfsUri || "";
}
