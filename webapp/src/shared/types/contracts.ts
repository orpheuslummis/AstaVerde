import type { Abi } from "abitype";

/**
 * A viem/wagmi-shaped contract handle: the { address, abi } pair that every
 * read and write in this app spreads into a wagmi hook or a public-client call.
 * Built in config/contracts and carried through AppContext.
 */
export interface ContractConfig {
  address: `0x${string}`;
  abi: Abi;
}

/**
 * The call wrapper returned by useContractInteraction.
 *
 * The function name is chosen at runtime from the ABI, so neither the arguments
 * nor the result can be inferred: a read resolves to the decoded return value,
 * a write to the transaction receipt, and an unsupported function to undefined.
 * The return is `any` rather than `unknown` deliberately, because callers narrow
 * the result themselves and `unknown` would only force casts at every call site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExecuteFunction = (...args: unknown[]) => Promise<any>;
