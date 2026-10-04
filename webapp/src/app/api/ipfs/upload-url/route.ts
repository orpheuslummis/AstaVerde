import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress, type Address, type Hex } from "viem";
import { getCurrentChain } from "@/config/chains";
import { ENV } from "@/config/environment";
import { parseUploadAuthorizationMessage, UPLOAD_AUTH_MAX_AGE_SECONDS } from "@/utils/uploadAuth";

// Issues short-lived Pinata signed upload URLs to the marketplace owner.
//
// The Pinata key stays on the server. The browser proves it controls the
// contract owner by signing a message (EOA or ERC-1271 smart account); when the
// owner is a Safe, any of its signers is also accepted for the upload step; the
// mint transaction itself is still onlyOwner and must come from the Safe. The
// signed URL then lets the browser upload one file directly to Pinata.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PINATA_SIGN_URL = "https://uploads.pinata.cloud/v3/files/sign";
const SIGNED_URL_TTL_SECONDS = 300;

const ownerAbi = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;
const safeAbi = [
  { type: "function", name: "getOwners", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
] as const;

function decodeJwtExpiry(jwt: string): Date | null {
  try {
    const payload = jwt.split(".")[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const exp = JSON.parse(json).exp;
    return typeof exp === "number" ? new Date(exp * 1000) : null;
  } catch {
    return null;
  }
}

// These reads run on the server. Prefer SERVER_RPC_URL (server-only, never in the
// page code): the public NEXT_PUBLIC_* RPC key can then be restricted to the site's
// domains, which an RPC provider enforces through the Origin header that server
// requests do not send (Alchemy refuses them once a domain allowlist is set).
// Falls back to the chain's public RPC when unset.
function publicClient() {
  const chain = getCurrentChain();
  const url = process.env.SERVER_RPC_URL || chain.rpcUrls.default.http[0];
  return createPublicClient({ chain, transport: http(url) });
}

// GET: is uploading configured, and until when. No secrets in the response.
export async function GET() {
  const jwt = process.env.PINATA_JWT || "";
  const expiresAt = jwt ? decodeJwtExpiry(jwt) : null;
  return NextResponse.json({
    configured: Boolean(jwt),
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    gateway: ENV.IPFS_GATEWAY_URL || null,
    serverRpc: Boolean(process.env.SERVER_RPC_URL),
  });
}

// POST { address, message, signature, filename? } -> { url }
export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json(
      { error: "Uploads are not configured on this deployment (PINATA_JWT missing)" },
      { status: 503 },
    );
  }

  let body: { address?: string; message?: string; signature?: string; filename?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { address, message, signature, filename } = body;
  if (!address || !isAddress(address) || typeof message !== "string" || typeof signature !== "string") {
    return NextResponse.json({ error: "address, message and signature are required" }, { status: 400 });
  }

  const chain = getCurrentChain();
  const contract = ENV.ASTAVERDE_ADDRESS as Address;
  const parsed = parseUploadAuthorizationMessage(message);
  if (!parsed) {
    return NextResponse.json({ error: "Malformed authorization message" }, { status: 400 });
  }
  if (parsed.chainId !== chain.id || parsed.contract.toLowerCase() !== contract.toLowerCase()) {
    return NextResponse.json({ error: "Authorization message is for a different chain or contract" }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  if (parsed.issuedAt > now + 60 || now - parsed.issuedAt > UPLOAD_AUTH_MAX_AGE_SECONDS) {
    return NextResponse.json({ error: "Authorization expired; sign again" }, { status: 401 });
  }

  const client = publicClient();
  // Fail closed if the server RPC points at another network: every check below would
  // otherwise read the wrong chain.
  try {
    if ((await client.getChainId()) !== chain.id) {
      return NextResponse.json({ error: "Server RPC is on the wrong network" }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: "Could not reach the chain" }, { status: 502 });
  }

  let validSignature = false;
  try {
    // Handles EOAs and ERC-1271 smart accounts (Safe included).
    validSignature = await client.verifyMessage({ address, message, signature: signature as Hex });
  } catch {
    validSignature = false;
  }
  if (!validSignature) {
    return NextResponse.json({ error: "Signature does not match the address" }, { status: 401 });
  }

  let owner: Address;
  try {
    owner = await client.readContract({ address: contract, abi: ownerAbi, functionName: "owner" });
  } catch {
    return NextResponse.json({ error: "Could not read the contract owner" }, { status: 502 });
  }

  let authorized = owner.toLowerCase() === address.toLowerCase();
  if (!authorized) {
    // Owner may be a Safe: accept any of its signers.
    try {
      const code = await client.getCode({ address: owner });
      if (code && code !== "0x") {
        const signers = await client.readContract({ address: owner, abi: safeAbi, functionName: "getOwners" });
        authorized = signers.some((s) => s.toLowerCase() === address.toLowerCase());
      }
    } catch {
      authorized = false;
    }
  }
  if (!authorized) {
    return NextResponse.json({ error: "Only the marketplace owner can upload" }, { status: 403 });
  }

  const safeName = typeof filename === "string" ? filename.slice(0, 120) : undefined;
  const res = await fetch(PINATA_SIGN_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: JSON.stringify({
      date: now,
      expires: SIGNED_URL_TTL_SECONDS,
      network: "public",
      ...(safeName ? { filename: safeName } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Storage provider refused to issue an upload URL (${res.status})`, detail: text.slice(0, 200) },
      { status: 502 },
    );
  }
  const data = (await res.json()) as { data?: string };
  if (!data.data) {
    return NextResponse.json({ error: "Storage provider returned no upload URL" }, { status: 502 });
  }
  return NextResponse.json({ url: data.data, expiresIn: SIGNED_URL_TTL_SECONDS });
}
