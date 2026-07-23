/** Extract a printable message from a caught `unknown` without ever showing a stack trace. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : JSON.stringify(error);
}
