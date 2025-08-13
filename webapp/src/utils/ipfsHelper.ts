import {
    IPFS_GATEWAY_URL,
    FALLBACK_IPFS_GATEWAY_URL,
    WEB3_STORAGE_GATEWAY_HOST_CONSTRUCTION,
    WEB3_STORAGE_GATEWAY_PREFIX,
    WEB3_STORAGE_GATEWAY_SUFFIX,
    CHAIN_SELECTION,
} from "../app.config";

export interface TokenMetadata {
    name: string;
    description: string;
    producer_address: string;
    image: File | null;
}

export async function initializeWeb3StorageClient() {
    try {
        const { create } = await import("@web3-storage/w3up-client");
        return await create();
    } catch (error) {
        console.error("Failed to load Web3Storage client:", error);
        throw error;
    }
}

export async function uploadToIPFS(client: any, content: File | string, contentType: string): Promise<string> {
    if (!client) {
        throw new Error("Web3Storage client is not initialized");
    }
    try {
        const blob = content instanceof File ? content : new Blob([content], { type: contentType });
        const cid = await client.uploadFile(blob);
        return cid.toString();
    } catch (error) {
        console.error("Error in uploadToIPFS:", error);
        throw new Error(`Failed to upload to IPFS: ${(error as Error).message}`);
    }
}

export async function connectToSpace(client: any, email: string, spaceName: string) {
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
        console.error("Error connecting to space:", error);
        throw error;
    }
}

