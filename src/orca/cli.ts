import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

import type { OrcaEnvelope, OrcaCliErrorBody } from "./types.js";

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

export class OrcaCliMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrcaCliMissingError";
  }
}

export interface OrcaCliOptions {
  cliPath?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export function detectCliCandidates(): string[] {
  const candidates: string[] = [];

  const envCmd = process.env.ORCA_CLI_COMMAND?.trim();
  if (envCmd) candidates.push(envCmd);

  const os = platform();
  if (os === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
    candidates.push(join(localAppData, "Programs", "orca", "resources", "bin", "orca.exe"));
    candidates.push("orca.exe");
    candidates.push("orca");
  } else if (os === "darwin") {
    candidates.push("/usr/local/bin/orca");
    candidates.push("/opt/homebrew/bin/orca");
    candidates.push("orca");
  } else {
    candidates.push(join(homedir(), ".local", "bin", "orca-ide"));
    candidates.push("orca-ide");
    candidates.push("orca");
  }

  return [...new Set(candidates)];
}

export function resolveCliPath(explicit?: string): string {
  const trimmed = explicit?.trim();
  if (trimmed && trimmed.toLowerCase() !== "auto") {
    return trimmed;
  }
  for (const candidate of detectCliCandidates()) {
    if (candidate.includes("/") || candidate.includes("\\")) {
      if (existsSync(candidate)) return candidate;
    } else {
      return candidate;
    }
  }
  return platform() === "linux" ? "orca-ide" : "orca";
}

interface RawRun {
  stdout: string;
  stderr: string;
  code: number | null;
  spawnError?: NodeJS.ErrnoException;
}

function runRaw(exe: string, args: string[], timeoutMs: number): Promise<RawRun> {
  return new Promise((resolve) => {
    execFile(
      exe,
      args,
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        const err = error as (NodeJS.ErrnoException & { code?: number | string }) | null;
        const spawnFailed =
          err != null && typeof err.code === "string" && err.code === "ENOENT";
        resolve({
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          code: err && typeof err.code === "number" ? err.code : err ? 1 : 0,
          spawnError: spawnFailed ? err : undefined
        });
      }
    );
  });
}

export async function runOrcaJson<T>(
  args: string[],
  options: OrcaCliOptions = {}
): Promise<T> {
  const exe = resolveCliPath(options.cliPath);
  const argv = args.includes("--json") ? args : [...args, "--json"];
  const run = await runRaw(exe, argv, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  if (run.spawnError) {
    throw new OrcaCliMissingError(
      `Orca CLI executable not found: "${exe}". Set the CLI path in the Property Inspector.`
    );
  }

  const parsed = tryParseEnvelope<T>(run.stdout);
  if (parsed) {
    if (parsed.ok) return parsed.result;
    throw new OrcaCliError(parsed.error);
  }

  const detail = (run.stderr || run.stdout || "").trim().split("\n")[0] ?? "";
  throw new OrcaCliError({
    code: run.code === 0 ? "invalid_response" : "runtime_unavailable",
    message: detail || `orca ${args.join(" ")} produced no JSON output.`
  });
}

export function tryParseEnvelope<T>(stdout: string): OrcaEnvelope<T> | null {
  const text = stdout.trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as OrcaEnvelope<T>;
  } catch {
    throw new Error("can't parse JSON")
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as OrcaEnvelope<T>;
    } catch {
      return null;
    }
  }
  return null;
}
