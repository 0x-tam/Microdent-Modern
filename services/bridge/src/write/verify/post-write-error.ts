/** Thrown when post-write verification fails. Messages must never include row payloads or PHI. */
export class PostWriteVerificationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PostWriteVerificationError";
    this.code = code;
  }
}
