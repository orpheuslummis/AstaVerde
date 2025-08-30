// Minimal ABI inference helpers for classifying contract functions
// Avoids hard-coded allowlists by deriving read/write from ABI stateMutability

type AbiItem = {
  type?: string;
  name?: string;
  stateMutability?: string;
  [key: string]: unknown;
};

export type FunctionKind = "read" | "write" | "unknown";

export function getFunctionAbi(abi: readonly unknown[], functionName: string): AbiItem | undefined {
  return (abi as AbiItem[]).find(
    (item) => item && item.type === "function" && item.name === functionName,
  );
}

export function getFunctionKind(abi: readonly unknown[], functionName: string): FunctionKind {
  const item = getFunctionAbi(abi, functionName);
  if (!item || !item.stateMutability) return "unknown";
  const sm = String(item.stateMutability);
  if (sm === "view" || sm === "pure") return "read";
  if (sm === "nonpayable" || sm === "payable") return "write";
  return "unknown";
}

export function isReadFunctionByAbi(abi: readonly unknown[], functionName: string): boolean {
  return getFunctionKind(abi, functionName) === "read";
}

export function isWriteFunctionByAbi(abi: readonly unknown[], functionName: string): boolean {
  return getFunctionKind(abi, functionName) === "write";
}

