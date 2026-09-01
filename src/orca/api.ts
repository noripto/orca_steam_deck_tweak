import { OrcaCliError, OrcaCliMissingError, runOrcaJson, type OrcaCliOptions } from "./cli.js";
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
  OrcaWorktreeSummary
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

export async function getStatus(options: OrcaCliOptions): Promise<OrcaStatus> {
  try {
    const raw = await runOrcaJson<OrcaStatusResult>(["status"], options);
    const online = raw.app?.running === true && raw.runtime?.reachable === true;
    return { connection: online ? "online" : "offline", raw };
  } catch (err) {
    if (err instanceof OrcaCliMissingError) {
      return { connection: "cli-missing", errorMessage: err.message };
    }
    if (err instanceof OrcaCliError) {
      if (err.code === "runtime_unavailable" || err.code === "runtime_error") {
        return { connection: "offline", errorMessage: err.message };
      }
      return { connection: "error", errorMessage: `${err.code}: ${err.message}` };
    }
    return { connection: "error", errorMessage: String(err) };
  }
}

export async function openOrca(options: OrcaCliOptions): Promise<void> {
  await runOrcaJson<unknown>(["open"], options);
}

export async function worktreePs(options: OrcaCliOptions): Promise<OrcaWorktreeSummary[]> {
  const result = await runOrcaJson<OrcaWorktreePsResult>(["worktree", "ps"], options);
  return result.worktrees ?? [];
}

export async function terminalListForWorktree(
  worktreePath: string,
  options: OrcaCliOptions
): Promise<OrcaTerminalListItem[]> {
  const result = await runOrcaJson<OrcaTerminalListResult>(
    ["terminal", "list", "--worktree", `path:${worktreePath}`],
    options
  );
  return result.terminals ?? [];
}

export async function terminalShow(
  handle: string,
  options: OrcaCliOptions
): Promise<OrcaTerminalShowResult["terminal"]> {
  const result = await runOrcaJson<OrcaTerminalShowResult>(
    ["terminal", "show", "--terminal", handle],
    options
  );
  return result.terminal;
}

export interface SendPromptArgs {
  handle: string;
  text: string;
  enter?: boolean;
}

export async function terminalSend(
  args: SendPromptArgs,
  options: OrcaCliOptions
): Promise<boolean> {
  const argv = ["terminal", "send", "--terminal", args.handle, "--text", args.text];
  if (args.enter !== false) argv.push("--enter");
  const result = await runOrcaJson<OrcaTerminalSendResult>(argv, options);
  return result.send?.accepted === true;
}

export async function terminalSwitch(
  handle: string,
  options: OrcaCliOptions
): Promise<OrcaTerminalFocusResult["focus"]> {
  const result = await runOrcaJson<OrcaTerminalFocusResult>(
    ["terminal", "switch", "--terminal", handle],
    options
  );
  return result.focus;
}

export async function agentHooksStatus(
  options: OrcaCliOptions
): Promise<OrcaAgentHooksStatusResult | null> {
  try {
    return await runOrcaJson<OrcaAgentHooksStatusResult>(["agent", "hooks", "status"], options);
  } catch {
    return null;
  }
}

export async function resolveTerminalHandle(
  worktreePath: string,
  titleHint: string | null | undefined,
  options: OrcaCliOptions
): Promise<string | null> {
  const terminals = await terminalListForWorktree(worktreePath, options);
  if (terminals.length === 0) return null;

  if (titleHint) {
    const hint = titleHint.toLowerCase();
    const match = terminals.find((t) => (t.title ?? "").toLowerCase().includes(hint));
    if (match) return match.handle;
  }
  const connected = terminals.find((t) => t.connected);
  return (connected ?? terminals[0]!).handle;
}
