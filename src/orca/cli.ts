import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";

import { OrcaCliError } from "./cli-error.js";
import { OrcaCliMissingError } from "./cli-missing-error.js";
import type { OrcaEnvelope } from "./types.js";

export interface OrcaCliOptions {
  cliPath?: string;
  timeoutMs?: number;
}

interface RawRun {
  stdout: string;
  stderr: string;
  code: number | null;
  spawnError?: NodeJS.ErrnoException;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export const detectCliCandidates = (): string[] => {
  const candidates: string[] = [];

  const envCmd = process.env.ORCA_CLI_COMMAND?.trim();
  if (envCmd) {
    candidates.push(envCmd);
  }

  const os = platform();
  if (os === "win32") {
    const localAppData =
      process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local");
    candidates.push(
      path.join(
        localAppData,
        "Programs",
        "orca",
        "resources",
        "bin",
        "orca.exe"
      ),
      "orca.exe"
    );
  } else if (os === "darwin") {
    candidates.push("/usr/local/bin/orca", "/opt/homebrew/bin/orca");
  } else {
    candidates.push(
      path.join(homedir(), ".local", "bin", "orca-ide"),
      "orca-ide"
    );
  }
  candidates.push("orca");

  return [...new Set(candidates)];
};

export const resolveCliPath = (explicit?: string): string => {
  const trimmed = explicit?.trim();
  if (trimmed && trimmed.toLowerCase() !== "auto") {
    return trimmed;
  }
  for (const candidate of detectCliCandidates()) {
    if (candidate.includes("/") || candidate.includes("\\")) {
      if (existsSync(candidate)) {
        return candidate;
      }
    } else {
      return candidate;
    }
  }
  return platform() === "linux" ? "orca-ide" : "orca";
};

/**
 * `execFile` is a callback API, and this is the single boundary that adapts it
 * to the async code above. A spawn failure is reported in the resolved value
 * rather than as a rejection, so callers can tell "CLI missing" apart from
 * "CLI ran and failed".
 */
const runRaw = (
  exe: string,
  args: string[],
  timeoutMs: number
): Promise<RawRun> =>
  // oxlint-disable-next-line promise/avoid-new
  new Promise((resolve) => {
    execFile(
      exe,
      args,
      { maxBuffer: 8 * 1024 * 1024, timeout: timeoutMs, windowsHide: true },
      // oxlint-disable-next-line promise/prefer-await-to-callbacks
      (error, stdout, stderr) => {
        const err = error as
          | (NodeJS.ErrnoException & { code?: number | string })
          | null;
        const spawnFailed =
          err !== null && typeof err.code === "string" && err.code === "ENOENT";

        let code = 0;
        if (err !== null) {
          const { code: rawCode } = err;
          code = typeof rawCode === "number" ? rawCode : 1;
        }

        resolve({
          code,
          spawnError: spawnFailed ? err : undefined,
          stderr: stderr ?? "",
          stdout: stdout ?? "",
        });
      }
    );
  });

export const tryParseEnvelope = <T>(stdout: string): OrcaEnvelope<T> | null => {
  const text = stdout.trim();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as OrcaEnvelope<T>;
  } catch {
    // The bridge may emit warnings before the JSON; find the first {...} block.
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as OrcaEnvelope<T>;
    } catch {
      return null;
    }
  }
  return null;
};

export const runOrcaJson = async <T>(
  args: string[],
  options: OrcaCliOptions = {}
): Promise<T> => {
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
    if (parsed.ok) {
      return parsed.result;
    }
    throw new OrcaCliError(parsed.error);
  }

  const detail = (run.stderr || run.stdout || "").trim().split("\n")[0] ?? "";
  throw new OrcaCliError({
    code: run.code === 0 ? "invalid_response" : "runtime_unavailable",
    message: detail || `orca ${args.join(" ")} produced no JSON output.`,
  });
};
