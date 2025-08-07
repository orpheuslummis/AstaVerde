import {
    IPFS_GATEWAY_URL,
    FALLBACK_IPFS_GATEWAY_URL,
    WEB3_STORAGE_GATEWAY_HOST_CONSTRUCTION,
    WEB3_STORAGE_GATEWAY_PREFIX,
    WEB3_STORAGE_GATEWAY_SUFFIX,
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
