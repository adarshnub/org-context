import { isDebugEnabled } from "@/lib/env";

export function serverDebug(scope: string, data?: unknown) {
  if (!isDebugEnabled()) {
    return;
  }

  console.log(`[org-context:${scope}]`, data ?? "");
}

export function serverError(scope: string, error: unknown, data?: unknown) {
  console.error(`[org-context:${scope}:error]`, {
    data,
    error:
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
          }
        : error,
  });
}
