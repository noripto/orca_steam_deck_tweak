import { describe, expect, it } from "vitest";

import { tryParseEnvelope } from "../src/orca/cli.js";

describe("tryParseEnvelope", () => {
  it("parses a clean success envelope", () => {
    const env = tryParseEnvelope<{ worktrees: unknown[] }>('{"ok":true,"result":{"worktrees":[]}}');
    expect(env).toEqual({ ok: true, result: { worktrees: [] } });
  });

  it("parses an error envelope", () => {
    const env = tryParseEnvelope('{"ok":false,"error":{"code":"runtime_unavailable","message":"down"}}');
    expect(env).toMatchObject({ ok: false, error: { code: "runtime_unavailable" } });
  });

  it("tolerates leading non-JSON warning lines from the WSL bridge", () => {
    const stdout = 'warning: something\n{"ok":true,"result":{"x":1}}';
    const env = tryParseEnvelope<{ x: number }>(stdout);
    expect(env).toMatchObject({ ok: true, result: { x: 1 } });
  });

  it("returns null for empty or non-JSON output", () => {
    expect(tryParseEnvelope("")).toBeNull();
    expect(tryParseEnvelope("not json at all")).toBeNull();
  });
});
