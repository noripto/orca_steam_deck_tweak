import type { OrcaCliErrorBody } from "./types.js";

/** An `{ ok: false }` envelope returned by the Orca CLI. */
export class OrcaCliError extends Error {
  readonly code: string;
  readonly data?: unknown;

  constructor(body: OrcaCliErrorBody) {
    super(body.message);
    this.name = "OrcaCliError";
    this.code = body.code;
    this.data = body.data;
  }
}
