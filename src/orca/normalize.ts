import type {
  NormalizedAgent,
  NormalizedWorktree,
  OrcaAgentRow,
  OrcaAgentState,
  OrcaAgentWait,
  OrcaRawAgentState,
  OrcaWorktreeStatus,
  OrcaWorktreeSummary
} from "./types.js";

export function normalizeAgentState(raw: OrcaRawAgentState | string | undefined): OrcaAgentState {
  switch (raw) {
    case "working":
      return "working";
    case "waiting":
    case "blocked":
      return "waiting";
    case "done":
      return "done";
    case "idle":
      return "idle";
    default:
      return "unknown";
  }
}

export function normalizeWorktreeStatus(raw: OrcaWorktreeStatus | string | undefined): OrcaAgentState {
  switch (raw) {
    case "working":
      return "working";
    case "permission":
      return "waiting";
    case "active":
      return "idle";
    case "inactive":
      return "idle";
    default:
      return "unknown";
  }
}

export function normalizeAgentWait(agentWait: OrcaAgentWait | false | undefined): OrcaAgentState {
  if (agentWait === undefined) return "unknown";
  if (agentWait === false) return "working";
  return "waiting";
}

const STATE_PRIORITY: Record<OrcaAgentState, number> = {
  waiting: 4,
  working: 3,
  done: 2,
  idle: 1,
  unknown: 0
};

export function moreUrgent(a: OrcaAgentState, b: OrcaAgentState): OrcaAgentState {
  return STATE_PRIORITY[a] >= STATE_PRIORITY[b] ? a : b;
}

function agentLabel(row: OrcaAgentRow, wt: OrcaWorktreeSummary): string {
  return (
    (row.displayName && row.displayName.trim()) ||
    (row.taskTitle && row.taskTitle.trim()) ||
    (wt.displayName && wt.displayName.trim()) ||
    wt.branch ||
    wt.repo
  );
}

export function normalizeWorktrees(worktrees: OrcaWorktreeSummary[]): {
  agents: NormalizedAgent[];
  worktrees: NormalizedWorktree[];
} {
  const agents: NormalizedAgent[] = [];
  const normWorktrees: NormalizedWorktree[] = [];

  for (const wt of worktrees) {
    const rows = wt.agents ?? [];
    let worktreeState: OrcaAgentState = "unknown";

    if (rows.length > 0) {
      rows.forEach((row, index) => {
        const state = normalizeAgentState(row.state);
        worktreeState = moreUrgent(worktreeState, state);
        agents.push({
          id: row.paneKey || `wt:${wt.path}#${index}`,
          worktreeId: wt.worktreeId,
          worktreePath: wt.path,
          repo: wt.repo,
          branch: wt.branch,
          label: agentLabel(row, wt),
          agentType: row.agentType ?? null,
          state,
          prompt: row.prompt ?? null,
          terminalTitleHint: row.agentType ?? row.displayName ?? null
        });
      });
    } else if (wt.liveTerminalCount > 0 || wt.status !== "inactive") {
      const state = normalizeWorktreeStatus(wt.status);
      worktreeState = state;
      agents.push({
        id: `wt:${wt.path}#0`,
        worktreeId: wt.worktreeId,
        worktreePath: wt.path,
        repo: wt.repo,
        branch: wt.branch,
        label: (wt.displayName && wt.displayName.trim()) || wt.branch || wt.repo,
        agentType: null,
        state,
        prompt: null,
        terminalTitleHint: null
      });
    } else {
      worktreeState = normalizeWorktreeStatus(wt.status);
    }

    normWorktrees.push({
      worktreeId: wt.worktreeId,
      repo: wt.repo,
      branch: wt.branch,
      path: wt.path,
      label: (wt.displayName && wt.displayName.trim()) || wt.branch || wt.repo,
      agentCount: rows.length,
      state: worktreeState,
      unread: wt.unread ?? false
    });
  }

  return { agents, worktrees: normWorktrees };
}

export function countByState(agents: NormalizedAgent[]): Record<OrcaAgentState, number> {
  const counts: Record<OrcaAgentState, number> = {
    working: 0,
    waiting: 0,
    done: 0,
    idle: 0,
    unknown: 0
  };
  for (const a of agents) counts[a.state] += 1;
  return counts;
}
