#!/usr/bin/env node

// Pin one or more existing CIDs to Pinata using a server-side JWT.
// Usage:
//   PINATA_JWT=eyJ... node scripts/pinata-pin.mjs bafy... Qm...
// Notes:
//   - Requires Node 18+ (global fetch)
//   - Only pins by CID (hash); upload remains via Web3.Storage

const { env, exit } = process;

async function main() {
  const cids = process.argv.slice(2).filter(Boolean);
  if (cids.length === 0) {
    console.error("Usage: PINATA_JWT=... node scripts/pinata-pin.mjs <cid> [cid ...]");
    exit(1);
  }
  const jwt = env.PINATA_JWT;
  if (!jwt) {
    console.error("Error: PINATA_JWT not set in environment.");
    exit(1);
  }

  const namePrefix = env.PINATA_NAME_PREFIX || "AstaVerde";

  for (const cid of cids) {
    try {
      const res = await fetch("https://api.pinata.cloud/pinning/pinByHash", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          hashToPin: cid.replace(/^ipfs:\/\//, ""),
          pinataMetadata: { name: `${namePrefix}:${cid.slice(0, 20)}` },
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText} ${text}`.trim());
      }
      const out = await res.json().catch(() => ({}));
      console.log(`✅ Pinned ${cid} to Pinata`, out?.id ? `(id: ${out.id})` : "");
    } catch (err) {
      console.error(`❌ Failed to pin ${cid}:`, err.message || err);
    }
  }
}

main();

