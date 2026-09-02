/** The Orca CLI executable could not be spawned (ENOENT). */
export class OrcaCliMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrcaCliMissingError";
  }
}
