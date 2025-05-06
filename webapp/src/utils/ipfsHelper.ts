import { IPFS_GATEWAY_URL, FALLBACK_IPFS_GATEWAY_URL } from '../app.config';

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
            return { data, gateway: IPFS_GATEWAY_URL };
        }
        console.warn(`Primary gateway fetch failed for ${cid}: ${response.status}`);
    } catch (error) {
        console.warn(`Error fetching from primary gateway for ${cid}:`, error);
    }

    // Try fallback gateway
    try {
        console.log(`Attempting fallback for ${cid} to ${FALLBACK_IPFS_GATEWAY_URL}`)
        const response = await fetch(`${FALLBACK_IPFS_GATEWAY_URL}${cid}`);
        if (response.ok) {
            const data = await response.json();
            return { data, gateway: FALLBACK_IPFS_GATEWAY_URL };
        }
        console.warn(`Fallback gateway fetch failed for ${cid}: ${response.status}`);
    } catch (error) {
        console.warn(`Error fetching from fallback gateway for ${cid}:`, error);
    }

    return null;
}

export function resolveIpfsUriToUrl(ipfsUri: string | undefined | null, gateway: string): string {
    if (ipfsUri && ipfsUri.startsWith("ipfs://")) {
        return ipfsUri.replace("ipfs://", gateway);
    }
    // If not starting with ipfs://, assume it might be a full URL or an invalid/empty URI
    // It might also be a relative path if metadata was malformed, though less common for image URIs
    return ipfsUri || ""; // Return empty string if ipfsUri is null/undefined to prevent errors in <img> src
}
