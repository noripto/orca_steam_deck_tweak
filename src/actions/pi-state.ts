import { context } from "../context.js";

export interface PiState {
  connection: string;
  errorMessage?: string;
  hooksEnabled: boolean;
  settings: { cliPath: string; pollSeconds: number };
  agents: {
    id: string;
    label: string;
    agentType: string | null;
    state: string;
    worktreePath: string;
  }[];
  worktrees: {
    id: string;
    label: string;
    path: string;
    repo: string;
    branch: string;
    state: string;
  }[];
}

export const buildPiState = (): PiState => {
  const snapshot = context.store.getSnapshot();
  const settings = context.store.getSettings();
  return {
    agents: snapshot.agents.map((a) => ({
      agentType: a.agentType,
      id: a.id,
      label: a.label,
      state: a.state,
      worktreePath: a.worktreePath,
    })),
    connection: snapshot.connection,
    errorMessage: snapshot.errorMessage,
    hooksEnabled: snapshot.hooksEnabled,
    settings: { cliPath: settings.cliPath, pollSeconds: settings.pollSeconds },
    worktrees: snapshot.worktrees.map((w) => ({
      branch: w.branch,
      id: w.worktreeId,
      label: w.label,
      path: w.path,
      repo: w.repo,
      state: w.state,
    })),
  };
};
