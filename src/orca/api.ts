import { logger } from "../logger.js";
import { OrcaCliError } from "./cli-error.js";
import { OrcaCliMissingError } from "./cli-missing-error.js";
import { runOrcaJson } from "./cli.js";
import type { OrcaCliOptions } from "./cli.js";
import type {
  OrcaAgentHooksStatusResult,
  OrcaConnection,
  OrcaStatusResult,
  OrcaTerminalFocusResult,
  OrcaTerminalListItem,
  OrcaTerminalListResult,
  OrcaTerminalSendResult,
  OrcaTerminalShowResult,
  OrcaWorktreePsResult,
  OrcaWorktreeSummary,
} from "./types.js";

/**
 * Typed, task-oriented wrappers over the raw CLI. Actions call these; they never
 * build argv themselves. All user-supplied values (handles, prompts, paths) are
 * passed as discrete argv tokens.
 */

/* -------------------------------------------------------------- connection */

export interface OrcaStatus {
  connection: OrcaConnection;
  raw?: OrcaStatusResult;
  errorMessage?: string;
}

export const getStatus = async (
  options: OrcaCliOptions
): Promise<OrcaStatus> => {
  try {
    const raw = await runOrcaJson<OrcaStatusResult>(["status"], options);
    const online = raw.app?.running === true && raw.runtime?.reachable === true;
    return { connection: online ? "online" : "offline", raw };
  } catch (error) {
    if (error instanceof OrcaCliMissingError) {
      return { connection: "cli-missing", errorMessage: error.message };
    }
    if (error instanceof OrcaCliError) {
      if (
        error.code === "runtime_unavailable" ||
        error.code === "runtime_error"
      ) {
        return { connection: "offline", errorMessage: error.message };
      }
      return {
        connection: "error",
        errorMessage: `${error.code}: ${error.message}`,
      };
    }
    return { connection: "error", errorMessage: String(error) };
  }
};

export const openOrca = async (options: OrcaCliOptions): Promise<void> => {
  await runOrcaJson<unknown>(["open"], options);
};

export const worktreePs = async (
  options: OrcaCliOptions
): Promise<OrcaWorktreeSummary[]> => {
  const result = await runOrcaJson<OrcaWorktreePsResult>(
    ["worktree", "ps"],
    options
  );
  return result.worktrees ?? [];
};

export const terminalListForWorktree = async (
  worktreePath: string,
  options: OrcaCliOptions
): Promise<OrcaTerminalListItem[]> => {
  const result = await runOrcaJson<OrcaTerminalListResult>(
    ["terminal", "list", "--worktree", `path:${worktreePath}`],
    options
  );
  return result.terminals ?? [];
};

export const terminalShow = async (
  handle: string,
  options: OrcaCliOptions
): Promise<OrcaTerminalShowResult["terminal"]> => {
  const result = await runOrcaJson<OrcaTerminalShowResult>(
    ["terminal", "show", "--terminal", handle],
    options
  );
  return result.terminal;
};

export interface SendPromptArgs {
  handle: string;
  text: string;
  enter?: boolean;
}

export const terminalSend = async (
  args: SendPromptArgs,
  options: OrcaCliOptions
): Promise<boolean> => {
  const argv = [
    "terminal",
    "send",
    "--terminal",
    args.handle,
    "--text",
    args.text,
  ];
  if (args.enter !== false) {
    argv.push("--enter");
  }
  const result = await runOrcaJson<OrcaTerminalSendResult>(argv, options);
  return result.send?.accepted === true;
};

export const terminalSwitch = async (
  handle: string,
  options: OrcaCliOptions
): Promise<OrcaTerminalFocusResult["focus"]> => {
  const result = await runOrcaJson<OrcaTerminalFocusResult>(
    ["terminal", "switch", "--terminal", handle],
    options
  );
  return result.focus;
};

export const agentHooksStatus = async (
  options: OrcaCliOptions
): Promise<OrcaAgentHooksStatusResult | null> => {
  try {
    return await runOrcaJson<OrcaAgentHooksStatusResult>(
      ["agent", "hooks", "status"],
      options
    );
  } catch (error) {
    // Hooks being unavailable is a normal configuration, not a failure, so
    // this stays at debug level rather than surfacing as an error.
    logger.debug("agent hooks status unavailable", error);
    return null;
  }
};

export const resolveTerminalHandle = async (
  worktreePath: string,
  titleHint: string | null | undefined,
  options: OrcaCliOptions
): Promise<string | null> => {
  const terminals = await terminalListForWorktree(worktreePath, options);
  if (terminals.length === 0) {
    return null;
  }

  if (titleHint) {
    const hint = titleHint.toLowerCase();
    const match = terminals.find((t) =>
      (t.title ?? "").toLowerCase().includes(hint)
    );
    if (match) {
      return match.handle;
    }
  }
  const connected = terminals.find((t) => t.connected);
  if (connected) {
    return connected.handle;
  }
  const [first] = terminals;
  return first?.handle ?? null;
};
