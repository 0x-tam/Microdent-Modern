import type { ApiErrorBody } from "@microdent/contracts";

export type BridgeClientErrorKind = "network" | "http" | "invalid_body" | "invalid_argument";

export type BridgeClientErrorOptions = {
  kind: BridgeClientErrorKind;
  /** HTTP status when the response was received (including non-2xx). */
  status?: number;
  /** `error.code` from bridge JSON error body when parseable. */
  apiCode?: string;
  /** `error.message` from bridge JSON error body when parseable. */
  apiMessage?: string;
  cause?: unknown;
};

/**
 * Thrown when the bridge client cannot complete a typed request:
 * transport failure, non-success HTTP status, or body that is not valid JSON / fails Zod.
 */
export class BridgeClientError extends Error {
  readonly kind: BridgeClientErrorKind;
  readonly status?: number;
  readonly apiCode?: string;
  readonly apiMessage?: string;

  constructor(message: string, options: BridgeClientErrorOptions) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "BridgeClientError";
    this.kind = options.kind;
    this.status = options.status;
    this.apiCode = options.apiCode;
    this.apiMessage = options.apiMessage;
  }

  static fromApiErrorBody(status: number, body: ApiErrorBody): BridgeClientError {
    return new BridgeClientError(body.error.message, {
      kind: "http",
      status,
      apiCode: body.error.code,
      apiMessage: body.error.message,
    });
  }
}
