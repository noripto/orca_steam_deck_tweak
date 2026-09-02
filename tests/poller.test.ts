import { describe, expect, it } from "vite-plus/test";

import type { OrcaSnapshot } from "../src/orca/types.js";
import { signatureOf } from "../src/state/poller.js";

const base: OrcaSnapshot = {
  agents: [],
  connection: "offline",
  counts: { done: 0, idle: 0, unknown: 0, waiting: 0, working: 0 },
  hooksEnabled: false,
  updatedAt: 0,
  worktrees: [],
};

describe("signatureOf", () => {
  it("is stable while nothing changes", () => {
    expect(signatureOf({ ...base })).toBe(signatureOf({ ...base }));
  });

  it("ignores the timestamp", () => {
    expect(signatureOf({ ...base, updatedAt: 1 })).toBe(
      signatureOf({ ...base, updatedAt: 2 })
    );
  });

  // The poller only logs and redraws when the signature changes, so a changed
  // failure reason has to be visible here or the new reason is never reported.
  it("changes when the failure reason changes", () => {
    expect(signatureOf({ ...base, errorMessage: "cli missing" })).not.toBe(
      signatureOf({ ...base, errorMessage: "runtime unavailable" })
    );
  });
});
