import type {
  NormalizedAgent,
  NormalizedWorktree,
  OrcaAgentRow,
  OrcaAgentState,
  OrcaAgentWait,
  OrcaRawAgentState,
  OrcaWorktreeStatus,
  OrcaWorktreeSummary,
} from "./types.js";

export const normalizeAgentState = (
  raw: OrcaRawAgentState | string | undefined
): OrcaAgentState => {
  switch (raw) {
    case "working": {
      return "working";
    }
    case "waiting":
    case "blocked": {
      return "waiting";
    }
    case "done": {
      return "done";
    }
    case "idle": {
      return "idle";
    }
    default: {
      return "unknown";
    }
  }
};

export const normalizeWorktreeStatus = (
  raw: OrcaWorktreeStatus | string | undefined
): OrcaAgentState => {
  switch (raw) {
    case "working": {
      return "working";
    }
    case "permission": {
      return "waiting";
    }
    case "active": {
      return "idle";
    }
    case "inactive": {
      return "idle";
    }
    default: {
      return "unknown";
    }
  }
};

export const normalizeAgentWait = (
  agentWait: OrcaAgentWait | false | undefined
): OrcaAgentState => {
  if (agentWait === undefined) {
    return "unknown";
  }
  if (agentWait === false) {
    return "working";
  }
  return "waiting";
};

const STATE_PRIORITY: Record<OrcaAgentState, number> = {
  done: 2,
  idle: 1,
  unknown: 0,
  waiting: 4,
  working: 3,
};

export const moreUrgent = (
  a: OrcaAgentState,
  b: OrcaAgentState
): OrcaAgentState => (STATE_PRIORITY[a] >= STATE_PRIORITY[b] ? a : b);

const agentLabel = (row: OrcaAgentRow, wt: OrcaWorktreeSummary): string =>
  (row.displayName && row.displayName.trim()) ||
  (row.taskTitle && row.taskTitle.trim()) ||
  (wt.displayName && wt.displayName.trim()) ||
  wt.branch ||
  wt.repo;

export const normalizeWorktrees = (
  worktrees: OrcaWorktreeSummary[]
): {
  agents: NormalizedAgent[];
  worktrees: NormalizedWorktree[];
} => {
  const agents: NormalizedAgent[] = [];
  const normWorktrees: NormalizedWorktree[] = [];

  for (const wt of worktrees) {
    const rows = wt.agents ?? [];
    let worktreeState: OrcaAgentState = "unknown";

    if (rows.length > 0) {
      for (const [index, row] of rows.entries()) {
        const state = normalizeAgentState(row.state);
        worktreeState = moreUrgent(worktreeState, state);
        agents.push({
          agentType: row.agentType ?? null,
          branch: wt.branch,
          id: row.paneKey || `wt:${wt.path}#${index}`,
          label: agentLabel(row, wt),
          prompt: row.prompt ?? null,
          repo: wt.repo,
          state,
          terminalTitleHint: row.agentType ?? row.displayName ?? null,
          worktreeId: wt.worktreeId,
          worktreePath: wt.path,
        });
      }
    } else if (wt.liveTerminalCount > 0 || wt.status !== "inactive") {
      const state = normalizeWorktreeStatus(wt.status);
      worktreeState = state;
      agents.push({
        agentType: null,
        branch: wt.branch,
        id: `wt:${wt.path}#0`,
        label:
          (wt.displayName && wt.displayName.trim()) || wt.branch || wt.repo,
        prompt: null,
        repo: wt.repo,
        state,
        terminalTitleHint: null,
        worktreeId: wt.worktreeId,
        worktreePath: wt.path,
      });
    } else {
      worktreeState = normalizeWorktreeStatus(wt.status);
    }

    normWorktrees.push({
      agentCount: rows.length,
      branch: wt.branch,
      label: (wt.displayName && wt.displayName.trim()) || wt.branch || wt.repo,
      path: wt.path,
      repo: wt.repo,
      state: worktreeState,
      unread: wt.unread ?? false,
      worktreeId: wt.worktreeId,
    });
  }

  return { agents, worktrees: normWorktrees };
};

export const countByState = (
  agents: NormalizedAgent[]
): Record<OrcaAgentState, number> => {
  const counts: Record<OrcaAgentState, number> = {
    done: 0,
    idle: 0,
    unknown: 0,
    waiting: 0,
    working: 0,
  };
  for (const a of agents) {
    counts[a.state] += 1;
  }
  return counts;
};
