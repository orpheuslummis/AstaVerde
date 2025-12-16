import { formatUnits } from "viem";
import { ENV } from "@/config/environment";

type Options = {
  minFractionDigits?: number;
  maxFractionDigits?: number;
  thousands?: boolean;
};

function addThousandSeparators(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatUSDC(
  value: bigint | undefined | null,
  { minFractionDigits = 2, maxFractionDigits = 6, thousands = true }: Options = {},
): string {
  if (value === undefined || value === null) return (0).toFixed(minFractionDigits);
  const raw = formatUnits(value, ENV.USDC_DECIMALS);
  const [intPartRaw, decRaw = ""] = raw.split(".");
  const intPart = thousands ? addThousandSeparators(intPartRaw) : intPartRaw;
  let dec = decRaw.slice(0, Math.max(0, maxFractionDigits)).replace(/0+$/, "");
  if (dec.length < minFractionDigits) dec = dec.padEnd(minFractionDigits, "0");
  return `${intPart}.${dec || "".padEnd(minFractionDigits, "0")}`;
}

export function formatUSDCWithUnit(value: bigint | undefined | null, opts?: Options): string {
  return `${formatUSDC(value, opts)} USDC`;
}

export function formatUSDCPerDay(value: bigint | undefined | null, opts?: Options): string {
  return `${formatUSDC(value, opts)} USDC/day`;
}
