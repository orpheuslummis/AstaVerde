export function getErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err && typeof (err as any).message === "string") {
    return (err as any).message as string;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function getErrorCause(err: unknown): unknown {
  if (err && typeof err === "object" && "cause" in err) return (err as any).cause;
  return undefined;
}

