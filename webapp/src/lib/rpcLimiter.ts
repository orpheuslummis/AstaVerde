// Shared RPC rate limiter used by all transports to avoid provider 429s.
// Infura throughput is credit-based (method-weighted), so we rate limit by estimated credit cost.
import { http } from "wagmi";

type Task<T> = () => Promise<T>;

type QueueItem = {
  credits: number;
  task: Task<unknown>;
  resolve: (v: unknown) => void;
  reject: (err: unknown) => void;
};

const queue: QueueItem[] = [];
let active = 0;
let cooldownUntil = 0;
let rateLimitStrikes = 0;
let drainTimer: ReturnType<typeof setTimeout> | null = null;

// Infura free tier is commonly 500 credits/sec. Keep headroom for method-cost variance.
const CREDIT_BUDGET_PER_SECOND = 450;
const CREDIT_WINDOW_MS = 1000;

const MAX_CONCURRENT = 4;
const COOLDOWN_BASE_MS = 2_000;
const COOLDOWN_MAX_MS = 60_000;

// Default cost for unknown methods. Keep this relatively low to avoid
// over-throttling common reads like `eth_call` while still enforcing a cap.
const DEFAULT_METHOD_CREDITS = 25;
const METHOD_CREDITS: Record<string, number> = {
  eth_chainId: 2,
  net_version: 2,
  eth_blockNumber: 5,
  eth_getBalance: 10,
  eth_call: 25,
  eth_getTransactionReceipt: 15,
  eth_getLogs: 255,
  eth_estimateGas: 300,
  eth_sendRawTransaction: 60,
};

type CreditWindowEntry = { startedAt: number; credits: number };
const creditWindow: CreditWindowEntry[] = [];

function isRateLimitError(error: unknown) {
  const err = error as { status?: number; message?: string; cause?: { status?: number; message?: string } };
  const status = err?.status ?? err?.cause?.status;
  const message = (err?.message ?? err?.cause?.message ?? "").toLowerCase();
  return status === 429 || message.includes("429") || message.includes("too many requests");
}

function getMethodCredits(method: string): number {
  return METHOD_CREDITS[method] ?? DEFAULT_METHOD_CREDITS;
}

function extractRpcMethods(input: unknown): string[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input.flatMap((item) => extractRpcMethods(item));
  }

  if (typeof input === "string") {
    try {
      return extractRpcMethods(JSON.parse(input));
    } catch {
      return [];
    }
  }

  if (typeof input !== "object") return [];

  const anyInput = input as { method?: unknown; body?: unknown };
  if (typeof anyInput.method === "string") return [anyInput.method];
  if (anyInput.body) return extractRpcMethods(anyInput.body);
  return [];
}

function estimateCreditsForRequest(input: unknown): number {
  const methods = extractRpcMethods(input);
  if (!methods.length) return DEFAULT_METHOD_CREDITS;
  return methods.reduce((sum, method) => sum + getMethodCredits(method), 0);
}

function scheduleDrain(ms: number) {
  if (drainTimer) return;
  drainTimer = setTimeout(() => {
    drainTimer = null;
    drainQueue();
  }, ms);
}

function pruneCreditWindow(now: number) {
  const cutoff = now - CREDIT_WINDOW_MS;
  while (creditWindow.length && creditWindow[0]!.startedAt <= cutoff) {
    creditWindow.shift();
  }
}

function usedCreditsInWindow(): number {
  return creditWindow.reduce((sum, entry) => sum + entry.credits, 0);
}

function msUntilCreditsAvailable(now: number, nextCredits: number): number {
  const clampedCredits = Math.min(nextCredits, CREDIT_BUDGET_PER_SECOND);
  const used = usedCreditsInWindow();
  if (used + clampedCredits <= CREDIT_BUDGET_PER_SECOND) return 0;

  let creditsToFree = used + clampedCredits - CREDIT_BUDGET_PER_SECOND;
  for (const entry of creditWindow) {
    creditsToFree -= entry.credits;
    if (creditsToFree <= 0) {
      return Math.max(0, entry.startedAt + CREDIT_WINDOW_MS - now);
    }
  }
  return CREDIT_WINDOW_MS;
}

function drainQueue() {
  if (active >= MAX_CONCURRENT) return;
  if (!queue.length) return;

  while (active < MAX_CONCURRENT && queue.length) {
    const now = Date.now();
    if (now < cooldownUntil) {
      scheduleDrain(cooldownUntil - now);
      return;
    }

    pruneCreditWindow(now);
    // Avoid head-of-line blocking: schedule *any* item that fits the remaining
    // credit budget now. This keeps interactive reads (balances/UI) responsive
    // even if an expensive request (e.g. `eth_getLogs`) is queued first.
    let selectedIndex = -1;
    let bestWaitMs = CREDIT_WINDOW_MS;
    for (let i = 0; i < queue.length; i++) {
      const candidate = queue[i]!;
      const candidateWait = msUntilCreditsAvailable(now, candidate.credits);
      if (candidateWait === 0) {
        selectedIndex = i;
        bestWaitMs = 0;
        break;
      }
      if (candidateWait < bestWaitMs) bestWaitMs = candidateWait;
    }

    if (selectedIndex === -1) {
      scheduleDrain(bestWaitMs);
      return;
    }

    const [item] = queue.splice(selectedIndex, 1);
    if (!item) return;
    active += 1;
    creditWindow.push({ startedAt: now, credits: Math.min(item.credits, CREDIT_BUDGET_PER_SECOND) });

    item.task()
      .then((res) => {
        rateLimitStrikes = 0;
        item.resolve(res);
      })
      .catch((err) => {
        if (isRateLimitError(err)) {
          rateLimitStrikes = Math.min(rateLimitStrikes + 1, 6);
          const backoff = Math.min(COOLDOWN_BASE_MS * 2 ** rateLimitStrikes, COOLDOWN_MAX_MS);
          const jitter = Math.floor(Math.random() * 250);
          cooldownUntil = Math.max(cooldownUntil, Date.now() + backoff + jitter);
        }
        item.reject(err);
      })
      .finally(() => {
        active -= 1;
        drainQueue();
      });
  }
}

function schedule<T>(task: Task<T>, credits: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({ credits, task, resolve, reject });
    drainQueue();
  });
}

export function createRateLimitedHttp(url?: string, config?: Parameters<typeof http>[1]) {
  const base = http(url, config);
  return ((...args: Parameters<ReturnType<typeof http>>) => {
    const transport = base(...args);
    const baseRequest = transport.request;
    return {
      ...transport,
      request: (opts: Parameters<typeof baseRequest>[0]) => schedule(() => baseRequest(opts), estimateCreditsForRequest(opts)),
    };
  }) as ReturnType<typeof http>;
}

// For ad-hoc usage where direct wrapping is easier than a custom transport.
export async function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  return schedule(fn, DEFAULT_METHOD_CREDITS);
}

// Wraps a viem client so every async method is passed through the limiter.
// This lets us keep wagmi/viem usage unchanged while enforcing global pacing.
export function wrapPublicClient<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") {
        return value;
      }
      return (...args: unknown[]) => rateLimited(() => (value as (...fnArgs: unknown[]) => Promise<unknown>).apply(target, args));
    },
  }) as T;
}
