import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({ execFile: vi.fn() }));

import { execFile } from "node:child_process";
import { OrcaCliMissingError, runOrcaJson } from "../src/orca/cli.js";

const mockExecFile = vi.mocked(execFile);

function mockRun(opts: { stdout?: string; stderr?: string; errCode?: string | number }): void {
  mockExecFile.mockImplementation(((_file: string, _args: string[], _o: unknown, cb: unknown) => {
    const callback = cb as (e: unknown, stdout: string, stderr: string) => void;
    const err =
      opts.errCode !== undefined ? Object.assign(new Error("fail"), { code: opts.errCode }) : null;
    callback(err, opts.stdout ?? "", opts.stderr ?? "");
    return {} as never;
  }) as never);
}

describe("runOrcaJson (CLI mocked)", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns result on a success envelope", async () => {
    mockRun({ stdout: '{"ok":true,"result":{"worktrees":[1,2]}}' });
    const res = await runOrcaJson<{ worktrees: number[] }>(["worktree", "ps"], { cliPath: "orca" });
    expect(res.worktrees).toEqual([1, 2]);
  });

  it("always appends --json exactly once", async () => {
    mockRun({ stdout: '{"ok":true,"result":{}}' });
    await runOrcaJson(["status"], { cliPath: "orca" });
    const args = mockExecFile.mock.calls[0]![1] as string[];
    expect(args.filter((a) => a === "--json")).toHaveLength(1);
    expect(args).toEqual(["status", "--json"]);
  });

  it("passes arguments as discrete argv tokens (no shell interpolation)", async () => {
    mockRun({ stdout: '{"ok":true,"result":{"send":{"accepted":true}}}' });
    await runOrcaJson(
      ["terminal", "send", "--terminal", "h1", "--text", 'rm -rf / ; echo "pwn"', "--enter"],
      { cliPath: "orca" },
    );
    const args = mockExecFile.mock.calls[0]![1] as string[];
    expect(args).toContain('rm -rf / ; echo "pwn"');
  });

  it("throws OrcaCliError carrying the CLI error code", async () => {
    mockRun({ stdout: '{"ok":false,"error":{"code":"terminal_handle_stale","message":"gone"}}' });
    await expect(runOrcaJson(["terminal", "show"], { cliPath: "orca" })).rejects.toMatchObject({
      name: "OrcaCliError",
      code: "terminal_handle_stale",
    });
  });

  it("throws OrcaCliMissingError when the executable is not found", async () => {
    mockRun({ errCode: "ENOENT" });
    await expect(runOrcaJson(["status"], { cliPath: "nope" })).rejects.toBeInstanceOf(
      OrcaCliMissingError,
    );
  });

  it("throws a runtime_unavailable OrcaCliError when output is not JSON", async () => {
    mockRun({ stderr: "Orca is not running", errCode: 1 });
    await expect(runOrcaJson(["status"], { cliPath: "orca" })).rejects.toMatchObject({
      name: "OrcaCliError",
      code: "runtime_unavailable",
    });
  });
});
