// Shared by the admin page (signs) and the upload-url route (verifies).
// Kept dependency-free so it runs in both the browser and the Node route.

export const UPLOAD_AUTH_MAX_AGE_SECONDS = 10 * 60;

const HEADER = "AstaVerde upload authorization";

export function buildUploadAuthorizationMessage(chainId: number, contract: string, issuedAt: number): string {
  return `${HEADER}\nchain: ${chainId}\ncontract: ${contract.toLowerCase()}\nissued: ${issuedAt}`;
}

export function parseUploadAuthorizationMessage(
  message: string,
): { chainId: number; contract: string; issuedAt: number } | null {
  const m = message.match(/^AstaVerde upload authorization\nchain: (\d+)\ncontract: (0x[0-9a-f]{40})\nissued: (\d+)$/);
  if (!m) return null;
  return { chainId: Number(m[1]), contract: m[2], issuedAt: Number(m[3]) };
}
