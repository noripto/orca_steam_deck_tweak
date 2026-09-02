/**
 * Type definitions for the Orca CLI `--json` contract and the plugin's own
 * normalized model.
 *
 * The raw shapes below were derived directly from the installed Orca app source
 * (resources/app.asar → out/cli/*, out/main/index.js) so they match the exact
 * fields the CLI emits. Only the fields this plugin consumes are declared; the
 * CLI may return additional fields which are safely ignored.
 */

/** Every `orca ... --json` call prints this envelope on stdout. */
export type OrcaEnvelope<T> =
  | { ok: true; result: T; _meta?: unknown }
  | { ok: false; error: OrcaCliErrorBody; _meta?: unknown };

export interface OrcaCliErrorBody {
  code: string;
  message: string;
  data?: unknown;
}

/* ------------------------------------------------------------------ status */

export interface OrcaStatusResult {
  app: {
    running: boolean;
    pid?: number | null;
    desktopWindowStatus?: string | null;
  };
  runtime: {
    state: string;
    reachable: boolean;
    runtimeId?: string | null;
  };
  graph: { state: string };
  target?: { kind: string; environment?: string };
}

/* --------------------------------------------------------------- worktrees */

/** Live per-agent row attached to a worktree by `worktree ps`. */
export interface OrcaAgentRow {
  paneKey: string;
  parentPaneKey?: string | null;
  /** Raw agent state emitted by Orca's agent-status hooks. */
  state: OrcaRawAgentState;
  workingMode?: "monitoring";
  agentType: string | null;
  prompt?: string | null;
  taskTitle?: string | null;
  displayName?: string | null;
  lastAssistantMessage?: string | null;
  toolName?: string | null;
  toolInput?: unknown;
  interrupted?: boolean;
  stateStartedAt?: number;
  updatedAt?: number;
}

export type OrcaRawAgentState =
  | "working"
  | "waiting"
  | "blocked"
  | "idle"
  | "done";

/** Per-worktree fallback status derived from terminal titles / PTY liveness. */
export type OrcaWorktreeStatus =
  | "inactive"
  | "active"
  | "working"
  | "permission";

export interface OrcaWorktreeSummary {
  worktreeId: string;
  repoId: string;
  repo: string;
  path: string;
  branch: string;
  displayName?: string | null;
  workspaceStatus?: string;
  comment?: string;
  unread?: boolean;
  liveTerminalCount: number;
  hasAttachedPty: boolean;
  preview?: string;
  status: OrcaWorktreeStatus;
  agents: OrcaAgentRow[];
}

export interface OrcaWorktreePsResult {
  worktrees: OrcaWorktreeSummary[];
  truncated?: boolean;
  totalCount?: number;
}

export interface OrcaWorktreeShowResult {
  worktree: Record<string, unknown> & {
    id?: string;
    path?: string;
    branch?: string;
    displayName?: string | null;
    workspaceStatus?: string;
  };
}

/* --------------------------------------------------------------- terminals */

export interface OrcaTerminalListItem {
  handle: string;
  title?: string | null;
  connected: boolean;
  executionHostId?: string | null;
  worktreePath: string;
  preview?: string;
}

export interface OrcaTerminalListResult {
  terminals: OrcaTerminalListItem[];
  truncated?: boolean;
  totalCount?: number;
  hostScope?: { hostIds: string[]; omittedHostIds: string[] };
}

/** `agentWait` on `terminal show`: object = parked on a human prompt. */
export interface OrcaAgentWait {
  reason?: string | null;
  source: string;
}

export interface OrcaTerminalShowResult {
  terminal: {
    handle: string;
    title?: string | null;
    worktreePath: string;
    branch?: string;
    leafId?: string;
    ptyId?: string | null;
    connected: boolean;
    writable: boolean;
    /** object = waiting on human, false = not waiting, undefined = not evaluated. */
    agentWait?: OrcaAgentWait | false;
    preview?: string;
  };
}

export interface OrcaTerminalSendResult {
  send: {
    accepted: boolean;
    bytesWritten?: number;
    handle: string;
    agentSessionRefusal?: unknown;
  };
}

export interface OrcaTerminalFocusResult {
  focus: { handle: string; tabId?: string; navigated?: boolean };
}

/* --------------------------------------------------- agent status hooks */

export interface OrcaAgentHooksStatusResult {
  enabled: boolean;
  settingsPath: string;
  appliedBy: string;
  statuses: { agent: string; state: string }[];
}

/* --------------------------------------------------- normalized (plugin) */

/** The single normalized state the whole UI layer works with. */
export type OrcaAgentState =
  | "working"
  | "waiting"
  | "done"
  | "idle"
  | "unknown";

/** Normalized, UI-facing agent. Never leaks raw Orca state strings upward. */
export interface NormalizedAgent {
  /** Stable id: agent paneKey when available, else `wt:<path>#<index>`. */
  id: string;
  worktreeId: string;
  worktreePath: string;
  repo: string;
  branch: string;
  /** Best display name: agent displayName → worktree displayName → branch. */
  label: string;
  agentType: string | null;
  state: OrcaAgentState;
  prompt?: string | null;
  /** Preferred terminal title hint used to resolve a handle at action time. */
  terminalTitleHint?: string | null;
}

export interface NormalizedWorktree {
  worktreeId: string;
  repo: string;
  branch: string;
  path: string;
  label: string;
  agentCount: number;
  state: OrcaAgentState;
  unread: boolean;
}

/** Aggregate snapshot the poller publishes to actions. */
export interface OrcaSnapshot {
  connection: OrcaConnection;
  agents: NormalizedAgent[];
  worktrees: NormalizedWorktree[];
  counts: Record<OrcaAgentState, number>;
  /** True when agent-status hooks are on (rich per-agent state available). */
  hooksEnabled: boolean;
  updatedAt: number;
}

export type OrcaConnection = "online" | "offline" | "cli-missing" | "error";