export async function fetchJsonFromIpfsWithFallback(cidOrUri: string): Promise<{ data: any; gateway: string } | null> {
    const cid = cidOrUri.replace("ipfs://", "");

    // For local development, return mock metadata instead of trying external gateways
    if (CHAIN_SELECTION === "local") {
        console.log(`Local development mode: returning mock metadata for ${cid}`);

        // Generate different mock data based on the CID to simulate variety
        const mockNumber = cid.includes("Vault")
            ? "V"
            : cid.includes("Test3")
              ? "3"
              : cid.includes("Test2")
                ? "2"
                : cid.includes("Test1")
                  ? "1"
                  : cid.includes("Batch3")
                    ? "3"
                    : cid.includes("Batch2")
                      ? "2"
                      : "1";

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

        // Generate a more interesting SVG with patterns and gradients
        const svgString = `
            <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:${style.gradient[0]};stop-opacity:1" />
                        <stop offset="100%" style="stop-color:${style.gradient[1]};stop-opacity:1" />
                    </linearGradient>
                    <pattern id="pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                        ${
                            style.pattern === "circles"
                                ? `
                            <circle cx="20" cy="20" r="3" fill="white" opacity="0.3"/>
                            <circle cx="0" cy="0" r="3" fill="white" opacity="0.3"/>
                            <circle cx="40" cy="0" r="3" fill="white" opacity="0.3"/>
                            <circle cx="0" cy="40" r="3" fill="white" opacity="0.3"/>
                            <circle cx="40" cy="40" r="3" fill="white" opacity="0.3"/>
                        `
                                : style.pattern === "waves"
                                  ? `
                            <path d="M0,20 Q10,10 20,20 T40,20" stroke="white" stroke-width="2" fill="none" opacity="0.3"/>
                            <path d="M0,30 Q10,20 20,30 T40,30" stroke="white" stroke-width="2" fill="none" opacity="0.3"/>
                        `
                                  : style.pattern === "triangles"
                                    ? `
                            <polygon points="20,5 30,25 10,25" fill="white" opacity="0.2"/>
                            <polygon points="0,25 10,5 -10,5" fill="white" opacity="0.2"/>
                            <polygon points="40,25 50,5 30,5" fill="white" opacity="0.2"/>
                        `
                                    : `
                            <polygon points="20,5 35,15 35,35 20,45 5,35 5,15" fill="none" stroke="white" stroke-width="1" opacity="0.3"/>
                        `
                        }
                    </pattern>
                </defs>
                <rect width="400" height="400" fill="url(#grad)"/>
                <rect width="400" height="400" fill="url(#pattern)"/>
                <circle cx="200" cy="200" r="80" fill="white" opacity="0.2"/>
                <text x="50%" y="45%" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" opacity="0.9">CO2</text>
                <text x="50%" y="58%" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle" opacity="0.8">OFFSET</text>
                <text x="50%" y="70%" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">#${mockNumber}</text>
            </svg>
        `;
        // Properly encode the SVG string to handle UTF-8 characters
        const svgImage = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;

        const mockData = {
            name: `Carbon Offset #${mockNumber}`,
            description: `Test carbon offset NFT for local development. This represents verified carbon credits from renewable energy projects.`,
            image: svgImage,
            producer_address: "0x1234567890123456789012345678901234567890",
            external_url: `https://example.com/token/${cid}`,
            attributes: [
                { trait_type: "Type", value: "Carbon Offset" },
                { trait_type: "Batch", value: mockNumber },
                { trait_type: "Status", value: "Active" },
            ],
        };

        return { data: mockData, gateway: "local-mock" };
    }

    // Try primary gateway
    try {
        const response = await fetch(`${IPFS_GATEWAY_URL}${cid}`);
        if (response.ok) {
            const data = await response.json();
            console.log(`Primary gateway fetch SUCCEEDED for ${cid} using ${IPFS_GATEWAY_URL}`);
            return { data, gateway: IPFS_GATEWAY_URL };
        }
        console.warn(`Primary gateway fetch failed for ${cid} using ${IPFS_GATEWAY_URL}: ${response.status}`);
    } catch (error) {
        console.warn(`Error fetching from primary gateway ${IPFS_GATEWAY_URL} for ${cid}:`, error);
    }

    // Try web3.storage gateway (second attempt)
    if (WEB3_STORAGE_GATEWAY_HOST_CONSTRUCTION) {
        const web3StorageGatewayUrl = `${WEB3_STORAGE_GATEWAY_PREFIX}${cid}${WEB3_STORAGE_GATEWAY_SUFFIX}`;
        try {
            console.log(`Attempting web3.storage gateway for ${cid} to ${web3StorageGatewayUrl}`);
            const response = await fetch(web3StorageGatewayUrl);
            if (response.ok) {
                const data = await response.json();
                console.log(`web3.storage gateway fetch SUCCEEDED for ${cid} using ${web3StorageGatewayUrl}`);
                // For image resolution, we need a base URL that works with simple suffix concatenation for ipfs:// uris in metadata
                // So we pass back a generic representation of the successful gateway type or a known working public gateway for that host.
                // In this case, dweb.link can also resolve these CIDs if w3s.link works, and is easier for image URL construction.
                // Or, more robustly, the caller (TokenCard/Page) should be aware of subdomain gateways for images.
                // For now, let's return a gateway that works with the current resolveIpfsUriToUrl structure.
                // We'll use dweb.link as a stand-in for constructing image URLs if w3s.link (subdomain) fetched the metadata.
                // This is a simplification; ideally, resolveIpfsUriToUrl would handle subdomain gateways.
                return { data, gateway: `https://${new URL(web3StorageGatewayUrl).hostname}/` };
            }
            console.warn(
                `web3.storage gateway fetch failed for ${cid} using ${web3StorageGatewayUrl}: ${response.status}`,
            );
        } catch (error) {
            console.warn(`Error fetching from web3.storage gateway ${web3StorageGatewayUrl} for ${cid}:`, error);
        }
    }

    // Try fallback gateway (third attempt)
    try {
        console.log(`Attempting fallback for ${cid} to ${FALLBACK_IPFS_GATEWAY_URL}`);
        const response = await fetch(`${FALLBACK_IPFS_GATEWAY_URL}${cid}`);
        if (response.ok) {
            const data = await response.json();
            console.log(`Fallback gateway fetch SUCCEEDED for ${cid} using ${FALLBACK_IPFS_GATEWAY_URL}`);
            return { data, gateway: FALLBACK_IPFS_GATEWAY_URL };
        }
        console.warn(`Fallback gateway fetch failed for ${cid} using ${FALLBACK_IPFS_GATEWAY_URL}: ${response.status}`);
    } catch (error) {
        console.warn(`Error fetching from fallback gateway for ${cid}:`, error);
    }

    return null;
}

export function resolveIpfsUriToUrl(ipfsUri: string | undefined | null, gateway: string): string {
    // For local mock data or data URLs, return as-is
    if (gateway === "local-mock" || (ipfsUri && ipfsUri.startsWith("data:"))) {
        return ipfsUri || "";
    }

    if (ipfsUri && ipfsUri.startsWith("ipfs://")) {
        const cid = ipfsUri.replace("ipfs://", "");
        // Handle subdomain gateway structure if the provided gateway is a base for it (e.g., "https://*.ipfs.w3s.link/")
        // This is a simplified check. A more robust solution might involve checking specific hostnames.
        if (gateway.includes(".w3s.link")) {
            // Check if it's the w3s.link special gateway
            return `${WEB3_STORAGE_GATEWAY_PREFIX}${cid}${WEB3_STORAGE_GATEWAY_SUFFIX}`;
        } else {
            return `${gateway}${cid}`;
        }
    }
    return ipfsUri || "";
}
