import { ENV } from "../config/environment";
import { buildUploadAuthorizationMessage } from "./uploadAuth";

export interface TokenMetadata {
  name: string;
  description: string;
  producer_address: string;
  image: File | null;
}

// Upload authorization: the owner signs one message per mint (see uploadAuth.ts);
// the server route checks it and issues a short-lived Pinata signed URL per file.
export interface UploadAuthorization {
  address: string;
  message: string;
  signature: string;
}

export function createUploadAuthorizationMessage(chainId: number, contract: string): string {
  return buildUploadAuthorizationMessage(chainId, contract, Math.floor(Date.now() / 1000));
}

export interface UploadKeyStatus {
  configured: boolean;
  expiresAt: string | null;
  gateway: string | null;
}

export async function fetchUploadKeyStatus(): Promise<UploadKeyStatus> {
  const res = await fetch("/api/ipfs/upload-url", { method: "GET", cache: "no-store" });
  if (!res.ok) throw new Error(`Upload status check failed (${res.status})`);
  return (await res.json()) as UploadKeyStatus;
}

async function requestSignedUploadUrl(auth: UploadAuthorization, filename: string): Promise<string> {
  const res = await fetch("/api/ipfs/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...auth, filename }),
  });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) {
    throw new Error(body.error || `Upload authorization failed (${res.status})`);
  }
  return body.url;
}

// Uploads one file (or a JSON string) to IPFS through the storage provider and
// returns its CID. Throws with a readable message on any failure.
export async function uploadToIPFS(
  auth: UploadAuthorization,
  content: File | string,
  contentType: string,
  filename: string,
): Promise<string> {
  const blob = content instanceof File ? content : new Blob([content], { type: contentType });
  const url = await requestSignedUploadUrl(auth, filename);
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("network", "public");
  const res = await fetch(url, { method: "POST", body: form });
  const body = (await res.json().catch(() => ({}))) as { data?: { cid?: string }; error?: unknown };
  const cid = body.data?.cid;
  if (!res.ok || !cid) {
    throw new Error(`Failed to upload ${filename} to IPFS (${res.status})`);
  }
  return cid;
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

  // Gateways come from the environment only; no provider hostnames in code.
  const gateways = [ENV.IPFS_GATEWAY_URL, ENV.IPFS_FALLBACK_GATEWAY_URL].filter((g): g is string => Boolean(g));
  if (gateways.length === 0) {
    // eslint-disable-next-line no-console
    console.warn("No IPFS gateway configured (NEXT_PUBLIC_IPFS_GATEWAY_URL)");
    return null;
  }
  for (const [idx, gateway] of gateways.entries()) {
    const hit = await tryGateway(gateway, idx === 0 ? "primary" : "fallback", 5000, 1);
    if (hit) return hit;
  }

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
    return effectiveGateway ? `${effectiveGateway}${cid}` : "";
  }
  return ipfsUri || "";
}
