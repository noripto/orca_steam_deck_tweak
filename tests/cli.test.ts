import { execFile } from "node:child_process";

import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { OrcaCliMissingError } from "../src/orca/cli-missing-error.js";
import { runOrcaJson } from "../src/orca/cli.js";

// vitest hoists vi.mock above the imports above, so this still mocks execFile.
vi.mock("node:child_process", () => ({ execFile: vi.fn() }));

const mockExecFile = vi.mocked(execFile);

const mockRun = (opts: {
  stdout?: string;
  stderr?: string;
  errCode?: string | number;
}): void => {
  // execFile is a callback API; the mock has to match its shape, and the
  // argv-passing assertions below are the point of these tests.
  /* oxlint-disable promise/prefer-await-to-callbacks */
  mockExecFile.mockImplementation(((
    _file: string,
    _args: string[],
    _o: unknown,
    cb: unknown
  ) => {
    const callback = cb as (e: unknown, stdout: string, stderr: string) => void;
    const err =
      opts.errCode === undefined
        ? null
        : Object.assign(new Error("fail"), { code: opts.errCode });
    callback(err, opts.stdout ?? "", opts.stderr ?? "");
    return {} as never;
  }) as never);
  /* oxlint-enable promise/prefer-await-to-callbacks */
};

describe("runOrcaJson (CLI mocked)", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns result on a success envelope", async () => {
    mockRun({ stdout: '{"ok":true,"result":{"worktrees":[1,2]}}' });
    const res = await runOrcaJson<{ worktrees: number[] }>(["worktree", "ps"], {
      cliPath: "orca",
    });
    expect(res.worktrees).toEqual([1, 2]);
  });

  it("always appends --json exactly once", async () => {
    mockRun({ stdout: '{"ok":true,"result":{}}' });
    await runOrcaJson(["status"], { cliPath: "orca" });
    const [firstCall] = mockExecFile.mock.calls;
    const args = firstCall?.[1] as string[];
    expect(args.filter((a) => a === "--json")).toHaveLength(1);
    expect(args).toEqual(["status", "--json"]);
  });

  it("passes arguments as discrete argv tokens (no shell interpolation)", async () => {
    mockRun({ stdout: '{"ok":true,"result":{"send":{"accepted":true}}}' });
    await runOrcaJson(
      [
        "terminal",
        "send",
        "--terminal",
        "h1",
        "--text",
        'rm -rf / ; echo "pwn"',
        "--enter",
      ],
      { cliPath: "orca" }
    );
    const [firstCall] = mockExecFile.mock.calls;
    const args = firstCall?.[1] as string[];
    expect(args).toContain('rm -rf / ; echo "pwn"');
  });

  it("throws OrcaCliError carrying the CLI error code", async () => {
    mockRun({
      stdout:
        '{"ok":false,"error":{"code":"terminal_handle_stale","message":"gone"}}',
    });
    await expect(
      runOrcaJson(["terminal", "show"], { cliPath: "orca" })
    ).rejects.toMatchObject({
      code: "terminal_handle_stale",
      name: "OrcaCliError",
    });
  });

  it("throws OrcaCliMissingError when the executable is not found", async () => {
    mockRun({ errCode: "ENOENT" });
    await expect(
      runOrcaJson(["status"], { cliPath: "nope" })
    ).rejects.toBeInstanceOf(OrcaCliMissingError);
  });

  it("throws a runtime_unavailable OrcaCliError when output is not JSON", async () => {
    mockRun({ errCode: 1, stderr: "Orca is not running" });
    await expect(
      runOrcaJson(["status"], { cliPath: "orca" })
    ).rejects.toMatchObject({
      code: "runtime_unavailable",
      name: "OrcaCliError",
    });
  });
});
