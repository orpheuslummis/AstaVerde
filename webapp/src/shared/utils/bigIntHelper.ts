// BigInt serialization and manipulation utilities

export function serializeBigInt(value: bigint): string {
  return value.toString();
}

export function deserializeBigInt(value: string | number): bigint {
  return BigInt(value);
}

export function formatBigInt(value: bigint, decimals: number = 18): string {
  const divisor = 10n ** BigInt(decimals);
  const quotient = value / divisor;
  const remainder = value % divisor;

  const quotientStr = quotient.toString();
  const remainderStr = remainder.toString().padStart(decimals, "0");

  // Remove trailing zeros from remainder
  const trimmedRemainder = remainderStr.replace(/0+$/, "");

  if (trimmedRemainder === "") {
    return quotientStr;
  }

  return `${quotientStr}.${trimmedRemainder}`;
}

export function parseBigInt(value: string, decimals: number = 18): bigint {
  const [integerPart, fractionalPart = ""] = value.split(".");
  const paddedFractional = fractionalPart.padEnd(decimals, "0").slice(0, decimals);
  const combined = integerPart + paddedFractional;
  return BigInt(combined);
}

export function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

export function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}
