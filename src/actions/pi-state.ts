import { context } from "../context.js";

export interface PiState {
  connection: string;
  hooksEnabled: boolean;
  settings: { cliPath: string; pollSeconds: number };
  agents: Array<{
    id: string;
    label: string;
    agentType: string | null;
    state: string;
    worktreePath: string;
  }>;
  worktrees: Array<{
    id: string;
    label: string;
    path: string;
    repo: string;
    branch: string;
    state: string;
  }>;
}

export function buildPiState(): PiState {
  const snapshot = context.store.getSnapshot();
  const settings = context.store.getSettings();
  return {
    connection: snapshot.connection,
    hooksEnabled: snapshot.hooksEnabled,
    settings: { cliPath: settings.cliPath, pollSeconds: settings.pollSeconds },
    agents: snapshot.agents.map((a) => ({
      id: a.id,
      label: a.label,
      agentType: a.agentType,
      state: a.state,
      worktreePath: a.worktreePath,
    })),
    worktrees: snapshot.worktrees.map((w) => ({
      id: w.worktreeId,
      label: w.label,
      path: w.path,
      repo: w.repo,
      branch: w.branch,
      state: w.state,
    })),
  };
}
